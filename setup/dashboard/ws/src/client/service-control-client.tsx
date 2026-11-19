// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";
import { createCache, StyleProvider } from "@ant-design/cssinjs";

import {
    SERVICE_CONTROL_URL,
    SERVICE_STATUS_ALL_URL,
    isServiceResponseV2,
    type ServiceLocale,
    type ServiceRequestV2,
    type ServiceResponseV2,
    type ServiceRow,
    type ServiceState,
} from "../shared/service-control-contract";
import type { SystemSummaryBridge, SystemSummaryRuntime } from "../shared/system-summary-contract";
import type { NetworkStatusBridge } from "../shared/network-status-contract";
import type { BandwidthIslandBridge } from "../shared/bandwidth-contract";
import type { CpuStatusBridge } from "../shared/cpu-status-contract";
import type { MemoryStatsBridge } from "../shared/memory-stats-contract";
import type { DiskDataBridge } from "../shared/disk-data-contract";
import type { PackageManagementRuntime } from "../shared/package-management-contract";
import type { RunningTaskData } from "../shared/running-task-contract";
import type { DashboardChromeProps } from "../widgets/dashboard-chrome";
import { ServiceControlIsland, type ServiceControlLabels } from "../widgets/service-control-island";
import { useDashboardTheme } from "./theme-store";
import "./system-summary-client";
import "./network-status-client";
import "./bandwidth-tables-client";
import "./cpu-status-client";
import "./memory-stats-client";
import "./disk-data-client";
import "./package-management-client";
import "./system-response-client";
import "./dashboard-chrome-client";
import "./running-task-client";
import { initDashboardRuntime } from "./dashboard-runtime-client";

interface DashboardRuntime {
    locale: string;
    serviceTheme: "defaulted" | "smoked";
    serviceKeys: string[];
    serviceRows: ServiceRow[];
    messages: ServiceControlLabels & { systemResponse: string; closeRefresh: string; close: string };
    systemSummary?: SystemSummaryRuntime;
    networkInterfaces: string[];
    networkInterfacesLoaded: boolean;
    packageManagement?: PackageManagementRuntime;
    runningTask?: RunningTaskData;
    chrome: DashboardChromeProps;
}

interface ServiceTransport {
    isConnected: () => boolean;
    sendMessage: (request: ServiceRequestV2) => void;
    executeServiceAction: (request: { requestId: string; service: string; action: "enable" | "disable" | "restart"; locale: ServiceLocale }) => void;
    notifyStopped: (key: string) => void;
}

interface PendingRequest {
    request: ServiceRequestV2;
    timeout: ReturnType<typeof setTimeout>;
}

interface PendingServiceAction {
    serviceId: string;
    timeout: ReturnType<typeof setTimeout>;
    failureShown: boolean;
}

interface ServiceIslandBridge {
    bindTransport: (next: ServiceTransport) => void;
    onConnected: (bootstrapDelayMs: number) => void;
    onDisconnected: () => void;
    onMessage: (payload: unknown) => void;
    onActionResult: (payload: unknown) => void;
    onLocaleChanged: (nextLocale: string) => void;
}

declare global {
    interface Window {
        quickboxRuntime?: DashboardRuntime;
        quickboxServiceIsland?: ServiceIslandBridge;
        quickboxSystemSummaryIsland?: SystemSummaryBridge;
        quickboxNetworkIsland?: NetworkStatusBridge;
        quickboxBandwidthIsland?: BandwidthIslandBridge;
        quickboxCpuStatusIsland?: CpuStatusBridge;
        quickboxMemoryStatsIsland?: MemoryStatsBridge;
        quickboxDiskDataIsland?: DiskDataBridge;
        Visibility?: {
            every: (visibleMs: number, hiddenMs: number, callback: () => void) => number;
        };
        quickboxSetLocale?: (locale: string) => void;
        quickboxApiBase?: string;
    }
}

interface ServiceControlSnapshot {
    rows: ServiceRow[];
    statusById: Record<string, ServiceState>;
    pendingById: Record<string, boolean>;
    health: "ok" | "degraded" | "unavailable";
}

const REQUEST_TIMEOUT_MS = 15_000;
const SERVICE_CONTROL_INTERVAL_MS = 15_000;
const SERVICE_STATUS_INTERVAL_MS = 5_000;
const SERVICE_STATUS_MAX_RETRY_MS = 30_000;

function normalizeLocale(value: string): ServiceLocale {
    return (["da", "de", "en", "es", "fr", "zh"] as const).includes(value as ServiceLocale)
        ? value as ServiceLocale
        : "en";
}

function hasOnlyKnownServiceIds(response: ServiceResponseV2, knownServiceIds: Set<string>) {
    if (response.status === "error") {
        return true;
    }
    if ("rows" in response.data) {
        return response.data.rows.every((row) => knownServiceIds.has(row.id));
    }
    return Object.keys(response.data.states).every((serviceId) => knownServiceIds.has(serviceId));
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character] ?? character);
}

function matchesPendingRequest(
    response: ServiceResponseV2,
    pending: PendingRequest,
    generation: number,
    locale: ServiceLocale,
) {
    const request = pending.request;
    return response.meta.key === request.key && response.meta.url === request.url &&
        response.meta.locale === request.locale && response.meta.generation === request.generation &&
        request.generation === generation && request.locale === locale;
}

function createServiceControlStore(initialRows: ServiceRow[], initialLocale: string, serviceKeys: string[]) {
    const serverSnapshot: ServiceControlSnapshot = {
        rows: initialRows,
        statusById: {},
        pendingById: {},
        health: "unavailable",
    };
    let snapshot = serverSnapshot;
    let locale = normalizeLocale(initialLocale);
    let generation = 0;
    let requestSequence = 0;
    let transport: ServiceTransport | undefined;
    let statusRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let nextStatusRequestAt = 0;
    let statusFailureCount = 0;
    let bootstrapStatusTimer: ReturnType<typeof setTimeout> | undefined;
    let scheduled = false;
    const listeners = new Set<() => void>();
    const pendingById = new Map<string, PendingRequest>();
    const pendingByKey = new Map<ServiceRequestV2["key"], string>();
    const errorCountByKey: Record<string, number> = {};
    const stoppedKeys = new Set<string>();
    const serviceActions = new Map<string, PendingServiceAction>();
    const pendingActionByService = new Map<string, string>();
    let actionSequence = 0;
    const knownServiceIds = new Set(serviceKeys);

    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const getSnapshot = () => snapshot;
    const getServerSnapshot = () => serverSnapshot;
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    const clearPending = () => {
        pendingById.forEach((pending) => { clearTimeout(pending.timeout); });
        pendingById.clear();
        pendingByKey.clear();
    };

    const clearPendingRequest = (requestId: string) => {
        const pending = pendingById.get(requestId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        pendingById.delete(requestId);
        if (pendingByKey.get(pending.request.key) === requestId) {
            pendingByKey.delete(pending.request.key);
        }
    };

    const markAllServiceStatusesStale = () => {
        snapshot = {
            ...snapshot,
            health: "unavailable",
            statusById: Object.fromEntries(Object.entries(snapshot.statusById).map(([serviceId, state]) => [serviceId, { ...state, stale: true }])),
        };
    };

    const scheduleStatusRetry = (retryAfterMs = 0) => {
        statusFailureCount += 1;
        const backoffMs = Math.min(SERVICE_STATUS_MAX_RETRY_MS, 5_000 * 2 ** Math.min(statusFailureCount - 1, 3));
        const delay = Math.max(backoffMs, retryAfterMs) + Math.floor(Math.random() * 750);
        nextStatusRequestAt = Date.now() + delay;
        if (statusRetryTimer) {
            clearTimeout(statusRetryTimer);
        }
        statusRetryTimer = setTimeout(() => {
            statusRetryTimer = undefined;
            sendRequest("SERVICE_STATUS_ALL");
        }, delay);
    };

    const scheduleHealthyStatusPoll = () => {
        statusFailureCount = 0;
        nextStatusRequestAt = Date.now() + SERVICE_STATUS_INTERVAL_MS;
        if (statusRetryTimer) {
            clearTimeout(statusRetryTimer);
        }
        statusRetryTimer = setTimeout(() => {
            statusRetryTimer = undefined;
            sendRequest("SERVICE_STATUS_ALL");
        }, SERVICE_STATUS_INTERVAL_MS);
    };

    const handleStatusData = (data: Extract<ServiceResponseV2, { status: "success" }> ["data"]) => {
        if (!("states" in data)) {
            return;
        }
        snapshot = {
            ...snapshot,
            statusById: { ...snapshot.statusById, ...data.states },
            health: data.health,
        };
        if (data.health === "unavailable") {
            markAllServiceStatusesStale();
            scheduleStatusRetry(Math.max(5_000, data.retryAfterMs));
        } else {
            scheduleHealthyStatusPoll();
        }
    };

    const handleResponseError = (request: ServiceRequestV2) => {
        errorCountByKey[request.key] = (errorCountByKey[request.key] ?? 0) + 1;
        if (request.key === "SERVICE_STATUS_ALL") {
            markAllServiceStatusesStale();
            scheduleStatusRetry();
            publish();
        }
        if (request.key !== "SERVICE_STATUS_ALL" && errorCountByKey[request.key] > 32 && !stoppedKeys.has(request.key)) {
            stoppedKeys.add(request.key);
            transport?.notifyStopped(request.key);
        }
    };

    const sendRequest = (key: ServiceRequestV2["key"]) => {
        if (key === "SERVICE_STATUS_ALL" && Date.now() < nextStatusRequestAt) {
            if (statusRetryTimer) {
                clearTimeout(statusRetryTimer);
            }
            statusRetryTimer = setTimeout(() => {
                statusRetryTimer = undefined;
                sendRequest(key);
            }, nextStatusRequestAt - Date.now());
            return;
        }
        if (!transport?.isConnected() || stoppedKeys.has(key) || pendingByKey.has(key)) {
            return;
        }
        const request: ServiceRequestV2 = {
            protocolVersion: 2,
            key,
            url: key === "SERVICE_CONTROL" ? SERVICE_CONTROL_URL : SERVICE_STATUS_ALL_URL,
            requestId: `${key}:${++requestSequence}`,
            locale,
            generation,
        };
        const timeout = setTimeout(() => {
            if (!pendingById.has(request.requestId)) {
                return;
            }
            clearPendingRequest(request.requestId);
            if (transport?.isConnected()) {
                if (key === "SERVICE_STATUS_ALL") {
                    errorCountByKey[key] = (errorCountByKey[key] ?? 0) + 1;
                    markAllServiceStatusesStale();
                    scheduleStatusRetry();
                    publish();
                } else {
                    sendRequest(key);
                }
            }
        }, REQUEST_TIMEOUT_MS);
        pendingById.set(request.requestId, { request, timeout });
        pendingByKey.set(key, request.requestId);
        transport.sendMessage(request);
    };

    const handleMessage = (payload: unknown) => {
        if (!isServiceResponseV2(payload)) {
            return;
        }
        const response: ServiceResponseV2 = payload;
        if (!hasOnlyKnownServiceIds(response, knownServiceIds)) {
            return;
        }
        const pending = pendingById.get(response.meta.requestId);
        if (!pending || !matchesPendingRequest(response, pending, generation, locale)) {
            return;
        }
        const request = pending.request;
        clearPendingRequest(request.requestId);
        if (response.status === "error") {
            handleResponseError(request);
            return;
        }
        if (errorCountByKey[request.key]) {
            errorCountByKey[request.key] = Math.max(0, errorCountByKey[request.key] - 1);
        }
        if ("rows" in response.data) {
            const currentRows = new Map(snapshot.rows.map((row) => [row.id, row]));
            const rows = response.data.rows.map((row) =>
                pendingActionByService.has(row.id) ? currentRows.get(row.id) ?? row : row,
            );
            snapshot = { ...snapshot, rows };
        } else {
            handleStatusData(response.data);
        }
        publish();
    };

    const markServiceStale = (serviceId: string) => {
        const current = snapshot.statusById[serviceId] ?? { value: null, observedAt: null, stale: true };
        snapshot = {
            ...snapshot,
            statusById: { ...snapshot.statusById, [serviceId]: { ...current, stale: true } },
        };
        publish();
    };

    const showActionFailure = (payload: Record<string, unknown>) => {
        const responseMessage = typeof payload.message === "string" ? payload.message : "Service action failed";
        const failedOperation = typeof payload.failedOperation === "string" ? `\n\nsystemctl ${payload.failedOperation}` : "";
        const output = typeof payload.stderr === "string" && payload.stderr !== ""
            ? payload.stderr
            : typeof payload.stdout === "string" ? payload.stdout : "";
        const html = `${escapeHtml(responseMessage + failedOperation)}${output ? `<hr><pre>${escapeHtml(output)}</pre>` : ""}`;
        window.quickboxSystemResponseIsland?.showAlert(html);
    };

    const completeAction = (
        requestId: string,
        refresh = true,
        statusData?: { states: Record<string, ServiceState>; health: ServiceControlSnapshot["health"]; retryAfterMs: number },
    ) => {
        const request = serviceActions.get(requestId);
        if (!request) {
            return;
        }
        clearTimeout(request.timeout);
        serviceActions.delete(requestId);
        if (pendingActionByService.get(request.serviceId) === requestId) {
            pendingActionByService.delete(request.serviceId);
        }
        const pendingById = Object.fromEntries(
            Object.entries(snapshot.pendingById).filter(([serviceId]) => serviceId !== request.serviceId),
        );
        snapshot = { ...snapshot, pendingById };
        if (statusData) {
            const states = Object.fromEntries(
                Object.entries(statusData.states).filter(([serviceId]) => knownServiceIds.has(serviceId)),
            );
            handleStatusData({ states, health: statusData.health, retryAfterMs: statusData.retryAfterMs });
        } else {
            markServiceStale(request.serviceId);
        }
        publish();
        if (refresh) {
            sendRequest("SERVICE_CONTROL");
            if (!statusData) {
                sendRequest("SERVICE_STATUS_ALL");
            }
        }
    };

    const executeServiceAction = (serviceId: string, action: "enable" | "disable" | "restart") => {
        if (!transport?.isConnected() || pendingActionByService.has(serviceId)) {
            return;
        }
        const requestId = `SERVICE_ACTION:${++actionSequence}`;
        const timeout = setTimeout(() => { completeAction(requestId); }, 40_000);
        serviceActions.set(requestId, { serviceId, timeout, failureShown: false });
        pendingActionByService.set(serviceId, requestId);
        snapshot = { ...snapshot, pendingById: { ...snapshot.pendingById, [serviceId]: true } };
        markServiceStale(serviceId);
        transport.executeServiceAction({ requestId, service: serviceId, action, locale });
    };

    const finishConfirmedAction = (requestId: string, response: Record<string, unknown>, request: PendingServiceAction) => {
        if (typeof response.enabled === "boolean") {
            snapshot = {
                ...snapshot,
                rows: snapshot.rows.map((row) => row.id === request.serviceId ? { ...row, enabledAtBoot: response.enabled as boolean } : row),
            };
        }
        if (response.success === false && !request.failureShown) {
            showActionFailure(response);
        } else if (typeof response.statusError === "string" && response.statusError !== "") {
            window.quickboxSystemResponseIsland?.showAlert(`${escapeHtml("Service action completed, but its current status could not be confirmed.")}<br>${escapeHtml(response.statusError)}`);
        }
        const statusData = response.statusData;
        const confirmedStatus = statusData !== null && typeof statusData === "object" && !Array.isArray(statusData)
            ? statusData as { states?: Record<string, ServiceState>; health?: ServiceControlSnapshot["health"]; retryAfterMs?: number }
            : undefined;
        if (confirmedStatus?.states && confirmedStatus.health && typeof confirmedStatus.retryAfterMs === "number") {
            completeAction(requestId, true, {
                states: confirmedStatus.states,
                health: confirmedStatus.health,
                retryAfterMs: confirmedStatus.retryAfterMs,
            });
        } else {
            completeAction(requestId);
        }
    };

    const handleActionComplete = (response: Record<string, unknown>, request: PendingServiceAction) => {
        markServiceStale(request.serviceId);
        if (response.success === false && !request.failureShown) {
            request.failureShown = true;
            showActionFailure(response);
        }
    };

    const handleActionResult = (payload: unknown) => {
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            return;
        }
        const response = payload as Record<string, unknown>;
        if (typeof response.requestId !== "string" || typeof response.service !== "string") {
            return;
        }
        const request = serviceActions.get(response.requestId);
        if (!request || request.serviceId !== response.service) {
            return;
        }
        if (response.phase === "action-complete") {
            handleActionComplete(response, request);
        } else if (response.phase === "status-confirmed") {
            finishConfirmedAction(response.requestId, response, request);
        } else if (response.phase === undefined) {
            showActionFailure(response);
            completeAction(response.requestId);
        }
    };

    const setEnabledAtBoot = (serviceId: string, enabledAtBoot: boolean) => {
        executeServiceAction(serviceId, enabledAtBoot ? "enable" : "disable");
    };

    const executeRefresh = (serviceId: string) => {
        executeServiceAction(serviceId, "restart");
    };

    const bindTransport = (next: ServiceTransport) => {
        transport = next;
        if (scheduled) {
            return;
        }
        scheduled = true;
        if (window.Visibility) {
            window.Visibility.every(SERVICE_CONTROL_INTERVAL_MS, 10 * SERVICE_CONTROL_INTERVAL_MS, () => { sendRequest("SERVICE_CONTROL"); });
            window.Visibility.every(SERVICE_STATUS_INTERVAL_MS, 10 * SERVICE_STATUS_INTERVAL_MS, () => { sendRequest("SERVICE_STATUS_ALL"); });
        } else {
            window.setInterval(() => { sendRequest("SERVICE_CONTROL"); }, SERVICE_CONTROL_INTERVAL_MS);
            window.setInterval(() => { sendRequest("SERVICE_STATUS_ALL"); }, SERVICE_STATUS_INTERVAL_MS);
        }
        if (transport.isConnected()) {
            sendRequest("SERVICE_CONTROL");
        }
    };

    const onConnected = (bootstrapDelayMs: number) => {
        generation += 1;
        clearPending();
        nextStatusRequestAt = 0;
        if (statusRetryTimer) {
            clearTimeout(statusRetryTimer);
            statusRetryTimer = undefined;
        }
        Object.keys(errorCountByKey).forEach((key) => { errorCountByKey[key] = 0; });
        statusFailureCount = 0;
        stoppedKeys.clear();
        for (const requestId of serviceActions.keys()) {
            completeAction(requestId, false);
        }
        if (bootstrapStatusTimer) {
            clearTimeout(bootstrapStatusTimer);
        }
        bootstrapStatusTimer = setTimeout(() => {
            sendRequest("SERVICE_CONTROL");
            sendRequest("SERVICE_STATUS_ALL");
        }, bootstrapDelayMs);
    };

    const onDisconnected = () => {
        clearPending();
        nextStatusRequestAt = 0;
        if (statusRetryTimer) {
            clearTimeout(statusRetryTimer);
            statusRetryTimer = undefined;
        }
        for (const requestId of serviceActions.keys()) {
            completeAction(requestId, false);
        }
        if (bootstrapStatusTimer) {
            clearTimeout(bootstrapStatusTimer);
            bootstrapStatusTimer = undefined;
        }
    };

    const onLocaleChanged = (nextLocale: string) => {
        locale = normalizeLocale(nextLocale);
        generation += 1;
        clearPending();
    };

    return {
        getSnapshot,
        getServerSnapshot,
        subscribe,
        bindTransport,
        onConnected,
        onDisconnected,
        onLocaleChanged,
        handleMessage,
        handleActionResult,
        setEnabledAtBoot,
        executeRefresh,
    };
}

const runtime = window.quickboxRuntime;
if (runtime) {
    const clientRuntime = runtime;
    const store = createServiceControlStore(clientRuntime.serviceRows, clientRuntime.locale, clientRuntime.serviceKeys);
    window.quickboxServiceIsland = {
        bindTransport: store.bindTransport,
        onConnected: store.onConnected,
        onDisconnected: store.onDisconnected,
        onMessage: store.handleMessage,
        onActionResult: store.handleActionResult,
        onLocaleChanged: store.onLocaleChanged,
    };

    const mount = document.getElementById("service_control_widget");
    if (mount) {
        function ClientServiceControl() {
            const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
            const activeTheme = useDashboardTheme(clientRuntime.serviceTheme);
            return (
                <ServiceControlIsland
                    rows={snapshot.rows}
                    labels={clientRuntime.messages}
                    theme={activeTheme}
                    statusById={snapshot.statusById}
                    pendingById={snapshot.pendingById}
                    onRefresh={store.executeRefresh}
                    onEnabledChange={store.setEnabledAtBoot}
                />
            );
        }
        const cache = createCache();
        hydrateRoot(
            mount,
            <StyleProvider cache={cache}>
                <ClientServiceControl />
            </StyleProvider>,
        );
    }
    initDashboardRuntime();
}
