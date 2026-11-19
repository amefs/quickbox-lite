// SPDX-License-Identifier: GPL-3.0-or-later

export const SYSTEM_LOAD_DATA_URL = "/node/data/system_load" as const;
export const SYSTEM_UPTIME_DATA_URL = "/node/data/system_uptime" as const;

export interface UptimeParts {
    days: number;
    hours: number;
    minutes: number;
}

export interface SystemLoadData {
    text: string;
}

export interface SystemSummaryLabels {
    days: string;
    hours: string;
    minutes: string;
}

export interface SystemSummaryRuntime {
    uptime: UptimeParts;
    labels: SystemSummaryLabels;
}

export interface SystemSummaryBridge {
    onPrefetch: (data: unknown) => boolean;
    onMessage: (key: "TOP" | "UPTIME", data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function isSystemLoadData(value: unknown): value is SystemLoadData {
    return isRecord(value) && Object.keys(value).length === 1 &&
        typeof value.text === "string";
}

export function isUptimeParts(value: unknown): value is UptimeParts {
    return isRecord(value) && Object.keys(value).length === 3 &&
        isNonNegativeInteger(value.days) && isNonNegativeInteger(value.hours) &&
        isNonNegativeInteger(value.minutes) && value.hours < 24 && value.minutes < 60;
}
