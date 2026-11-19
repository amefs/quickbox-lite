// SPDX-License-Identifier: GPL-3.0-or-later

export interface DiskFileSystemRow {
    mount: string;
    used: string;
    available: string;
    size: string;
    percent: number;
    percentText: string;
    progressClass: "progress-bar-success" | "progress-bar-warning" | "progress-bar-danger";
    diskClass: "disk-good" | "disk-warning" | "disk-danger";
}

export interface DiskTorrentRow {
    key: string;
    title: string;
    loadedHtml: string;
    loaded?: number;
}

export interface DiskDataData {
    labels: {
        mountPoint: string;
        diskSpace: string;
        free: string;
        used: string;
        size: string;
    };
    fileSystems: DiskFileSystemRow[];
    torrents: DiskTorrentRow[];
}

export interface DiskDataBridge {
    onPrefetch: (data: unknown) => boolean;
    onMessage: (data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
    Object.keys(value).every((key) => allowed.includes(key));

function isFileSystemRow(value: unknown): value is DiskFileSystemRow {
    return isRecord(value) && hasOnlyKeys(value, ["mount", "used", "available", "size", "percent", "percentText", "progressClass", "diskClass"]) &&
        typeof value.mount === "string" && typeof value.used === "string" && typeof value.available === "string" &&
        typeof value.size === "string" && typeof value.percent === "number" && Number.isFinite(value.percent) &&
        typeof value.percentText === "string" &&
        (value.progressClass === "progress-bar-success" || value.progressClass === "progress-bar-warning" || value.progressClass === "progress-bar-danger") &&
        (value.diskClass === "disk-good" || value.diskClass === "disk-warning" || value.diskClass === "disk-danger");
}

function isTorrentRow(value: unknown): value is DiskTorrentRow {
    return isRecord(value) && hasOnlyKeys(value, ["key", "title", "loadedHtml", "loaded"]) &&
        typeof value.key === "string" && typeof value.title === "string" && typeof value.loadedHtml === "string" &&
        (value.loaded === undefined || (typeof value.loaded === "number" && Number.isFinite(value.loaded)));
}

export function isDiskDataData(value: unknown): value is DiskDataData {
    if (!isRecord(value) || !hasOnlyKeys(value, ["labels", "fileSystems", "torrents"]) ||
        !isRecord(value.labels) || !hasOnlyKeys(value.labels, ["mountPoint", "diskSpace", "free", "used", "size"]) ||
        Object.keys(value.labels).length !== 5 || !Object.values(value.labels).every((label) => typeof label === "string") ||
        !Array.isArray(value.fileSystems) || !value.fileSystems.every(isFileSystemRow) ||
        !Array.isArray(value.torrents) || !value.torrents.every(isTorrentRow)) {
        return false;
    }
    return true;
}
