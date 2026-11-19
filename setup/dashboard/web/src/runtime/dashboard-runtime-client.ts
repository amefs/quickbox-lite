// SPDX-License-Identifier: GPL-3.0-or-later

import { AnsiUp } from "ansi_up";
import { io, type Socket } from "socket.io-client";

import type { DashboardBootstrapPayload } from "../../../ws/src/shared/bootstrap-contract";

interface StatusTask {
    key: string;
    url: string;
    urlTemplate?: string;
    id?: string;
    bootstrap?: boolean;
    time: number;
    before?: (task: StatusTask) => boolean;
    override?: (data: unknown, response: WsMessageResponse, request?: StatusTaskRequest) => void;
}

interface StatusTaskRequest extends StatusTask {
    requestId: string;
    locale: string;
}

interface PendingRequestEntry {
    request: StatusTaskRequest;
    task: StatusTask;
    timeoutId: ReturnType<typeof setTimeout>;
}

interface WsMessageResponse {
    requestId?: string;
    key?: string;
    url?: string;
    success?: boolean;
    response?: unknown;
    meta?: { protocolVersion?: number };
}

interface ExecResponse {
    success?: boolean;
    message?: string;
    stdout?: string;
    stderr?: string;
    cmd?: string;
}

interface RuntimeGlobals {
    basePath?: string;
    locale?: string;
    locales?: string[];
    messages?: Record<string, string>;
    socketUpgrade?: boolean;
}

declare global {
    interface Window {
        quickboxRuntime?: DashboardBootstrapPayload;
        quickboxApiBase?: string;
        quickboxLocale?: string;
        quickboxMessages?: Record<string, string>;
        quickboxSetLocale?: (locale: string) => void;
        quickboxWidgetUrl?: (url: string) => string;
        quickboxResetWidgetState?: () => void;
        quickboxPackageManagementActions?: {
            run: (action: "install" | "remove", packageName: string) => void;
        };
        socket?: Socket;
        packageInstallHandler?: (event: Event) => void;
        packageRemoveHandler?: (event: Event) => void;
        serviceUpdateHandler?: (event: Event) => void;
        boxHandler?: (event: Event) => void;
    }
}

const LOCALE_ALIASES: Record<string, string> = {
    "zh-cn": "zh",
    "zh-hans-cn": "zh",
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function scheduleVisibilityInterval(visibleMs: number, hiddenMs: number, callback: () => void) {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
        if (timerId !== undefined) {
            clearTimeout(timerId);
        }
        const delay = document.hidden ? hiddenMs : visibleMs;
        timerId = setTimeout(() => {
            callback();
            scheduleNext();
        }, delay);
    };

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            callback();
        }
        scheduleNext();
    });

    scheduleNext();
}

function afterPrerendering(callback: () => void) {
    const doc = document as Document & { prerendering?: boolean };
    if (doc.prerendering) {
        document.addEventListener("prerenderingchange", callback, { once: true });
        return;
    }
    if ((document.visibilityState as string) === "prerender") {
        const onVisibilityChange = () => {
            if ((document.visibilityState as string) !== "prerender") {
                document.removeEventListener("visibilitychange", onVisibilityChange);
                callback();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return;
    }
    callback();
}

export function initDashboardRuntime() {
    const runtime = window.quickboxRuntime as RuntimeGlobals | undefined;
    if (!runtime) {
        return;
    }

    const supported = Array.isArray(runtime.locales) ? runtime.locales.slice() : ["en"];

    function normalizeLocale(value: unknown): string {
        if (typeof value !== "string") {
            return "en";
        }
        let normalized = value.toLowerCase().replace(/_/g, "-").replace(/^lang-/, "");
        normalized = LOCALE_ALIASES[normalized] || normalized;
        if (supported.includes(normalized)) {
            return normalized;
        }
        const primaryLocale = normalized.split("-")[0] ?? "en";
        return supported.includes(primaryLocale) ? primaryLocale : "en";
    }

    function persistLocale(locale: string) {
        try {
            localStorage.setItem("quickbox:locale", locale);
        } catch (error) {
            console.warn("[ws] failed to persist locale", error);
        }
        let cookie = `quickbox_locale=${encodeURIComponent(locale)}; Path=/; SameSite=Lax`;
        if (window.location.protocol === "https:") {
            cookie += "; Secure";
        }
        document.cookie = cookie;
    }

    const basePath = runtime.basePath ?? "";
    window.quickboxApiBase = basePath;
    window.quickboxLocale = normalizeLocale(runtime.locale);
    window.quickboxMessages = {
        enabled: "Enabled",
        disabled: "Disabled",
        refresh: "Refresh",
        systemResponse: "System Response",
        ...(runtime.messages ?? {}),
    };
    persistLocale(window.quickboxLocale);

    window.quickboxWidgetUrl = (url: string) => {
        const separator = url.includes("?") ? "&" : "?";
        return `${window.quickboxApiBase ?? ""}${url}${separator}locale=${encodeURIComponent(window.quickboxLocale ?? "en")}`;
    };

    const socket = io(location.origin, {
        path: `${window.quickboxApiBase}/socket.io`,
        upgrade: runtime.socketUpgrade !== false,
    });
    window.socket = socket;

    window.quickboxServiceIsland?.bindTransport({
        isConnected: () => socket.connected,
        sendMessage: (request) => { socket.send(request); },
        executeServiceAction: (request) => { socket.emit("service-action", request); },
        notifyStopped: (key) => {
            console.warn(`[ws] stopping updates for ${key}`);
            window.quickboxSystemResponseIsland?.notifyWarning("QuickBox", `Stopped status updates for ${key}`);
        },
    });

    socket.on("connect", () => {
        socket.emit("i18n", window.quickboxLocale || "en");
    });

    socket.on("service-action-result", (response: unknown) => {
        window.quickboxServiceIsland?.onActionResult(response);
    });

    let widgetWriteSource: Record<string, string> = {};

    function markWidgetWritten(selector: string | undefined, source: string) {
        if (!selector) {
            return;
        }
        widgetWriteSource[selector] = source;
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) {
            element.dataset.qbWriteSource = source;
        }
    }

    function widgetWriteSourceOf(selector: string): string {
        if (Object.prototype.hasOwnProperty.call(widgetWriteSource, selector)) {
            return widgetWriteSource[selector] ?? "";
        }
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement && element.dataset.qbWriteSource) {
            return element.dataset.qbWriteSource;
        }
        return "";
    }

    function resetWidgetWriteState() {
        widgetWriteSource = {};
        document.querySelectorAll("[data-qb-write-source]").forEach((element) => {
            if (element instanceof HTMLElement) {
                delete element.dataset.qbWriteSource;
            }
        });
    }

    window.quickboxResetWidgetState = resetWidgetWriteState;

    window.quickboxSetLocale = (locale: string) => {
        const nextLocale = normalizeLocale(locale);
        window.quickboxLocale = nextLocale;
        window.quickboxServiceIsland?.onLocaleChanged(nextLocale);
        persistLocale(nextLocale);
        resetWidgetWriteState();
        if (socket.connected) {
            socket.emit("i18n", nextLocale);
        }
    };

    function fetchJson(url: string): Promise<unknown> {
        return fetch(window.quickboxWidgetUrl ? window.quickboxWidgetUrl(url) : url, { credentials: "same-origin" })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${url}`);
                }
                return response.json();
            });
    }

    function createStatusTasks(): StatusTask[] {
        const packageManagementTask: StatusTask = {
            key: "PMC",
            url: "/node/data/pmc",
            id: "#pmc_widget",
            bootstrap: false,
            time: 30000,
            override: (data, response, request) => {
                const matchesPending = Boolean(
                    request && response.key === packageManagementTask.key &&
                    response.url === request.url && response.requestId === request.requestId,
                );
                if (matchesPending && window.quickboxPackageManagementIsland?.onMessage(data)) {
                    markWidgetWritten("#pmc_widget", "ws");
                } else {
                    console.warn("[ws] ignored uncorrelated or invalid package-management response,", response);
                }
            },
        };

        return [
            packageManagementTask,
            { key: "NETWORK", url: "/node/net_status", bootstrap: true, time: 1000 },
            { key: "UPTIME", url: "/node/data/system_uptime", id: "#uptime", bootstrap: true, time: 60000 },
            { key: "TOP", url: "/node/data/system_load", id: "#cpuload", bootstrap: true, time: 60000 },
            {
                key: "BANDWIDTH",
                url: "/node/data/bandwidth",
                urlTemplate: "/node/data/bandwidth?page={0}",
                id: "#bw_tables",
                before: (task) => {
                    const page = localStorage.getItem("bw_tables:page");
                    if (page && page.length === 1 && "hdmt".includes(page) && task.urlTemplate) {
                        task.url = task.urlTemplate.replace("{0}", page);
                    }
                    return true;
                },
                bootstrap: true,
                time: 60000,
            },
            { key: "DISK_USAGE", url: "/node/data/disk_data", id: "#disk_data", bootstrap: true, time: 15000 },
            { key: "RAM_USAGE", url: "/node/data/ram_stats", id: "#meterram", bootstrap: true, time: 10000 },
            { key: "TASK_STATUS", url: "/node/data/task_status", id: "#running_task_widget", bootstrap: true, time: 5000 },
            {
                key: "SSH_OUTPUT",
                url: "/db/output.log",
                id: "#sshoutput",
                time: 2000,
                before: (task) => {
                    const sysIsland = window.quickboxSystemResponseIsland;
                    if (!sysIsland || !sysIsland.isOpen()) {
                        return false;
                    }
                    const cursor = sysIsland.getOutputCursor();
                    const requestLength = 65536;
                    if (cursor.end >= 0) {
                        task.url = `/db/output.log?offset=${cursor.end}&length=${requestLength}`;
                    } else {
                        task.url = `/db/output.log?length=${requestLength}`;
                    }
                    if (cursor.epoch !== undefined) {
                        task.url += `&epoch=${encodeURIComponent(cursor.epoch)}`;
                    }
                    return true;
                },
                override: (data) => {
                    window.quickboxSystemResponseIsland?.onMessage(data);
                },
            },
        ];
    }

    function startStatusUpdates() {
        const statusList = createStatusTasks();
        const taskMapping = new Map<string, StatusTask>();
        const pendingRequests = new Map<string, PendingRequestEntry>();
        const pendingRequestByKey = new Map<string, string>();
        let firstRequest = true;
        let errorCountByKey: Record<string, number> = {};
        let stoppedKeys: Record<string, boolean> = {};
        let bootstrapDispatched = false;
        let requestSeq = 0;
        const pendingRequestTimeoutMs = 15000;
        let sshOutputTask: StatusTask | undefined;

        for (const task of statusList) {
            if (taskMapping.has(task.key)) {
                console.warn(`[ws] status config key: ${task.key} duplicated,`, task);
                continue;
            }
            taskMapping.set(task.key, task);
            if (task.key === "SSH_OUTPUT") {
                sshOutputTask = task;
            }
        }

        function clearPendingRequestById(requestId: string) {
            const pending = pendingRequests.get(requestId);
            if (!pending) {
                return;
            }
            clearTimeout(pending.timeoutId);
            if (pendingRequestByKey.get(pending.task.key) === requestId) {
                pendingRequestByKey.delete(pending.task.key);
            }
            pendingRequests.delete(requestId);
        }

        function clearAllPendingRequests(reason: string) {
            const requestIds = [...pendingRequests.keys()];
            requestIds.forEach(clearPendingRequestById);
            if (requestIds.length > 0) {
                console.warn(`[ws] cleared ${requestIds.length} pending request(s): ${reason}`);
            }
        }

        function queueTask(task: StatusTask, delay: number) {
            setTimeout(() => {
                if (stoppedKeys[task.key] || !socket.connected) {
                    return;
                }
                const request: StatusTaskRequest = {
                    ...task,
                    requestId: "",
                    locale: window.quickboxLocale || "en",
                };
                if (request.before && !request.before(request)) {
                    return;
                }
                if (request.id && !document.querySelector(request.id)) {
                    return;
                }
                const pendingRequestId = pendingRequestByKey.get(request.key);
                if (pendingRequestId && pendingRequests.has(pendingRequestId)) {
                    return;
                }
                request.requestId = `${request.key}:${++requestSeq}`;
                const timeoutId = setTimeout(() => {
                    if (pendingRequests.has(request.requestId)) {
                        console.warn(`[ws] request timed out: ${request.requestId}`);
                        clearPendingRequestById(request.requestId);
                        if (socket.connected) {
                            queueTask(task, 0);
                        }
                    }
                }, pendingRequestTimeoutMs);
                pendingRequests.set(request.requestId, { request, task, timeoutId });
                pendingRequestByKey.set(request.key, request.requestId);
                request.locale = window.quickboxLocale || "en";
                socket.send(request);
            }, delay);
        }

        window.addEventListener("quickbox:bandwidth-page-change", () => {
            const task = taskMapping.get("BANDWIDTH");
            if (!task) {
                return;
            }
            const pendingRequestId = pendingRequestByKey.get("BANDWIDTH");
            if (pendingRequestId) {
                clearPendingRequestById(pendingRequestId);
            }
            queueTask(task, 0);
        });

        function dispatchBootstrapTasks() {
            if (bootstrapDispatched) {
                return;
            }
            bootstrapDispatched = true;
            const bootstrapTasks = statusList.filter((task) => task.bootstrap);
            bootstrapTasks.forEach((task, index) => {
                queueTask(task, index * 50);
            });
            const serviceStatusDelay = bootstrapTasks.length * 50 + 100;
            window.quickboxServiceIsland?.onConnected(serviceStatusDelay);
        }

        function dispatchIslandMessage(
            task: StatusTask,
            response: WsMessageResponse,
            request: StatusTaskRequest | undefined,
        ): boolean {
            const matchesPending = Boolean(
                request && response.key === task.key &&
                response.url === request.url && response.requestId === request.requestId,
            );
            const islandHandlers: Partial<Record<string, () => boolean>> = {
                TOP: () => Boolean(window.quickboxSystemSummaryIsland?.onMessage("TOP", response.response)),
                UPTIME: () => Boolean(window.quickboxSystemSummaryIsland?.onMessage("UPTIME", response.response)),
                NETWORK: () => Boolean(window.quickboxNetworkIsland?.onMessage(response.response)),
                BANDWIDTH: () => Boolean(window.quickboxBandwidthIsland?.onMessage(response.response)),
                RAM_USAGE: () => Boolean(window.quickboxMemoryStatsIsland?.onMessage(response.response)),
                DISK_USAGE: () => Boolean(window.quickboxDiskDataIsland?.onMessage(response.response)),
                TASK_STATUS: () => Boolean(window.quickboxRunningTaskIsland?.onMessage(response.response)),
            };
            const handler = islandHandlers[task.key];
            if (!handler) {
                return false;
            }
            if (matchesPending && handler()) {
                if (errorCountByKey[task.key]) {
                    errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
                }
                if (task.key !== "NETWORK" && task.key !== "BANDWIDTH") {
                    markWidgetWritten(task.id, "ws");
                }
            } else {
                console.warn(`[ws] ignored uncorrelated or invalid ${task.key} response,`, response);
            }
            return true;
        }

        function recordTaskFailure(failedKey: string, response: WsMessageResponse) {
            errorCountByKey[failedKey] = (errorCountByKey[failedKey] || 0) + 1;
            console.error("[ws] request failed,", response);
            if (errorCountByKey[failedKey] > 32 && !stoppedKeys[failedKey]) {
                stoppedKeys[failedKey] = true;
                console.warn(`[ws] stopping updates for ${failedKey}`);
                window.quickboxSystemResponseIsland?.notifyWarning("QuickBox", `Stopped status updates for ${failedKey}`);
            }
        }

        socket.on("message", (response: WsMessageResponse) => {
            if (response.meta?.protocolVersion === 2) {
                window.quickboxServiceIsland?.onMessage(response);
                return;
            }
            const pending = response.requestId ? pendingRequests.get(response.requestId) : undefined;
            if (response.requestId && !pending) {
                return;
            }
            const request = pending?.request;
            const task = pending?.task ?? (response.key ? taskMapping.get(response.key) : undefined);
            if (response.requestId) {
                clearPendingRequestById(response.requestId);
            }
            if (!response.success) {
                recordTaskFailure(task?.key || response.key || "unknown", response);
                return;
            }
            if (!task) {
                console.warn("[ws] task config not found,", response);
                return;
            }
            if (dispatchIslandMessage(task, response, request)) {
                return;
            }
            if (errorCountByKey[task.key]) {
                errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
            }
            if (task.override) {
                task.override.call(task, response.response, response, request);
                return;
            }
            console.warn("[ws] response has no dashboard handler,", response);
        });

        socket.on("connect", () => {
            clearAllPendingRequests("socket reconnected");
            errorCountByKey = {};
            stoppedKeys = {};
            bootstrapDispatched = false;
            dispatchBootstrapTasks();
            if (sshOutputTask && window.quickboxSystemResponseIsland?.isOpen()) {
                queueTask(sshOutputTask, 0);
            }
        });
        socket.on("disconnect", () => {
            clearAllPendingRequests("socket disconnected");
            window.quickboxServiceIsland?.onDisconnected();
        });
        socket.on("connect_error", () => {
            clearAllPendingRequests("socket connect error");
            window.quickboxServiceIsland?.onDisconnected();
        });

        if (socket.connected) {
            dispatchBootstrapTasks();
        }

        const taskGroups: Record<string, StatusTask[]> = {};
        for (const task of statusList) {
            const key = String(task.time);
            (taskGroups[key] ??= []).push(task);
        }
        for (const [timeString, taskList] of Object.entries(taskGroups)) {
            const timeInterval = parseInt(timeString, 10);
            const taskEntity = () => {
                let delay = 0;
                for (const task of taskList) {
                    if (firstRequest && task.bootstrap) {
                        continue;
                    }
                    queueTask(task, delay);
                    if (!firstRequest) {
                        delay += timeInterval / (taskList.length * 2);
                    }
                }
            };
            scheduleVisibilityInterval(timeInterval, 10 * timeInterval, taskEntity);
            taskEntity();
        }
        firstRequest = false;
    }

    function showAlert(message: string) {
        window.quickboxSystemResponseIsland?.showAlert(message);
    }

    let inflightExecCount = 0;
    let reloadAfterExec = false;

    function maybeReloadAfterExec() {
        if (reloadAfterExec && inflightExecCount <= 0) {
            location.reload();
        }
    }

    socket.on("exec", (response: ExecResponse | undefined) => {
        inflightExecCount = Math.max(0, inflightExecCount - 1);
        if (response && response.success === false) {
            let message = escapeHtml(response.message || "");
            const rawOutput = response.stdout || response.stderr || "";
            const output = rawOutput ? new AnsiUp().ansi_to_html(rawOutput) : "";
            message += `<br><code>${escapeHtml(response.cmd || "")}</code>`;
            if (output) {
                message += `<hr><div class='exec-output' style='display: inline-grid'>${output}</div>`;
            }
            showAlert(message);
            maybeReloadAfterExec();
            return;
        }
        if (response && response.cmd && (response.cmd.startsWith("systemctl") || response.cmd.startsWith("box:lang"))) {
            reloadAfterExec = true;
        }
        maybeReloadAfterExec();
    });

    function exec(command: unknown) {
        if (typeof command !== "string") {
            showAlert(`Invalid service parameter: '${String(command)}'`);
            return;
        }
        inflightExecCount += 1;
        socket.emit("exec", command);
    }

    window.addEventListener("quickbox:branch-switch", (event: Event) => {
        const detail = (event as CustomEvent<{ branch?: unknown } | undefined>).detail;
        const branch = detail?.branch;
        if (typeof branch !== "string" || !branch || branch.startsWith("-") || branch.includes(":")) {
            return;
        }
        for (let index = 0; index < branch.length; index += 1) {
            const code = branch.charCodeAt(index);
            if (code <= 32 || code === 127) {
                return;
            }
        }
        exec(`box:switch-branch:${branch}`);
    });

    function closestDatasetTarget(initialTarget: EventTarget | null, datasetKey: string): HTMLElement | null {
        let target = initialTarget instanceof HTMLElement ? initialTarget : null;
        while (target && target.dataset[datasetKey] === undefined) {
            target = target.parentElement;
        }
        return target;
    }

    function packageHandler(template: string) {
        return (event: Event) => {
            const target = closestDatasetTarget(event.target, "package");
            if (!target) {
                return;
            }
            exec(`${template}::${target.dataset.package}`);
        };
    }

    function serviceUpdateHandler(event: Event) {
        const target = closestDatasetTarget(event.target, "service");
        if (!target) {
            return;
        }
        const service = target.dataset.service;
        const operations = target.dataset.operation || "";
        for (const operation of operations.split(",")) {
            exec(`systemctl:${operation}:${service}`);
        }
    }

    function boxHandler(event: Event) {
        const target = closestDatasetTarget(event.target, "package");
        if (!target) {
            return;
        }
        exec(`box:${target.dataset.operation}:${target.dataset.package}`);
    }

    window.packageInstallHandler = packageHandler("installpackage");
    window.packageRemoveHandler = packageHandler("removepackage");
    window.serviceUpdateHandler = serviceUpdateHandler;
    window.boxHandler = boxHandler;

    window.quickboxPackageManagementActions = {
        run: (action, packageName) => {
            if (typeof packageName !== "string") {
                return;
            }
            window.quickboxSystemResponseIsland?.open();
            exec(`${action === "install" ? "installpackage::" : "removepackage::"}${packageName}`);
        },
    };

    function loadNodeFragments() {
        fetchJson("/node/data/system_static")
            .then((payload) => {
                const data = payload as { cpu?: unknown; interfaces?: unknown } | null;
                if (data?.cpu && !window.quickboxCpuStatusIsland?.onMessage(data.cpu)) {
                    console.warn("[ws] ignored invalid CPU status response", data.cpu);
                }
                if (!window.quickboxNetworkIsland?.onInterfaces(data ? data.interfaces : [])) {
                    console.warn("[ws] ignored invalid network interface list", data?.interfaces);
                }
            })
            .catch((error: unknown) => {
                console.warn("[ws] failed to load static system info", error);
            });

        fetchJson("/node/data/system_load").then((data) => {
            if (widgetWriteSourceOf("#cpuload") !== "") {
                return;
            }
            if (window.quickboxSystemSummaryIsland?.onPrefetch(data)) {
                markWidgetWritten("#cpuload", "prefetch");
            }
        }).catch(() => { /* WebSocket will fill in later */ });

        fetchJson("/node/data/disk_data").then((data) => {
            if (widgetWriteSourceOf("#disk_data") !== "") {
                return;
            }
            if (window.quickboxDiskDataIsland?.onPrefetch(data)) {
                markWidgetWritten("#disk_data", "prefetch");
            }
        }).catch(() => { /* WebSocket will fill in later */ });

        fetchJson("/node/data/ram_stats").then((data) => {
            if (widgetWriteSourceOf("#meterram") !== "") {
                return;
            }
            if (window.quickboxMemoryStatsIsland?.onPrefetch(data)) {
                markWidgetWritten("#meterram", "prefetch");
            }
        }).catch(() => { /* WebSocket will fill in later */ });
    }

    function bindDomEvents() {
        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const sysResponseTrigger = target.closest("[data-target='#sysResponse'], [data-qb-system-response]");
            if (sysResponseTrigger instanceof HTMLElement) {
                window.quickboxSystemResponseIsland?.open();
            }
            const taskAbortButton = target.closest("[data-task-abort]");
            if (taskAbortButton instanceof HTMLElement) {
                event.preventDefault();
                if (window.confirm(taskAbortButton.dataset.confirm || "Terminate the running task?")) {
                    exec("box:abort:");
                }
                return;
            }
            if (target.closest("[data-click-handler='packageInstall']")) {
                window.packageInstallHandler?.(event);
                return;
            }
            if (target.closest("[data-click-handler='packageRemove']")) {
                window.packageRemoveHandler?.(event);
                return;
            }
            if (target.closest("[data-click-handler='serviceUpdate']")) {
                window.serviceUpdateHandler?.(event);
                return;
            }
            if (target.closest("[data-click-handler='boxHandler']")) {
                window.boxHandler?.(event);
            }
        });

        loadNodeFragments();
        afterPrerendering(startStatusUpdates);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindDomEvents);
    } else {
        bindDomEvents();
    }
}
