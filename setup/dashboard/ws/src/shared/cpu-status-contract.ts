// SPDX-License-Identifier: GPL-3.0-or-later

export interface CpuStaticData {
    model?: string;
    count?: number;
    speedGHz?: number;
    cache?: string;
}

export interface CpuStatusBridge {
    onMessage: (data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

export function isCpuStaticData(value: unknown): value is CpuStaticData {
    if (!isRecord(value)) {
        return false;
    }
    return Object.keys(value).every((key) => ["model", "count", "speedGHz", "cache"].includes(key)) &&
        (value.model === undefined || typeof value.model === "string") &&
        (value.count === undefined || isFiniteNumber(value.count)) &&
        (value.speedGHz === undefined || isFiniteNumber(value.speedGHz)) &&
        (value.cache === undefined || typeof value.cache === "string");
}
