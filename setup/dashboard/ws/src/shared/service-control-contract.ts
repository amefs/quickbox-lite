// SPDX-License-Identifier: GPL-3.0-or-later

import { SERVICE_CONTROL_URL, SERVICE_STATUS_ALL_URL } from "./widget-streams";

export { SERVICE_CONTROL_URL, SERVICE_STATUS_ALL_URL };
export const SERVICE_LOCALES = ["da", "de", "en", "es", "fr", "zh"] as const;

export type ServiceLocale = typeof SERVICE_LOCALES[number];
export type ServiceTarget =
    | { key: "SERVICE_CONTROL"; url: typeof SERVICE_CONTROL_URL }
    | { key: "SERVICE_STATUS_ALL"; url: typeof SERVICE_STATUS_ALL_URL };

export interface ServiceRequestV2 {
    protocolVersion: 2;
    key: ServiceTarget["key"];
    url: ServiceTarget["url"];
    requestId: string;
    locale: ServiceLocale;
    generation: number;
}

export interface ServiceControlLabels {
    title: string;
    status: string;
    restart: string;
    enableDisable: string;
    refresh: string;
    enabled: string;
    disabled: string;
    serviceStatusUnconfirmed: string;
    serviceStatusStale: string;
    serviceStatusLastConfirmedTemplate: string;
}

export type ServiceTooltipIcon = "info" | "usb";

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

export interface ServiceResponseMeta extends Omit<ServiceRequestV2, "url" | "key"> {
    key: ServiceTarget["key"];
    url: ServiceTarget["url"];
}

export type ServiceResponseV2 =
    | {
        meta: ServiceResponseMeta & { key: "SERVICE_CONTROL"; url: typeof SERVICE_CONTROL_URL };
        status: "success";
        data: { rows: [ServiceRow, ...ServiceRow[]] };
    }
    | {
        meta: ServiceResponseMeta & { key: "SERVICE_CONTROL"; url: typeof SERVICE_CONTROL_URL };
        status: "empty";
        data: { rows: [] };
    }
    | {
        meta: ServiceResponseMeta & { key: "SERVICE_STATUS_ALL"; url: typeof SERVICE_STATUS_ALL_URL };
        status: "success";
        data: {
            states: Record<string, ServiceState>;
            health: "ok" | "degraded" | "unavailable";
            retryAfterMs: number;
        };
    }
    | {
        meta: ServiceResponseMeta;
        status: "error";
        error: { code: string; message: string };
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, expected: string[]) => {
    const keys = Object.keys(value);
    return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
};

const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
    Object.keys(value).every((key) => allowed.includes(key));

export function parseServiceRequestV2(value: unknown): ServiceRequestV2 | null {
    if (!isRecord(value) || !hasExactKeys(value, ["protocolVersion", "key", "url", "requestId", "locale", "generation"])) {
        return null;
    }
    if (!((value.key === "SERVICE_CONTROL" && value.url === SERVICE_CONTROL_URL) ||
        (value.key === "SERVICE_STATUS_ALL" && value.url === SERVICE_STATUS_ALL_URL))) {
        return null;
    }
    if (value.protocolVersion !== 2 || typeof value.requestId !== "string" ||
        !value.requestId.startsWith(`${value.key}:`) || value.requestId.length === value.key.length + 1 ||
        typeof value.locale !== "string" || !SERVICE_LOCALES.includes(value.locale as ServiceLocale) ||
        typeof value.generation !== "number" || !Number.isSafeInteger(value.generation) || value.generation < 0) {
        return null;
    }
    return value as unknown as ServiceRequestV2;
}

function isServiceRow(value: unknown): value is ServiceRow {
    if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0 ||
        typeof value.name !== "string" || typeof value.enabledAtBoot !== "boolean" ||
        !hasOnlyKeys(value, ["id", "name", "enabledAtBoot", "tooltip", "tooltipIcon"])) {
        return false;
    }
    return (value.tooltip === undefined || typeof value.tooltip === "string") &&
        (value.tooltipIcon === undefined || value.tooltipIcon === "info" || value.tooltipIcon === "usb");
}

function isResponseMeta(value: unknown): value is ServiceResponseMeta {
    if (!isRecord(value)) {
        return false;
    }
    return hasExactKeys(value, ["protocolVersion", "key", "url", "requestId", "locale", "generation"]) &&
        value.protocolVersion === 2 && typeof value.requestId === "string" && value.requestId.length > 0 &&
        typeof value.locale === "string" && SERVICE_LOCALES.includes(value.locale as ServiceLocale) &&
        typeof value.generation === "number" && Number.isSafeInteger(value.generation) && value.generation >= 0 &&
        ((value.key === "SERVICE_CONTROL" && value.url === SERVICE_CONTROL_URL) ||
            (value.key === "SERVICE_STATUS_ALL" && value.url === SERVICE_STATUS_ALL_URL));
}

export interface ServiceControlData {
    rows: ServiceRow[];
}

export interface ServiceStatusAllData {
    states: Record<string, ServiceState>;
    health: "ok" | "degraded" | "unavailable";
    retryAfterMs: number;
}

export function isServiceControlData(value: unknown): value is ServiceControlData {
    return isRecord(value) && hasExactKeys(value, ["rows"]) &&
        Array.isArray(value.rows) && value.rows.every(isServiceRow);
}

function isServiceControlDataResponse(value: Record<string, unknown>, status: "success" | "empty") {
    if (!hasExactKeys(value, ["meta", "status", "data"]) || !isServiceControlData(value.data)) {
        return false;
    }
    return status === "empty" ? value.data.rows.length === 0 : value.data.rows.length > 0;
}

function isServiceState(value: unknown): value is ServiceState {
    return isRecord(value) && hasExactKeys(value, ["value", "observedAt", "stale"]) &&
        (value.value === null || typeof value.value === "boolean") &&
        (value.observedAt === null || (typeof value.observedAt === "number" && Number.isFinite(value.observedAt))) &&
        typeof value.stale === "boolean";
}

export function isServiceStatusAllData(value: unknown): value is ServiceStatusAllData {
    return isRecord(value) && hasExactKeys(value, ["states", "health", "retryAfterMs"]) &&
        isRecord(value.states) && Object.values(value.states).every(isServiceState) &&
        ["ok", "degraded", "unavailable"].includes(String(value.health)) &&
        typeof value.retryAfterMs === "number" && Number.isFinite(value.retryAfterMs) && value.retryAfterMs >= 0;
}

function isStatusMapResponse(value: Record<string, unknown>) {
    return hasExactKeys(value, ["meta", "status", "data"]) && isServiceStatusAllData(value.data);
}

export function isServiceResponseV2(value: unknown): value is ServiceResponseV2 {
    if (!isRecord(value) || !isResponseMeta(value.meta)) {
        return false;
    }
    if (value.status === "error") {
        return hasExactKeys(value, ["meta", "status", "error"]) && isRecord(value.error) &&
            hasExactKeys(value.error, ["code", "message"]) &&
            typeof value.error.code === "string" && typeof value.error.message === "string";
    }
    if (value.meta.key === "SERVICE_CONTROL") {
        return value.status === "success" || value.status === "empty"
            ? isServiceControlDataResponse(value, value.status)
            : false;
    }
    return value.status === "success" && isStatusMapResponse(value);
}
