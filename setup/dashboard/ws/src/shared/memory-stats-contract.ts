// SPDX-License-Identifier: GPL-3.0-or-later

export interface MemoryProgress {
    percent: number;
    colorClass: "progress-bar-success" | "progress-bar-warning" | "progress-bar-danger";
}

export interface MemoryStatsData {
    labels: {
        physical: string;
        physicalUsed: string;
        physicalIdle: string;
        cached: string;
        real: string;
        swap: string;
        used: string;
        totalRam: string;
        clearCache: string;
    };
    physical: MemoryProgress & { used: string; free: string };
    cached?: MemoryProgress & { description: string; buffersDescription: string };
    real?: MemoryProgress & { description: string; freeDescription: string };
    swap?: MemoryProgress & { totalDescription: string; usedDescription: string; freeDescription: string };
    total: string;
}

export interface MemoryStatsBridge {
    onPrefetch: (data: unknown) => boolean;
    onMessage: (data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

function isProgress(value: unknown): value is MemoryProgress {
    return isRecord(value) && typeof value.percent === "number" && Number.isFinite(value.percent) &&
        (value.colorClass === "progress-bar-success" || value.colorClass === "progress-bar-warning" ||
            value.colorClass === "progress-bar-danger");
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
    return Object.keys(value).every((key) => allowed.includes(key));
}

function isMemoryLabels(value: unknown) {
    const fields = ["physical", "physicalUsed", "physicalIdle", "cached", "real", "swap", "used", "totalRam", "clearCache"];
    return isRecord(value) && Object.keys(value).length === fields.length &&
        fields.every((key) => typeof value[key] === "string");
}

function isProgressSection(value: unknown, descriptionFields: string[]) {
    if (!isRecord(value) || !isProgress(value) || !hasOnlyKeys(value, ["percent", "colorClass", ...descriptionFields])) {
        return false;
    }
    return descriptionFields.every((field) => typeof value[field] === "string");
}

function isOptionalProgressSection(value: Record<string, unknown>, key: string, fields: string[]) {
    return value[key] === undefined || isProgressSection(value[key], fields);
}

export function isMemoryStatsData(value: unknown): value is MemoryStatsData {
    if (!isRecord(value) || !hasOnlyKeys(value, ["labels", "physical", "cached", "real", "swap", "total"]) ||
        !["labels", "physical", "total"].every((key) => Object.hasOwn(value, key))) {
        return false;
    }
    return isMemoryLabels(value.labels) && typeof value.total === "string" &&
        isProgressSection(value.physical, ["used", "free"]) &&
        isOptionalProgressSection(value, "cached", ["description", "buffersDescription"]) &&
        isOptionalProgressSection(value, "real", ["description", "freeDescription"]) &&
        isOptionalProgressSection(value, "swap", ["totalDescription", "usedDescription", "freeDescription"]);
}
