// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import i18n from "../i18n";

import {
    SERVICE_LOCALES,
    SERVICE_STREAM_URLS,
    isServiceDataMessage,
    isServiceKey,
    isServiceStatusAllData,
    type ServiceActionCompleteResult,
    type ServiceActionConfirmedResult,
    type ServiceActionName,
    type ServiceActionRequest,
    type ServiceActionResult,
    type ServiceDataMessage,
    type ServiceKey,
    type ServiceLocale,
    type ServiceRow,
    type ServiceState,
    type ServiceStatusAllData,
} from "../../../ws/src/shared/service-control-contract";
import type { DashboardBootstrapPayload, WsPushMode } from "../../../ws/src/shared/bootstrap-contract";
import { DASHBOARD_STREAM_BY_KEY } from "../../../ws/src/shared/widget-streams";
import type { WsWidgetRequest, WsWidgetResponse } from "../../../ws/src/shared/ws-message";
import { ServiceControlIsland } from "../components/service-control-island";
import { scheduleVisibilityInterval, useCommandConnection } from "./dashboard-runtime-client";
import { systemResponseActions } from "./system-response-client";
import { useDashboardTheme } from "./theme-store";

interface ServiceTransport {
    isConnected: () => boolean;
    pushMode?: WsPushMode;
    sendMessage: (request: WsWidgetRequest) => void;
    executeServiceAction: (request: ServiceActionRequest) => boolean;
    notifyStopped: (key: string) => void;
}

interface PendingRequest {
    key: ServiceKey;
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
    onDisconnected: () => boolean;
    onMessage: (payload: WsWidgetResponse) => void;
    onActionResult: (payload: ServiceActionResult) => void;
    onLocaleChanged: (nextLocale: string) => void;
}

declare global {
    interface Window {
        quickboxServiceIsland?: ServiceIslandBridge;
    }
}

interface ServiceControlSnapshot {
    rows: ServiceRow[];
    statusById: Record<string, ServiceState>;
    pendingById: Record<string, boolean>;
    health: "ok" | "degraded" | "unavailable";
}

const REQUEST_TIMEOUT_MS = 15_000;
const SERVICE_CONTROL_INTERVAL_MS = DASHBOARD_STREAM_BY_KEY.SERVICE_CONTROL.visibleMs;
const SERVICE_STATUS_INTERVAL_MS = DASHBOARD_STREAM_BY_KEY.SERVICE_STATUS_ALL.visibleMs;
const SERVICE_STATUS_MAX_RETRY_MS = DASHBOARD_STREAM_BY_KEY.SERVICE_STATUS_ALL.hiddenMs;

function normalizeLocale(value: string): ServiceLocale {
    return SERVICE_LOCALES.find(locale => locale === value) ?? "en";
}

function hasOnlyKnownServiceIds(message: ServiceDataMessage, knownServiceIds: Set<string>) {
    return message.key === "SERVICE_CONTROL"
        ? message.response.rows.every(row => knownServiceIds.has(row.id))
        : Object.keys(message.response.states).every(id => knownServiceIds.has(id));
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
    let requestSequence = 0;
    let transport: ServiceTransport | undefined;
    let statusRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let nextStatusRequestAt = 0;
    let statusFailureCount = 0;
    let bootstrapStatusTimer: ReturnType<typeof setTimeout> | undefined;
    let scheduled = false;
    const listeners = new Set<() => void>();
    const pendingById = new Map<string, PendingRequest>();
    const pendingByKey = new Map<ServiceKey, string>();
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
        if (pendingByKey.get(pending.key) === requestId) {
            pendingByKey.delete(pending.key);
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

    const handleStatusData = (data: ServiceStatusAllData) => {
        snapshot = {
            ...snapshot,
            statusById: { ...snapshot.statusById, ...data.states },
            health: data.health,
        };
        if (data.health === "unavailable") {
            markAllServiceStatusesStale();
            if (transport?.pushMode !== "push") {
                scheduleStatusRetry(Math.max(5_000, data.retryAfterMs));
            }
        } else if (transport?.pushMode !== "push") {
            scheduleHealthyStatusPoll();
        }
    };

    const sendRequest = (key: ServiceKey) => {
        if (transport?.pushMode === "push") {
            return;
        }
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
        const requestId = `${key}:${++requestSequence}`;
        const timeout = setTimeout(() => {
            if (!pendingById.has(requestId)) {
                return;
            }
            clearPendingRequest(requestId);
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
        pendingById.set(requestId, { key, timeout });
        pendingByKey.set(key, requestId);
        transport.sendMessage({ type: "request", key, url: SERVICE_STREAM_URLS[key], requestId });
    };

    const applyServiceRows = (rowsData: ServiceRow[]) => {
        const currentRows = new Map(snapshot.rows.map((row) => [row.id, row]));
        const rows = rowsData.map((row) =>
            pendingActionByService.has(row.id) ? currentRows.get(row.id) ?? row : row,
        );
        snapshot = { ...snapshot, rows };
    };

    const applyServiceFailure = (key: ServiceKey) => {
        errorCountByKey[key] = (errorCountByKey[key] ?? 0) + 1;
        if (key === "SERVICE_STATUS_ALL") {
            markAllServiceStatusesStale();
            if (transport?.pushMode !== "push") {
                scheduleStatusRetry();
            }
            publish();
        }
        if (transport?.pushMode !== "push" && key !== "SERVICE_STATUS_ALL" && errorCountByKey[key] > 32 && !stoppedKeys.has(key)) {
            stoppedKeys.add(key);
            transport?.notifyStopped(key);
        }
    };

    const applyServiceSuccess = (message: ServiceDataMessage) => {
        const { key, response } = message;
        if (errorCountByKey[key]) {
            errorCountByKey[key] = Math.max(0, errorCountByKey[key] - 1);
        }
        if (key === "SERVICE_CONTROL") {
            applyServiceRows(response.rows);
        } else {
            handleStatusData(response);
        }
        publish();
    };

    const handleMessage = (payload: WsWidgetResponse) => {
        if (!isServiceKey(payload.key) || payload.url !== SERVICE_STREAM_URLS[payload.key]) {
            return;
        }
        const { key, response } = payload;
        if (payload.type === "reply" && pendingById.get(payload.requestId)?.key !== key) {
            return;
        }

        if (!payload.success) {
            if (payload.type === "reply") {
                clearPendingRequest(payload.requestId);
            }
            if (payload.type === "push" && payload.stale && key === "SERVICE_STATUS_ALL" && isServiceStatusAllData(response)) {
                const states = Object.fromEntries(Object.entries(response.states).filter(([id]) => knownServiceIds.has(id)));
                snapshot = { ...snapshot, statusById: { ...snapshot.statusById, ...states } };
            }
            applyServiceFailure(key);
            return;
        }

        const message = { key, response };
        if (!isServiceDataMessage(message) || !hasOnlyKnownServiceIds(message, knownServiceIds)) {
            return;
        }
        if (payload.type === "reply") {
            clearPendingRequest(payload.requestId);
        }
        applyServiceSuccess(message);
    };

    const markServiceStale = (serviceId: string) => {
        const current = snapshot.statusById[serviceId] ?? { value: null, observedAt: null, stale: true };
        snapshot = {
            ...snapshot,
            statusById: { ...snapshot.statusById, [serviceId]: { ...current, stale: true } },
        };
        publish();
    };

    const formatActionReason = (rawMessage: string): string => {
        if (rawMessage === "Service command timed out") {
            return i18n.t("SERVICE_ACTION_REASON_TIMEOUT");
        }
        if (rawMessage === "Too many commands in progress") {
            return i18n.t("SERVICE_ACTION_REASON_BUSY");
        }
        if (rawMessage === "Invalid service action") {
            return i18n.t("SERVICE_ACTION_REASON_INVALID");
        }
        if (rawMessage === "Service is not enabled") {
            return i18n.t("SERVICE_ACTION_REASON_NOT_ENABLED");
        }
        return rawMessage || i18n.t("SERVICE_ACTION_REASON_UNKNOWN");
    };

    const formatActionLabel = (action: string): string => {
        if (action === "enable") {return i18n.t("SERVICE_ACTION_ENABLE");}
        if (action === "disable") {return i18n.t("SERVICE_ACTION_DISABLE");}
        if (action === "restart") {return i18n.t("SERVICE_ACTION_RESTART");}
        return "";
    };

    const showActionFailure = (payload: ServiceActionResult) => {
        const serviceId = payload.service;
        const serviceName = snapshot.rows.find((row) => row.id === serviceId)?.name || serviceId;
        const actionLabel = formatActionLabel(payload.action);
        const reason = formatActionReason(payload.message);
        const message = serviceName && actionLabel
            ? i18n.t("SERVICE_ACTION_FAILED", { action: actionLabel, service: serviceName, reason })
            : reason;
        const failedOperation = payload.failedOperation
            ? (serviceId ? `systemctl ${payload.failedOperation} ${serviceId}` : `systemctl ${payload.failedOperation}`)
            : "";
        const output = payload.stderr || payload.stdout;
        systemResponseActions.showAlert({
            message,
            ...(failedOperation ? { command: failedOperation } : {}),
            ...(output ? { output } : {}),
        });
    };

    const completeAction = (
        requestId: string,
        refresh = true,
        statusData?: ServiceStatusAllData,
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
        if (refresh && transport?.pushMode !== "push") {
            sendRequest("SERVICE_CONTROL");
            if (!statusData) {
                sendRequest("SERVICE_STATUS_ALL");
            }
        }
    };

    const executeServiceAction = (serviceId: string, action: ServiceActionName) => {
        if (!transport?.isConnected() || pendingActionByService.has(serviceId)) {
            return;
        }
        const requestId = `SERVICE_ACTION:${++actionSequence}`;
        const timeout = setTimeout(() => { completeAction(requestId); }, 40_000);
        serviceActions.set(requestId, { serviceId, timeout, failureShown: false });
        pendingActionByService.set(serviceId, requestId);
        snapshot = { ...snapshot, pendingById: { ...snapshot.pendingById, [serviceId]: true } };
        markServiceStale(serviceId);
        if (!transport.executeServiceAction({ requestId, service: serviceId, action, locale })) {
            completeAction(requestId, false);
        }
    };

    const finishConfirmedAction = (requestId: string, response: ServiceActionConfirmedResult, request: PendingServiceAction) => {
        if (response.enabled !== undefined) {
            const enabled = response.enabled;
            snapshot = {
                ...snapshot,
                rows: snapshot.rows.map((row) => row.id === request.serviceId ? { ...row, enabledAtBoot: enabled } : row),
            };
        }
        if (!response.success && !request.failureShown) {
            showActionFailure(response);
        } else if (response.statusError) {
            systemResponseActions.showAlert({
                message: i18n.t("SERVICE_ACTION_STATUS_UNCONFIRMED"),
                output: response.statusError,
            });
        }
        completeAction(requestId, true, response.statusData);
    };

    const handleActionComplete = (response: ServiceActionCompleteResult, request: PendingServiceAction) => {
        markServiceStale(request.serviceId);
        if (!response.success && !request.failureShown) {
            request.failureShown = true;
            showActionFailure(response);
        }
    };

    const handleActionResult = (response: ServiceActionResult) => {
        if (!response.requestId) {
            return;
        }
        const request = serviceActions.get(response.requestId);
        if (!request || request.serviceId !== response.service) {
            return;
        }
        switch (response.phase) {
            case "action-complete":
                handleActionComplete(response, request);
                break;
            case "status-confirmed":
                finishConfirmedAction(response.requestId, response, request);
                break;
            case "rejected":
                showActionFailure(response);
                completeAction(response.requestId);
                break;
        }
    };

    const setEnabledAtBoot = (serviceId: string, enabledAtBoot: boolean) => {
        executeServiceAction(serviceId, enabledAtBoot ? "enable" : "disable");
    };

    const restartService = (serviceId: string) => {
        executeServiceAction(serviceId, "restart");
    };

    const bindTransport = (next: ServiceTransport) => {
        transport = next;
        if (next.pushMode === "push" || scheduled) {
            return;
        }
        scheduled = true;
        scheduleVisibilityInterval(SERVICE_CONTROL_INTERVAL_MS, 10 * SERVICE_CONTROL_INTERVAL_MS, () => { sendRequest("SERVICE_CONTROL"); });
        scheduleVisibilityInterval(SERVICE_STATUS_INTERVAL_MS, 10 * SERVICE_STATUS_INTERVAL_MS, () => { sendRequest("SERVICE_STATUS_ALL"); });
        if (transport.isConnected()) {
            sendRequest("SERVICE_CONTROL");
        }
    };

    const onConnected = (bootstrapDelayMs: number) => {
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
        if (transport?.pushMode === "push") {
            return;
        }
        bootstrapStatusTimer = setTimeout(() => {
            sendRequest("SERVICE_CONTROL");
            sendRequest("SERVICE_STATUS_ALL");
        }, bootstrapDelayMs);
    };

    const onDisconnected = () => {
        const hadPendingActions = serviceActions.size > 0;
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
        if (snapshot.health !== "unavailable" || Object.values(snapshot.statusById).some((state) => !state.stale)) {
            markAllServiceStatusesStale();
            publish();
        }
        return hadPendingActions;
    };

    const onLocaleChanged = (nextLocale: string) => {
        locale = normalizeLocale(nextLocale);
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
        restartService,
    };
}

let serviceStore: ReturnType<typeof createServiceControlStore> | undefined;

export function registerServiceControlIsland(bootstrap: DashboardBootstrapPayload): ReturnType<typeof createServiceControlStore> {
    const store = createServiceControlStore(bootstrap.serviceRows, window.quickboxLocale ?? "en", bootstrap.serviceKeys);
    serviceStore = store;
    window.quickboxServiceIsland = {
        bindTransport: store.bindTransport,
        onConnected: store.onConnected,
        onDisconnected: store.onDisconnected,
        onMessage: store.handleMessage,
        onActionResult: store.handleActionResult,
        onLocaleChanged: store.onLocaleChanged,
    };
    return store;
}

export function getServiceControlBridge(): ServiceIslandBridge | undefined {
    return window.quickboxServiceIsland;
}

export function ServiceControlSlot({ bootstrap, ready = true }: { bootstrap: DashboardBootstrapPayload; ready?: boolean }) {
    const store = serviceStore ?? registerServiceControlIsland(bootstrap);
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
    const activeTheme = useDashboardTheme(bootstrap.serviceTheme);
    const commandsConnected = useCommandConnection();
    return (
        <ServiceControlIsland
            rows={snapshot.rows}
            theme={activeTheme}
            statusById={snapshot.statusById}
            pendingById={snapshot.pendingById}
            commandsDisabled={!ready || !commandsConnected}
            loading={!ready}
            onRestart={store.restartService}
            onEnabledChange={store.setEnabledAtBoot}
        />
    );
}
