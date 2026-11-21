// SPDX-License-Identifier: GPL-3.0-or-later

import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";

import type { DashboardBootstrapPayload, WsPushMode } from "../../../ws/src/shared/bootstrap-contract";
import {
    isServiceActionResult,
    isServiceKey,
    type ServiceActionRequest,
} from "../../../ws/src/shared/service-control-contract";
import {
    DASHBOARD_STREAMS,
    DISK_DATA_URL,
    OUTPUT_LOG_URL,
    RAM_STATS_DATA_URL,
    SYSTEM_LOAD_DATA_URL,
    SYSTEM_STATIC_DATA_URL,
    normalizeBandwidthPage,
    type BandwidthPage,
} from "../../../ws/src/shared/widget-streams";
import {
    isWsExecResult,
    parseWsMessageEnvelope,
    type WidgetArgs,
    type WsSubscribeOptions,
    type WsWidgetRequest,
    type WsWidgetResponse,
} from "../../../ws/src/shared/ws-message";
import i18n, { setLocale } from "../i18n";
import { dataIslandBridges } from "./data-slots";
import { getServiceControlBridge } from "./service-control-client";
import { systemResponseActions } from "./system-response-client";

interface StatusTask {
    key: string;
    url: string;
    id?: string;
    bootstrap?: boolean;
    time: number;
    getArgs?: () => WidgetArgs | null;
    override?: (data: unknown) => void;
}

interface PendingRequestEntry {
    request: WsWidgetRequest;
    task: StatusTask;
    timeoutId: ReturnType<typeof setTimeout>;
}

interface ClientCommandPayloads {
    exec: string;
    "service-action": ServiceActionRequest;
}

interface RuntimeGlobals {
    basePath?: string;
    locale?: string;
    locales?: string[];
    socketUpgrade?: boolean;
    wsPushMode?: WsPushMode;
}

declare global {
    interface Window {
        quickboxRuntime?: DashboardBootstrapPayload;
        quickboxApiBase?: string;
        quickboxLocale?: string;
        quickboxSetLocale?: (locale: string) => void;
        quickboxWidgetUrl?: (url: string) => string;
        quickboxResetWidgetState?: () => void;
        socket?: Socket;
    }
}

const LOCALE_ALIASES: Record<string, string> = {
    "zh-cn": "zh",
    "zh-hans-cn": "zh",
};

export interface BackendRetryState {
    error: string;
    attempt: number;
    maxAttempts: number;
    exhausted: boolean;
}

const MAX_SOCKET_RETRIES = 3;

let activeExecDispatcher: ((command: string) => boolean) | undefined;
let activeLocaleUpdater: ((locale: string) => void) | undefined;
let commandConnected = false;
const connectionListeners = new Set<() => void>();

function subscribeToConnection(listener: () => void) {
    connectionListeners.add(listener);
    return () => { connectionListeners.delete(listener); };
}

function getCommandConnection() {
    return commandConnected;
}

function setCommandConnection(connected: boolean) {
    if (commandConnected === connected) {return;}
    commandConnected = connected;
    connectionListeners.forEach((listener) => { listener(); });
}

export function useCommandConnection() {
    return useSyncExternalStore(subscribeToConnection, getCommandConnection);
}

function notifyCommandConnection(key: "COMMAND_OFFLINE" | "COMMAND_OUTCOME_UNKNOWN") {
    systemResponseActions.notifyWarning(i18n.t("SYSTEM_RESPONSE_TITLE"), i18n.t(key));
}

function executeDashboardCommand(command: string, openModal = false) {
    if (!activeExecDispatcher?.(command)) {
        notifyCommandConnection("COMMAND_OFFLINE");
        return;
    }
    if (openModal) {systemResponseActions.open();}
}

export function executePackageAction(action: "install" | "remove", packageName: string) {
    if (!packageName) {
        return;
    }
    executeDashboardCommand(`${action === "install" ? "installpackage::" : "removepackage::"}${packageName}`, true);
}

export function executeBoxAction(operation: string, target: string, openModal = false) {
    executeDashboardCommand(`box:${operation}:${target}`, openModal);
}

export function abortRunningTask(confirmText: string) {
    if (window.confirm(confirmText || "Terminate the running task?")) {
        executeDashboardCommand("box:abort:");
    }
}

export function switchDashboardBranch(branch: string) {
    if (!branch || branch.startsWith("-") || branch.includes(":")) {
        return;
    }
    for (let index = 0; index < branch.length; index += 1) {
        const code = branch.charCodeAt(index);
        if (code <= 32 || code === 127) {
            return;
        }
    }
    executeDashboardCommand(`box:switch-branch:${branch}`, true);
}

export function updateRuntimeLocale(locale: string) {
    const selectedLocale = setLocale(locale, true);
    activeLocaleUpdater?.(selectedLocale);
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

export function initDashboardRuntime(onConnectionRetry: (retry: BackendRetryState | null) => void) {
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

    const basePath = runtime.basePath ?? "";
    window.quickboxApiBase = basePath;
    window.quickboxLocale = normalizeLocale(window.quickboxLocale);

    window.quickboxWidgetUrl = (url: string) => {
        const separator = url.includes("?") ? "&" : "?";
        return `${window.quickboxApiBase ?? ""}${url}${separator}locale=${encodeURIComponent(window.quickboxLocale ?? "en")}`;
    };

    function resolveWsPushMode(): WsPushMode {
        const queryMode = new URLSearchParams(window.location.search).get("pushMode");
        if (queryMode === "poll" || queryMode === "push") {
            return queryMode;
        }
        try {
            const stored = localStorage.getItem("quickbox:ws-push-mode");
            if (stored === "poll" || stored === "push") {
                return stored;
            }
        } catch {
            // ignore storage errors
        }
        return runtime?.wsPushMode === "poll" ? "poll" : "push";
    }

    const wsPushMode = resolveWsPushMode();

    const socket = io(location.origin, {
        path: `${window.quickboxApiBase}/socket.io`,
        upgrade: runtime.socketUpgrade !== false,
        autoConnect: false,
        reconnectionAttempts: MAX_SOCKET_RETRIES,
        timeout: 10000,
    });
    window.socket = socket;

    let reconnectAttempt = 0;
    let connectionError = "";
    function reportConnectionRetry(exhausted: boolean) {
        onConnectionRetry({
            error: connectionError,
            attempt: exhausted ? reconnectAttempt : Math.max(1, reconnectAttempt),
            maxAttempts: MAX_SOCKET_RETRIES,
            exhausted,
        });
    }

    socket.on("disconnect", (reason) => {
        reconnectAttempt = 0;
        connectionError = reason;
        reportConnectionRetry(!socket.active);
    });
    socket.on("connect_error", (error) => {
        const status = "description" in error ? error.description : undefined;
        connectionError = typeof status === "number" && status > 0
            ? `${error.message} (${status})`
            : error.message;
        reportConnectionRetry(!socket.active);
    });
    socket.io.on("reconnect_attempt", (attempt) => {
        reconnectAttempt = attempt;
        reportConnectionRetry(false);
    });
    socket.io.on("reconnect_failed", () => {
        reportConnectionRetry(true);
    });

    function emitCommand<E extends keyof ClientCommandPayloads>(event: E, payload: ClientCommandPayloads[E]): boolean {
        if (!socket.connected) {return false;}
        socket.emit(event, payload);
        return true;
    }
    setCommandConnection(socket.connected);
    socket.on("connect", () => {
        reconnectAttempt = 0;
        onConnectionRetry(null);
        setCommandConnection(true);
    });

    function getBandwidthPage(): BandwidthPage {
        try {
            return normalizeBandwidthPage(localStorage.getItem("bw_tables:page"));
        } catch {
            return "t";
        }
    }

    function sendSubscribe() {
        if (!socket.connected) {
            return;
        }
        socket.emit("ws:subscribe", {
            mode: wsPushMode,
            bandwidthPage: getBandwidthPage(),
            hidden: document.hidden,
        } satisfies WsSubscribeOptions);
    }

    getServiceControlBridge()?.bindTransport({
        isConnected: () => socket.connected,
        pushMode: wsPushMode,
        sendMessage: (request) => { socket.send(request); },
        executeServiceAction: (request) => {
            const sent = emitCommand("service-action", request);
            if (!sent) {notifyCommandConnection("COMMAND_OFFLINE");}
            return sent;
        },
        notifyStopped: (key) => {
            console.warn(`[ws] stopping updates for ${key}`);
            systemResponseActions.notifyWarning("QuickBox", `Stopped status updates for ${key}`);
        },
    });

    socket.on("service-action-result", (response: unknown) => {
        if (isServiceActionResult(response)) {
            getServiceControlBridge()?.onActionResult(response);
        }
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

    const handleLocaleChange = (locale: string) => {
        const nextLocale = normalizeLocale(locale);
        window.quickboxLocale = nextLocale;
        getServiceControlBridge()?.onLocaleChanged(nextLocale);
    };
    activeLocaleUpdater = handleLocaleChange;
    window.quickboxSetLocale = updateRuntimeLocale;

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
        const widgetTasks: StatusTask[] = DASHBOARD_STREAMS
            .filter((stream) => stream.group === "widget")
            .map((stream): StatusTask => ({
                key: stream.key,
                url: stream.url,
                ...(stream.elementId ? { id: stream.elementId } : {}),
                bootstrap: Boolean(stream.bootstrap),
                time: stream.activeVisibleMs ?? stream.visibleMs,
                ...(stream.param === "bandwidthPage"
                    ? { getArgs: () => ({ page: getBandwidthPage() }) }
                    : {}),
            }));

        return [
            ...widgetTasks,
            {
                key: "SSH_OUTPUT",
                url: OUTPUT_LOG_URL,
                id: "#sshoutput",
                time: 2000,
                getArgs: () => {
                    if (!systemResponseActions.isOpen()) {
                        return null;
                    }
                    const { end, epoch } = systemResponseActions.getOutputCursor();
                    return { offset: end >= 0 ? end : undefined, length: 65536, epoch };
                },
                override: (data) => {
                    systemResponseActions.onMessage(data);
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

        function buildSshOutputUrl(args: WidgetArgs | undefined): string {
            if (!args) {
                return OUTPUT_LOG_URL;
            }
            const params = new URLSearchParams();
            if (args.offset !== undefined) {
                params.set("offset", String(args.offset));
            }
            if (args.length !== undefined) {
                params.set("length", String(args.length));
            }
            if (args.epoch !== undefined) {
                params.set("epoch", args.epoch);
            }
            const query = params.toString();
            return query ? `${OUTPUT_LOG_URL}?${query}` : OUTPUT_LOG_URL;
        }

        function queueTask(task: StatusTask, delay: number) {
            setTimeout(() => {
                if (stoppedKeys[task.key] || !socket.connected) {
                    return;
                }
                const args = task.getArgs?.();
                if (args === null || (task.id && !document.querySelector(task.id))) {
                    return;
                }
                const pendingRequestId = pendingRequestByKey.get(task.key);
                if (pendingRequestId && pendingRequests.has(pendingRequestId)) {
                    return;
                }
                const url = task.key === "SSH_OUTPUT" ? buildSshOutputUrl(args) : task.url;
                const request: WsWidgetRequest = { type: "request", key: task.key, url, args, requestId: `${task.key}:${++requestSeq}` };
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
                socket.send(request);
            }, delay);
        }

        window.addEventListener("quickbox:bandwidth-page-change", () => {
            if (wsPushMode === "push") {
                sendSubscribe();
                return;
            }
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
            sendSubscribe();
            if (wsPushMode === "push") {
                getServiceControlBridge()?.onConnected(0);
                return;
            }
            const bootstrapTasks = statusList.filter((task) => task.bootstrap);
            bootstrapTasks.forEach((task, index) => {
                queueTask(task, index * 50);
            });
            const serviceStatusDelay = bootstrapTasks.length * 50 + 100;
            getServiceControlBridge()?.onConnected(serviceStatusDelay);
        }

        function isCorrelatedResponse(
            task: StatusTask,
            response: WsWidgetResponse,
            request: WsWidgetRequest | undefined,
        ): boolean {
            if (response.type === "push") {
                return response.key === task.key && response.url === task.url &&
                    (task.key !== "BANDWIDTH" || response.args?.page === getBandwidthPage());
            }
            return Boolean(
                request && response.key === task.key &&
                response.url === request.url &&
                (response.requestId === request.requestId || (task.key === "SSH_OUTPUT" && response.requestId === "")),
            );
        }

        function dispatchIslandMessage(
            task: StatusTask,
            response: WsWidgetResponse,
            request: WsWidgetRequest | undefined,
        ): boolean {
            const islandHandlers: Partial<Record<string, () => boolean>> = {
                PMC: () => dataIslandBridges.packageManagement.onMessage(response.response),
                TOP: () => dataIslandBridges.systemSummary.onMessage("TOP", response.response),
                UPTIME: () => dataIslandBridges.systemSummary.onMessage("UPTIME", response.response),
                NETWORK: () => dataIslandBridges.network.onMessage(response.response),
                BANDWIDTH: () => dataIslandBridges.bandwidth.onMessage(response.response),
                RAM_USAGE: () => dataIslandBridges.memoryStats.onMessage(response.response),
                DISK_USAGE: () => dataIslandBridges.diskData.onMessage(response.response),
                TASK_STATUS: () => dataIslandBridges.runningTask.onMessage(response.response),
            };
            const handler = islandHandlers[task.key];
            if (!handler) {
                return false;
            }
            if (isCorrelatedResponse(task, response, request) && handler()) {
                if (response.success && errorCountByKey[task.key]) {
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

        function recordTaskFailure(failedKey: string, response: WsWidgetResponse) {
            errorCountByKey[failedKey] = (errorCountByKey[failedKey] || 0) + 1;
            console.error("[ws] request failed,", response);
            if (response.type === "reply" && errorCountByKey[failedKey] > 32 && !stoppedKeys[failedKey]) {
                stoppedKeys[failedKey] = true;
                console.warn(`[ws] stopping updates for ${failedKey}`);
                systemResponseActions.notifyWarning("QuickBox", `Stopped status updates for ${failedKey}`);
            }
        }

        socket.on("message", (rawResponse: unknown) => {
            const response = parseWsMessageEnvelope(rawResponse);
            if (!response) {
                return;
            }
            if (response.type === "protocol-error") {
                console.error("[ws] invalid request:", response.message);
                return;
            }
            if (response.type === "push" && wsPushMode !== "push") {
                return;
            }
            if (isServiceKey(response.key)) {
                getServiceControlBridge()?.onMessage(response);
                return;
            }
            const replyRequestId = response.type === "reply"
                ? (response.requestId || (response.key === "SSH_OUTPUT" ? pendingRequestByKey.get("SSH_OUTPUT") : undefined))
                : undefined;
            const pending = replyRequestId ? pendingRequests.get(replyRequestId) : undefined;
            if (response.type === "reply" && !pending) {
                return;
            }
            const request = pending?.request;
            const task = pending?.task ?? taskMapping.get(response.key);
            if (replyRequestId) {
                clearPendingRequestById(replyRequestId);
            }
            if (!response.success) {
                if (task && response.type === "push" && response.stale) {
                    dispatchIslandMessage(task, response, request);
                }
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
            if (task.override && isCorrelatedResponse(task, response, request)) {
                task.override(response.response);
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
            if (sshOutputTask && systemResponseActions.isOpen()) {
                queueTask(sshOutputTask, 0);
            }
        });
        socket.on("disconnect", () => {
            clearAllPendingRequests("socket disconnected");
        });
        socket.on("connect_error", () => {
            clearAllPendingRequests("socket connect error");
        });

        if (socket.connected) {
            dispatchBootstrapTasks();
        }

        if (wsPushMode === "push") {
            document.addEventListener("visibilitychange", () => {
                sendSubscribe();
            });
            if (sshOutputTask) {
                const logTask = sshOutputTask;
                scheduleVisibilityInterval(logTask.time, 10 * logTask.time, () => {
                    queueTask(logTask, 0);
                });
            }
            return;
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

    let inflightExecCount = 0;
    let reloadAfterExec = false;

    function handleCommandDisconnect() {
        setCommandConnection(false);
        const hadPendingServiceActions = getServiceControlBridge()?.onDisconnected();
        if (inflightExecCount > 0 || hadPendingServiceActions) {
            notifyCommandConnection("COMMAND_OUTCOME_UNKNOWN");
        }
        inflightExecCount = 0;
        reloadAfterExec = false;
    }
    socket.on("disconnect", handleCommandDisconnect);
    socket.on("connect_error", handleCommandDisconnect);

    function maybeReloadAfterExec() {
        if (reloadAfterExec && inflightExecCount <= 0) {
            location.reload();
        }
    }

    socket.on("exec", (response: unknown) => {
        inflightExecCount = Math.max(0, inflightExecCount - 1);
        if (!isWsExecResult(response)) {
            maybeReloadAfterExec();
            return;
        }
        if (!response.success) {
            const rawOutput = response.stdout || response.stderr || "";
            systemResponseActions.showAlert({
                message: response.message,
                command: response.cmd,
                ...(rawOutput ? { output: rawOutput, outputIsAnsi: true } : {}),
            });
            maybeReloadAfterExec();
            return;
        }
        if (response.cmd.startsWith("systemctl") || response.cmd.startsWith("box:lang")) {
            reloadAfterExec = true;
        }
        maybeReloadAfterExec();
    });

    function exec(command: string): boolean {
        if (!emitCommand("exec", command)) {return false;}
        inflightExecCount += 1;
        return true;
    }
    activeExecDispatcher = exec;

    function loadNodeFragments() {
        fetchJson(SYSTEM_STATIC_DATA_URL)
            .then((payload) => {
                const data = payload as { cpu?: unknown; interfaces?: unknown } | null;
                if (data?.cpu && !dataIslandBridges.cpuStatus.onMessage(data.cpu)) {
                    console.warn("[ws] ignored invalid CPU status response", data.cpu);
                }
                if (!dataIslandBridges.network.onInterfaces(data ? data.interfaces : [])) {
                    console.warn("[ws] ignored invalid network interface list", data?.interfaces);
                }
            })
            .catch((error: unknown) => {
                console.warn("[ws] failed to load static system info", error);
            });

        fetchJson(SYSTEM_LOAD_DATA_URL).then((data) => {
            if (widgetWriteSourceOf("#cpuload") !== "") {
                return;
            }
            if (dataIslandBridges.systemSummary.onPrefetch(data)) {
                markWidgetWritten("#cpuload", "prefetch");
            }
        }).catch(() => { /* WebSocket will fill in later */ });

        fetchJson(DISK_DATA_URL).then((data) => {
            if (widgetWriteSourceOf("#disk_data") !== "") {
                return;
            }
            if (dataIslandBridges.diskData.onPrefetch(data)) {
                markWidgetWritten("#disk_data", "prefetch");
            }
        }).catch(() => { /* WebSocket will fill in later */ });

        fetchJson(RAM_STATS_DATA_URL).then((data) => {
            if (widgetWriteSourceOf("#meterram") !== "") {
                return;
            }
            if (dataIslandBridges.memoryStats.onPrefetch(data)) {
                markWidgetWritten("#meterram", "prefetch");
            }
        }).catch(() => { /* WebSocket will fill in later */ });
    }

    function startRuntime() {
        loadNodeFragments();
        afterPrerendering(startStatusUpdates);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startRuntime);
    } else {
        startRuntime();
    }
    socket.connect();

    return () => {
        if (socket.connected) {return;}
        reconnectAttempt = 0;
        reportConnectionRetry(false);
        socket.disconnect().connect();
    };
}
