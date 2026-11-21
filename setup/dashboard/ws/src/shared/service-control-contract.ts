// SPDX-License-Identifier: GPL-3.0-or-later

import { SERVICE_CONTROL_URL, SERVICE_STATUS_ALL_URL } from "./widget-streams";

export const SERVICE_STREAM_URLS = {
    SERVICE_CONTROL: SERVICE_CONTROL_URL,
    SERVICE_STATUS_ALL: SERVICE_STATUS_ALL_URL,
} as const;
export const SERVICE_LOCALES = ["da", "de", "en", "es", "fr", "zh"] as const;

export type ServiceKey = keyof typeof SERVICE_STREAM_URLS;
export type ServiceLocale = typeof SERVICE_LOCALES[number];
export type ServiceTooltipIcon = "info" | "usb";
export type ServiceActionName = "enable" | "disable" | "restart";

export interface ServiceActionRequest {
    requestId?: string;
    service: string;
    action: ServiceActionName;
    locale?: ServiceLocale;
}

export interface ServiceRow {
    id: string;
    name: string;
    enabledAtBoot: boolean;
    tooltip?: string;
    tooltipIcon?: ServiceTooltipIcon;
}

export interface ServiceState {
    value: boolean | null;
    observedAt: number | null;
    stale: boolean;
}

interface ServiceControlData {
    rows: ServiceRow[];
}

export interface ServiceStatusAllData {
    states: Record<string, ServiceState>;
    health: "ok" | "degraded" | "unavailable";
    retryAfterMs: number;
}

interface ServiceDataByKey {
    SERVICE_CONTROL: ServiceControlData;
    SERVICE_STATUS_ALL: ServiceStatusAllData;
}

export type ServiceDataMessage = {
    [Key in ServiceKey]: { key: Key; response: ServiceDataByKey[Key] };
}[ServiceKey];

interface ServiceActionResultBase {
    requestId?: string;
    service: string;
    action: string;
    success: boolean;
    message: string;
    failedOperation?: string;
    completedOperations: string[];
    stdout: string;
    stderr: string;
}

export interface ServiceActionRejectedResult extends ServiceActionResultBase {
    phase: "rejected";
    success: false;
}

export interface ServiceActionCompleteResult extends ServiceActionResultBase {
    phase: "action-complete";
}

export interface ServiceActionConfirmedResult extends ServiceActionResultBase {
    phase: "status-confirmed";
    enabled?: boolean;
    statusData?: ServiceStatusAllData;
    statusError?: string;
}

export type ServiceActionResult =
    | ServiceActionRejectedResult
    | ServiceActionCompleteResult
    | ServiceActionConfirmedResult;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

export function isServiceKey(value: unknown): value is ServiceKey {
    return typeof value === "string" && Object.hasOwn(SERVICE_STREAM_URLS, value);
}

function isServiceRow(value: unknown): value is ServiceRow {
    return isRecord(value) &&
        typeof value.id === "string" && value.id.length > 0 &&
        typeof value.name === "string" &&
        typeof value.enabledAtBoot === "boolean" &&
        (value.tooltip === undefined || typeof value.tooltip === "string") &&
        (value.tooltipIcon === undefined || value.tooltipIcon === "info" || value.tooltipIcon === "usb");
}

function isServiceControlData(value: unknown): value is ServiceControlData {
    return isRecord(value) && Array.isArray(value.rows) && value.rows.every(isServiceRow);
}

function isServiceState(value: unknown): value is ServiceState {
    return isRecord(value) &&
        (value.value === null || typeof value.value === "boolean") &&
        (value.observedAt === null || (typeof value.observedAt === "number" && Number.isFinite(value.observedAt))) &&
        typeof value.stale === "boolean";
}

export function isServiceStatusAllData(value: unknown): value is ServiceStatusAllData {
    return isRecord(value) && isRecord(value.states) && Object.values(value.states).every(isServiceState) &&
        (value.health === "ok" || value.health === "degraded" || value.health === "unavailable") &&
        typeof value.retryAfterMs === "number" && Number.isFinite(value.retryAfterMs) && value.retryAfterMs >= 0;
}

const serviceDataValidators = {
    SERVICE_CONTROL: isServiceControlData,
    SERVICE_STATUS_ALL: isServiceStatusAllData,
} satisfies { [Key in ServiceKey]: (value: unknown) => value is ServiceDataByKey[Key] };

export function isServiceDataMessage(message: { key: ServiceKey; response: unknown }): message is ServiceDataMessage {
    return serviceDataValidators[message.key](message.response);
}

const isOptionalString = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === "string";

function isServiceActionResultBase(value: unknown): value is ServiceActionResultBase {
    return isRecord(value) &&
        isOptionalString(value.requestId) &&
        typeof value.service === "string" &&
        typeof value.action === "string" &&
        typeof value.success === "boolean" &&
        typeof value.message === "string" &&
        isOptionalString(value.failedOperation) &&
        Array.isArray(value.completedOperations) &&
        value.completedOperations.every((operation) => typeof operation === "string") &&
        typeof value.stdout === "string" &&
        typeof value.stderr === "string";
}

export function isServiceActionResult(value: unknown): value is ServiceActionResult {
    if (!isServiceActionResultBase(value)) {
        return false;
    }
    const candidate = value as ServiceActionResult;
    switch (candidate.phase) {
        case "rejected":
            return !candidate.success;
        case "action-complete":
            return true;
        case "status-confirmed":
            return (candidate.enabled === undefined || typeof candidate.enabled === "boolean") &&
                isOptionalString(candidate.statusError) &&
                (candidate.statusData === undefined || isServiceStatusAllData(candidate.statusData));
        default:
            return false;
    }
}
