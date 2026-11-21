// SPDX-License-Identifier: GPL-3.0-or-later

import { SYSTEM_LOAD_DATA_URL, SYSTEM_UPTIME_DATA_URL } from "./widget-streams";

export { SYSTEM_LOAD_DATA_URL, SYSTEM_UPTIME_DATA_URL };

export interface UptimeParts {
    days: number;
    hours: number;
    minutes: number;
}

export interface SystemLoadData {
    loadavg?: [number, number, number];
    currentLoad?: number;
    processes: number;
}

export interface SystemSummaryRuntime {
    uptime: UptimeParts;
}

export interface SystemSummaryBridge {
    onPrefetch: (data: unknown) => boolean;
    onMessage: (key: "TOP" | "UPTIME", data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

export function isSystemLoadData(value: unknown): value is SystemLoadData {
    if (!isRecord(value) || !isNonNegativeInteger(value.processes)) {
        return false;
    }
    const keys = Object.keys(value);
    if (keys.length !== 2) {
        return false;
    }
    if (Array.isArray(value.loadavg)) {
        return value.loadavg.length === 3 && value.loadavg.every(isFiniteNumber);
    }
    return isFiniteNumber(value.currentLoad);
}

export function isUptimeParts(value: unknown): value is UptimeParts {
    return isRecord(value) && Object.keys(value).length === 3 &&
        isNonNegativeInteger(value.days) && isNonNegativeInteger(value.hours) &&
        isNonNegativeInteger(value.minutes) && value.hours < 24 && value.minutes < 60;
}
