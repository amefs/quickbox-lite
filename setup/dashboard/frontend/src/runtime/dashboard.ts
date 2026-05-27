// SPDX-License-Identifier: GPL-3.0-or-later

import type { DashboardRuntimeConfig } from "@quickbox-dashboard/shared";
import type { Socket } from "socket.io-client";

type BootboxLike = {
    alert(options: { message: string; backdrop: boolean; size: string }): void;
};

type AnsiUpCtor = new () => {
    ansi_to_html(value: string): string;
};

type PerfectScrollbarCtor = new (element: Element) => {
    update(): void;
};

type VisibilityLike = {
    afterPrerendering(callback: () => void): void;
    every(visibleInterval: number, hiddenInterval: number, callback: () => void): unknown;
};

type DashboardDeps = {
    $: JQueryStatic;
    io: (uri: string, opts: { path: string }) => Socket;
    bootbox: BootboxLike;
    AnsiUp: unknown;
    PerfectScrollbar: unknown;
    Visibility: VisibilityLike;
};

type DashboardWindow = Window & {
    quickboxRuntime?: DashboardRuntimeConfig;
    quickboxApiBase: string;
    quickboxLocale: string;
    quickboxMessages: Record<string, string>;
    quickboxSetLocale(locale: string): void;
    quickboxWidgetUrl(url: string): string;
    socket?: Socket;
    packageInstallHandler(event: Event): void;
    packageRemoveHandler(event: Event): void;
    serviceUpdateHandler(event: Event): void;
    boxHandler(event: Event): void;
    ts?: number;
    net?: Record<string, { tx_bytes: number; rx_bytes: number }>;
    netInterfaceCells?: Record<string, { tx: HTMLElement; rx: HTMLElement }>;
    __psSysPre?: { update(): void };
};

type StatusTask = {
    key: string;
    url: string;
    id?: string;
    time: number;
    bootstrap?: boolean;
    before?: (task: StatusTask) => boolean;
    after?: (task: StatusTask) => void;
    override?: (this: StatusTask, response: unknown) => void;
    urlTemplate?: string;
    requestId?: string;
    locale?: string;
    _endOffset?: number;
    _requestLength?: number;
    _rawContent?: string;
};

const supportedLocales = ["da", "de", "en", "es", "fr", "zh"];
const localeAliases: Record<string, string> = { "zh-cn": "zh", "zh-hans-cn": "zh" };

function normalizeLocale(value: unknown) {
    if (typeof value !== "string") {
        return "en";
    }
    const normalized = localeAliases[value.toLowerCase().replace(/_/g, "-").replace(/^lang-/, "")]
        ?? value.toLowerCase().replace(/_/g, "-").replace(/^lang-/, "");
    if (supportedLocales.includes(normalized)) {
        return normalized;
    }
    const primaryLocale = normalized.split("-")[0];
    return supportedLocales.includes(primaryLocale) ? primaryLocale : "en";
}

function persistLocale(locale: string) {
    localStorage.setItem("quickbox:locale", locale);
    document.cookie = `quickbox_locale=${encodeURIComponent(locale)}; Path=/; SameSite=Lax`;
}

function formatNetworkSpeed(length: number) {
    const suffixList = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
    let numeric = Number(length);
    let idx = 0;
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return "0 B/s";
    }
    while (numeric >= 1024 && idx < suffixList.length - 1) {
        numeric /= 1024;
        idx += 1;
    }
    return `${numeric.toFixed(idx > 0 ? 2 : 0)} ${suffixList[idx]}`;
}

function closestDatasetTarget(initialTarget: EventTarget | null, datasetKey: string) {
    let target = initialTarget instanceof HTMLElement ? initialTarget : null;
    while (target && target.dataset[datasetKey] === undefined) {
        target = target.parentElement;
    }
    return target;
}

function appendSmallOption(container: HTMLElement | null, element: HTMLElement) {
    if (!container) {
        return;
    }
    const wrapper = document.createElement("small");
    wrapper.appendChild(element);
    container.appendChild(wrapper);
}

function groupByTime(tasks: StatusTask[]) {
    return tasks.reduce<Record<string, StatusTask[]>>((mapping, task) => {
        const key = String(task.time);
        mapping[key] = mapping[key] || [];
        mapping[key].push(task);
        return mapping;
    }, {});
}

export function initializeDashboardRuntime(deps: DashboardDeps) {
    const { $, io, bootbox, AnsiUp, PerfectScrollbar, Visibility } = deps;
    const AnsiUpClass = AnsiUp as AnsiUpCtor;
    const PerfectScrollbarClass = PerfectScrollbar as PerfectScrollbarCtor;
    const dashboardWindow = window as unknown as DashboardWindow;
    const runtime = dashboardWindow.quickboxRuntime;
    const messages = runtime && typeof runtime.messages === "object" ? runtime.messages : {};

    dashboardWindow.quickboxApiBase = typeof runtime?.basePath === "string" ? runtime.basePath : "";
    dashboardWindow.quickboxLocale = normalizeLocale(runtime?.locale);
    dashboardWindow.quickboxMessages = { enabled: "Enabled", disabled: "Disabled", refresh: "Refresh", ...messages };
    persistLocale(dashboardWindow.quickboxLocale);

    const widgetUrl = (url: string) => {
        const separator = url.includes("?") ? "&" : "?";
        return `${dashboardWindow.quickboxApiBase}${url}${separator}locale=${encodeURIComponent(dashboardWindow.quickboxLocale)}`;
    };

    dashboardWindow.quickboxWidgetUrl = widgetUrl;
    dashboardWindow.quickboxSetLocale = (locale: string) => {
        dashboardWindow.quickboxLocale = normalizeLocale(locale);
        persistLocale(dashboardWindow.quickboxLocale);
        if (dashboardWindow.socket?.connected) {
            dashboardWindow.socket.emit("i18n", dashboardWindow.quickboxLocale);
        }
    };

    const socket = io(location.origin, { path: `${dashboardWindow.quickboxApiBase || ""}/socket.io` });
    dashboardWindow.socket = socket;
    socket.on("connect", () => {
        socket.emit("i18n", dashboardWindow.quickboxLocale || "en");
    });

    const fetchJson = (url: string) => fetch(widgetUrl(url), { credentials: "same-origin" }).then((response) => {
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`);
        }
        return response.json() as Promise<any>;
    });

    const showAlert = (message: string) => {
        if (bootbox && typeof bootbox.alert === "function") {
            bootbox.alert({ message, backdrop: true, size: "large" });
            return;
        }
        window.alert(message);
    };

    const serviceStatusItems = [
        ["resilio-sync", "#appstat_resilio-sync"],
        ["smbd", "#appstat_smbd"],
        ["deluged", "#appstat_deluged"],
        ["deluge-web", "#appstat_deluge-web"],
        ["denyhosts", "#appstat_denyhosts"],
        ["emby-server", "#appstat_emby-server"],
        ["fail2ban", "#appstat_fail2ban"],
        ["filebrowser", "#appstat_filebrowser"],
        ["filebrowser-ee", "#appstat_filebrowser-ee"],
        ["flexget", "#appstat_flexget"],
        ["flood", "#appstat_flood"],
        ["jellyfin", "#appstat_jellyfin"],
        ["irssi", "#appstat_irssi"],
        ["netdata", "#appstat_netdata"],
        ["nfs-server", "#appstat_nfs-server"],
        ["tightvnc", "#appstat_tightvnc"],
        ["openvpn", "#appstat_openvpn"],
        ["peerbanhelper", "#appstat_peerbanhelper"],
        ["plexmediaserver", "#appstat_plexmediaserver"],
        ["rclone-web", "#appstat_rclone-web"],
        ["rtorrent", "#appstat_rtorrent"],
        ["sabnzbd", "#appstat_sabnzbd"],
        ["syncthing", "#appstat_syncthing"],
        ["transmission", "#appstat_transmission"],
        ["qbittorrent", "#appstat_qbittorrent"],
        ["qbittorrent-clientblocker", "#appstat_qbittorrent-clientblocker"],
        ["webdav", "#appstat_webdav"],
        ["vsftpd", "#appstat_vsftpd"],
        ["ttyd", "#appstat_ttyd"],
        ["x2go", "#appstat_x2go"],
        ["znc", "#appstat_znc"],
    ].map(([service, id]) => ({ service, id }));
    const lastServiceStatusResponse: Record<string, string> = {};

    const ensureServiceStatusPlaceholders = () => {
        serviceStatusItems.forEach((item) => {
            const status = $(item.id);
            const cached = lastServiceStatusResponse[item.service];
            if (status.length > 0 && status.html() === "" && cached) {
                status.html(cached);
            }
        });
    };

    const updateServiceStatus = (response: unknown) => {
        if (!response || typeof response !== "object") {
            ensureServiceStatusPlaceholders();
            return;
        }
        const values = response as Record<string, string>;
        Object.keys(values).forEach((service) => {
            if (values[service] !== undefined && values[service] !== "") {
                lastServiceStatusResponse[service] = values[service];
            }
        });
        serviceStatusItems.forEach((item) => {
            if (values[item.service] !== undefined) {
                $(item.id).html(values[item.service] || lastServiceStatusResponse[item.service] || "");
            }
        });
        ensureServiceStatusPlaceholders();
    };

    const initializeServiceToggles = () => {
        ensureServiceStatusPlaceholders();
        $(".toggle-en, .toggle-dis").each(function (this: HTMLElement) {
            const toggle = $(this);
            if (toggle.parent(".toggle-slide").length > 0 || toggle.parent(".toggle-modern").length > 0) {
                return;
            }
            (toggle as any).toggles({
                on: toggle.hasClass("toggle-en"),
                height: 26,
                width: 100,
                text: toggle.hasClass("toggle-en")
                    ? { on: dashboardWindow.quickboxMessages.enabled }
                    : { off: dashboardWindow.quickboxMessages.disabled },
            });
        });
        $(".tooltips").tooltip();
    };

    const initializePackageTable = () => {
        let currentPage = 0;
        const dataTableApi = ($.fn as any).DataTable;
        if (dataTableApi.isDataTable("#dataTable1")) {
            currentPage = $("#dataTable1").DataTable().page();
            $("#dataTable1").DataTable().destroy();
        }
        const table = $("#dataTable1").DataTable();
        $(table.table().container()).find("input[type='search']").attr({
            id: "dataTable1-search",
            name: "dataTable1-search",
        });
        if (currentPage > 0) {
            table.page(currentPage).draw(false);
        }
        $(".tooltips").tooltip();
    };

    const updateNetworkStatus = (dataJSON: any) => {
        if (dashboardWindow.ts === undefined || dashboardWindow.net === undefined) {
            dashboardWindow.net = dataJSON.net;
            dashboardWindow.ts = dataJSON.ts;
            return;
        }
        const duration = dataJSON.ts - dashboardWindow.ts;
        if (duration < 1e-5) {
            return;
        }
        let invalidData = false;
        Object.keys(dataJSON.net).forEach((networkInterface) => {
            const ifaceCells = dashboardWindow.netInterfaceCells?.[networkInterface];
            const previous = dashboardWindow.net?.[networkInterface];
            const current = dataJSON.net[networkInterface];
            if (!previous || !current) {
                invalidData = true;
                return;
            }
            const outSpeed = (current.tx_bytes - previous.tx_bytes) / duration;
            const inSpeed = (current.rx_bytes - previous.rx_bytes) / duration;
            if (Number.isNaN(outSpeed) || Number.isNaN(inSpeed)) {
                invalidData = true;
                return;
            }
            if (ifaceCells?.tx) {
                ifaceCells.tx.textContent = formatNetworkSpeed(outSpeed);
            }
            if (ifaceCells?.rx) {
                ifaceCells.rx.textContent = formatNetworkSpeed(inSpeed);
            }
        });
        if (!invalidData) {
            dashboardWindow.net = dataJSON.net;
            dashboardWindow.ts = dataJSON.ts;
        }
    };

    const updateSshOutput = (task: StatusTask, response: any) => {
        const element = $(task.id ?? "");
        if (typeof response === "object" && response !== null && "content" in response) {
            const previousEnd = task._endOffset ?? -1;
            if (previousEnd < 0 || response.end < previousEnd || response.start > previousEnd) {
                task._rawContent = response.content;
                task._endOffset = response.end;
            } else if (response.end > previousEnd && response.content) {
                const overlap = Math.max(0, previousEnd - response.start);
                const nextContent = overlap > 0 ? response.content.slice(overlap) : response.content;
                if (nextContent) {
                    task._rawContent = (task._rawContent || "") + nextContent;
                }
                task._endOffset = response.end;
            }
            element.html(new AnsiUpClass().ansi_to_html(task._rawContent || ""));
        } else {
            task._rawContent = "";
            task._endOffset = -1;
            element.html(new AnsiUpClass().ansi_to_html(String(response ?? "")));
        }
        dashboardWindow.__psSysPre?.update();
        const container = document.getElementById("sysPre");
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    };

    const createStatusTasks = (): StatusTask[] => [
        { key: "SERVICE_STATUS_ALL", url: "/node/service_status_all", override: updateServiceStatus, bootstrap: false, time: 5000 },
        {
            key: "SERVICE_CONTROL",
            url: "/node/service_control",
            id: "#service_control_widget",
            after: initializeServiceToggles,
            bootstrap: $("#service_control_widget [data-inner-id='panel-server-service-control']").length === 0,
            time: 15000,
        },
        {
            key: "PMC",
            url: "/node/pmc",
            id: "#pmc_widget",
            after: initializePackageTable,
            bootstrap: $("#pmc_widget [data-inner-id='panel-server-package-management']").length === 0,
            time: 30000,
        },
        { key: "NETWORK", url: "/node/net_status", override: updateNetworkStatus, bootstrap: true, time: 1000 },
        { key: "UPTIME", url: "/node/up", id: "#uptime", bootstrap: true, time: 60000 },
        { key: "TOP", url: "/node/load", id: "#cpuload", bootstrap: true, time: 60000 },
        {
            key: "BANDWIDTH",
            url: "/node/bw_tables",
            urlTemplate: "/node/bw_tables?page={0}",
            id: "#bw_tables",
            before: (task) => {
                const page = localStorage.getItem("bw_tables:page");
                if (page && page.length === 1 && "shdmt".includes(page) && task.urlTemplate) {
                    task.url = task.urlTemplate.replace("{0}", page);
                }
                return true;
            },
            bootstrap: true,
            time: 60000,
        },
        { key: "DISK_USAGE", url: "/node/disk_data", id: "#disk_data", bootstrap: true, time: 15000 },
        { key: "RAM_USAGE", url: "/node/ram_stats", id: "#meterram", bootstrap: true, time: 10000 },
        {
            key: "SSH_OUTPUT",
            url: "/db/output.log",
            id: "#sshoutput",
            time: 2000,
            _endOffset: -1,
            _requestLength: 65536,
            before: (task) => {
                if (!$("#sysResponse").is(":visible")) {
                    return false;
                }
                task.url = (task._endOffset ?? -1) >= 0
                    ? `/db/output.log?offset=${task._endOffset}&length=${task._requestLength}`
                    : `/db/output.log?length=${task._requestLength}`;
                return true;
            },
            override(this: StatusTask, response) {
                updateSshOutput(this, response);
            },
        },
    ];

    const startStatusUpdates = () => {
        const statusList = createStatusTasks();
        const taskMapping: Record<string, StatusTask> = {};
        const pendingRequests: Record<string, { request: StatusTask; task: StatusTask; timeoutId: number }> = {};
        const pendingRequestByKey: Record<string, string> = {};
        let firstRequest = true;
        let errorCount = 0;
        let bootstrapDispatched = false;
        let requestSeq = 0;
        const pendingRequestTimeoutMs = 15000;

        statusList.forEach((task) => {
            taskMapping[task.key] = task;
        });

        const clearPendingRequestById = (requestId: string) => {
            const pending = pendingRequests[requestId];
            if (!pending) {
                return;
            }
            clearTimeout(pending.timeoutId);
            if (pendingRequestByKey[pending.task.key] === requestId) {
                delete pendingRequestByKey[pending.task.key];
            }
            delete pendingRequests[requestId];
        };

        const clearAllPendingRequests = () => {
            Object.keys(pendingRequests).forEach(clearPendingRequestById);
        };

        const queueTask = (task: StatusTask, delay: number) => {
            window.setTimeout(() => {
                const request: StatusTask = { ...task };
                if (request.before?.(request) === false) {
                    return;
                }
                if (!((request.id && $(request.id).length > 0) || request.override)) {
                    return;
                }
                const pendingRequestId = pendingRequestByKey[request.key];
                if (pendingRequestId && pendingRequests[pendingRequestId]) {
                    return;
                }
                request.requestId = `${request.key}:${++requestSeq}`;
                const timeoutId = window.setTimeout(() => {
                    if (request.requestId && pendingRequests[request.requestId]) {
                        clearPendingRequestById(request.requestId);
                        if (socket.connected) {
                            queueTask(task, 0);
                        }
                    }
                }, pendingRequestTimeoutMs);
                pendingRequests[request.requestId] = { request, task, timeoutId };
                pendingRequestByKey[request.key] = request.requestId;
                request.locale = dashboardWindow.quickboxLocale || "en";
                socket.send(request);
            }, delay);
        };

        const dispatchBootstrapTasks = () => {
            if (bootstrapDispatched) {
                return;
            }
            bootstrapDispatched = true;
            const bootstrapTasks = statusList.filter((task) => task.bootstrap);
            bootstrapTasks.forEach((task, index) => queueTask(task, index * 50));
            if (taskMapping.SERVICE_STATUS_ALL) {
                queueTask(taskMapping.SERVICE_STATUS_ALL, bootstrapTasks.length * 50 + 100);
            }
        };

        socket.on("message", (response: any) => {
            const pending = response.requestId ? pendingRequests[response.requestId] : undefined;
            const task = pending ? pending.task : taskMapping[response.key];
            if (response.requestId) {
                clearPendingRequestById(response.requestId);
            }
            if (response.success) {
                if (!task) {
                    return;
                }
                if (task.override) {
                    task.override.call(task, response.response);
                } else if (task.id !== undefined) {
                    $(task.id).html(response.response);
                    task.after?.(task);
                }
                return;
            }
            errorCount += 1;
            console.error("[ws] request failed,", response);
            if (errorCount > 256) {
                socket.close();
            }
        });

        socket.on("connect", () => {
            clearAllPendingRequests();
            bootstrapDispatched = false;
            dispatchBootstrapTasks();
        });
        socket.on("disconnect", clearAllPendingRequests);
        socket.on("connect_error", clearAllPendingRequests);

        if (socket.connected) {
            dispatchBootstrapTasks();
        }

        const taskInfo = groupByTime(statusList);
        Object.keys(taskInfo).forEach((timeString) => {
            const timeInterval = Number.parseInt(timeString, 10);
            const taskList = taskInfo[timeString];
            const taskEntity = () => {
                let delay = 0;
                taskList.forEach((task) => {
                    if (firstRequest && (task.bootstrap || task.key === "SERVICE_STATUS_ALL")) {
                        return;
                    }
                    queueTask(task, delay);
                    if (!firstRequest) {
                        delay += timeInterval / (taskList.length * 2);
                    }
                });
            };
            Visibility.every(timeInterval, 10 * timeInterval, taskEntity);
            taskEntity();
        });
        firstRequest = false;
    };

    const exec = (command: string) => {
        if (typeof command !== "string") {
            showAlert(`Invalid service parameter: '${command}'`);
            return;
        }
        socket.emit("exec", command);
    };

    const packageHandler = (template: string) => (event: Event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target?.dataset) {
            return;
        }
        exec(`${template}::${target.dataset.package}`);
    };

    const serviceUpdateHandler = (event: Event) => {
        const target = closestDatasetTarget(event.target, "service");
        if (!target?.dataset) {
            return;
        }
        const service = target.dataset.service;
        const operations = target.dataset.operation || "";
        operations.split(",").forEach((operation) => exec(`systemctl:${operation}:${service}`));
    };

    const boxHandler = (event: Event) => {
        const target = closestDatasetTarget(event.target, "package");
        if (!target?.dataset) {
            return;
        }
        exec(`box:${target.dataset.operation}:${target.dataset.package}`);
    };

    dashboardWindow.packageInstallHandler = packageHandler("installpackage");
    dashboardWindow.packageRemoveHandler = packageHandler("removepackage");
    dashboardWindow.serviceUpdateHandler = serviceUpdateHandler;
    dashboardWindow.boxHandler = boxHandler;

    socket.on("exec", (response: any) => {
        if (response?.success === false) {
            let output = response.stdout || response.stderr || "";
            output = output.replace(/\\u001b[()][B0UK]/g, "");
            if (output) {
                output = new AnsiUpClass().ansi_to_html(output);
            }
            showAlert(`${response.message || ""}<br><code>${response.cmd}</code>${output ? `<hr><div class='exec-output' style='display: inline-grid'>${output}</div>` : ""}`);
            return;
        }
        if (response?.cmd && (response.cmd.indexOf("systemctl") === 0 || response.cmd.indexOf("box:lang") === 0)) {
            setTimeout(() => location.reload(), 100);
        }
    });

    const renderDashboardConfig = (payload: any) => {
        const langContainer = document.getElementById("node-language-options");
        const themeContainer = document.getElementById("node-theme-options");
        const bwContainer = document.getElementById("node-bw-page-options");

        if (langContainer && Array.isArray(payload.languages)) {
            langContainer.innerHTML = "";
            payload.languages.forEach((lang: any) => {
                const option = document.createElement("div");
                option.style.cursor = "pointer";
                option.dataset.locale = lang.key;
                option.onclick = () => {
                    dashboardWindow.quickboxSetLocale(lang.key);
                    location.reload();
                };
                const img = document.createElement("img");
                img.className = "lang-flag";
                img.src = `/lang/flag_${lang.file}.png`;
                img.alt = "";
                img.setAttribute("aria-hidden", "true");
                option.append(img, document.createTextNode(lang.title));
                appendSmallOption(langContainer, option);
            });
        }

        if (themeContainer && Array.isArray(payload.themes)) {
            themeContainer.innerHTML = "";
            payload.themes.forEach((theme: any) => {
                const option = document.createElement("div");
                option.style.cursor = "pointer";
                option.setAttribute("data-toggle", "modal");
                option.setAttribute("data-target", `#themeSelect${theme.file}Confirm`);
                const img = document.createElement("img");
                img.className = "lang-flag";
                img.src = `/img/themes/opt_${theme.file}.png`;
                img.alt = "";
                img.setAttribute("aria-hidden", "true");
                option.append(img, document.createTextNode(theme.title));
                appendSmallOption(themeContainer, option);
            });
        }

        if (bwContainer && Array.isArray(payload.bwPages)) {
            bwContainer.innerHTML = "";
            payload.bwPages.forEach((page: any) => {
                const option = document.createElement("div");
                option.style.cursor = "pointer";
                option.onclick = () => {
                    localStorage.setItem("bw_tables:page", page.key);
                    location.reload();
                };
                option.textContent = page.title;
                appendSmallOption(bwContainer, option);
            });
        }
    };

    const renderNetworkInterfaces = (interfaces: unknown) => {
        const tbody = document.getElementById("node-network-interface-rows");
        if (!tbody) {
            return;
        }
        tbody.innerHTML = "";
        dashboardWindow.netInterfaceCells = {};
        if (!Array.isArray(interfaces) || !interfaces.length) {
            const emptyRow = document.createElement("tr");
            const emptyCell = document.createElement("td");
            emptyCell.colSpan = 3;
            emptyCell.style.fontSize = "11px";
            emptyCell.style.padding = "4px 4px 4px 12px";
            emptyCell.textContent = "N/A";
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
            return;
        }
        interfaces.forEach((iface) => {
            const row = document.createElement("tr");
            const ifaceCell = document.createElement("td");
            ifaceCell.style.cssText = "font-size:14px;font-weight:bold;padding:2px 2px 2px 12px";
            ifaceCell.textContent = String(iface);
            const txCell = document.createElement("td");
            txCell.style.cssText = "font-size:11px;padding:2px 2px 2px 12px";
            const txValue = document.createElement("span");
            txValue.textContent = "0B/s";
            txCell.appendChild(txValue);
            const rxCell = document.createElement("td");
            rxCell.style.cssText = "font-size:11px;padding:2px 2px 2px 12px";
            const rxValue = document.createElement("span");
            rxValue.textContent = "0B/s";
            rxCell.appendChild(rxValue);
            row.append(ifaceCell, txCell, rxCell);
            tbody.appendChild(row);
            dashboardWindow.netInterfaceCells![String(iface)] = { tx: txValue, rx: rxValue };
        });
    };

    const renderSystemStatic = (payload: any) => {
        const cpu = document.getElementById("node-cpu-static");
        if (cpu && payload?.cpu) {
            cpu.innerHTML = `${payload.cpu.modelHtml}<br/>[<span style='color:#999;font-weight:600'>x${payload.cpu.count}</span> core]`;
        }
        renderNetworkInterfaces(payload?.interfaces);
    };

    const applyDashboardTheme = (theme: string) => {
        fetch(`${dashboardWindow.quickboxApiBase}/node/theme`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error("Failed to apply theme");
            }
            location.reload();
        }).catch((error: unknown) => {
            console.warn("[ws] failed to apply theme", error);
        });
    };

    const loadNodeFragments = () => {
        fetchJson("/node/dashboard_config").then(renderDashboardConfig).catch((error: unknown) => {
            console.warn("[ws] failed to load dashboard config", error);
        });
        fetchJson("/node/system_static").then(renderSystemStatic).catch((error: unknown) => {
            console.warn("[ws] failed to load static system info", error);
            renderNetworkInterfaces([]);
        });
        [
            ["/node/load", "#cpuload"],
            ["/node/disk_data", "#disk_data"],
            ["/node/ram_stats", "#meterram"],
        ].forEach(([url, selector]) => {
            fetch(widgetUrl(url), { credentials: "same-origin" })
                .then((response) => response.ok ? response.text() : Promise.reject(response))
                .then((html) => $(selector).html(html))
                .catch(() => undefined);
        });
    };

    const configureSysResponseCloseAction = (mode: string) => {
        const closeButton = document.getElementById("sysResponseCloseAction");
        if (!(closeButton instanceof HTMLElement)) {
            return;
        }
        if (mode === "log-view") {
            closeButton.removeAttribute("data-click-handler");
            closeButton.removeAttribute("data-refresh-after-close");
            closeButton.removeAttribute("data-package");
            closeButton.removeAttribute("data-operation");
            closeButton.textContent = closeButton.dataset.labelLogView || closeButton.textContent || "";
            return;
        }
        closeButton.dataset.clickHandler = closeButton.dataset.defaultClickHandler || "boxHandler";
        closeButton.dataset.refreshAfterClose = closeButton.dataset.defaultRefreshAfterClose || "true";
        closeButton.dataset.package = closeButton.dataset.defaultPackage || "log";
        closeButton.dataset.operation = closeButton.dataset.defaultOperation || "clean";
        closeButton.textContent = closeButton.dataset.labelDefault || closeButton.textContent || "";
    };

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".ps").forEach((element) => {
            const psInstance = new PerfectScrollbarClass(element);
            if (element.id === "sysPre") {
                dashboardWindow.__psSysPre = psInstance;
            }
        });

        document.getElementById("node-panel-reset")?.addEventListener("click", () => {
            for (let i = localStorage.length - 1; i >= 0; i -= 1) {
                const key = localStorage.key(i);
                if (key?.startsWith("lobipanel")) {
                    localStorage.removeItem(key);
                }
            }
            location.reload();
        });

        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const sysResponseTrigger = target?.closest("[data-target='#sysResponse']");
            if (sysResponseTrigger instanceof HTMLElement) {
                configureSysResponseCloseAction(sysResponseTrigger.dataset.sysresponseMode === "log-view" ? "log-view" : "default");
            }
            const themeButton = target?.closest("[data-click-handler='themeSelect']");
            if (themeButton instanceof HTMLElement && themeButton.dataset.theme) {
                applyDashboardTheme(themeButton.dataset.theme);
            }
            const packageInstallButton = target?.closest("[data-click-handler='packageInstall']");
            if (packageInstallButton) {
                dashboardWindow.packageInstallHandler(event);
                return;
            }
            const packageRemoveButton = target?.closest("[data-click-handler='packageRemove']");
            if (packageRemoveButton) {
                dashboardWindow.packageRemoveHandler(event);
                return;
            }
            const serviceUpdateButton = target?.closest("[data-click-handler='serviceUpdate']");
            if (serviceUpdateButton) {
                dashboardWindow.serviceUpdateHandler(event);
                return;
            }
            const boxHandlerButton = target?.closest("[data-click-handler='boxHandler']");
            if (boxHandlerButton) {
                dashboardWindow.boxHandler(event);
                if (boxHandlerButton instanceof HTMLElement && boxHandlerButton.dataset.refreshAfterClose === "true") {
                    setTimeout(() => location.reload(), 150);
                }
            }
        });

        loadNodeFragments();
        $(() => {
            $(".tooltips").tooltip({ container: "body" });
            initializeServiceToggles();
            initializePackageTable();
        });
        Visibility.afterPrerendering(startStatusUpdates);
    });
}
