// SPDX-License-Identifier: GPL-3.0-or-later

export interface CpuStaticData {
    model: string;
    count: number | string;
    frequency?: string;
    cache?: string;
}

export interface CpuStatusBridge {
    onMessage: (data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

export function isCpuStaticData(value: unknown): value is CpuStaticData {
    if (!isRecord(value) || typeof value.model !== "string" ||
        !(typeof value.count === "string" || typeof value.count === "number") ||
        !["model", "count", "frequency", "cache"].every((key) => Object.hasOwn(value, key) ||
            (key === "frequency" || key === "cache"))) {
        return false;
    }
    return Object.keys(value).every((key) => ["model", "count", "frequency", "cache"].includes(key)) &&
        (value.frequency === undefined || typeof value.frequency === "string") &&
        (value.cache === undefined || typeof value.cache === "string");
}
