// SPDX-License-Identifier: GPL-3.0-or-later

export interface BandwidthTableRow {
    label: string;
    out: string;
    incoming: string;
    outAverage: string;
    inAverage: string;
    total: string;
}

export interface BandwidthTableData {
    columns: {
        out: string;
        incoming: string;
        outAverage: string;
        inAverage: string;
        total: string;
    };
    summary: { caption: string; rows: BandwidthTableRow[] };
    detail: { caption: string; rows: BandwidthTableRow[] };
}

export interface BandwidthIslandBridge {
    onMessage: (data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) =>
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function isRow(value: unknown): value is BandwidthTableRow {
    return isRecord(value) && hasExactKeys(value, ["label", "out", "incoming", "outAverage", "inAverage", "total"]) &&
        Object.values(value).every((cell) => typeof cell === "string");
}

export function isBandwidthTableData(value: unknown): value is BandwidthTableData {
    if (!isRecord(value) || !hasExactKeys(value, ["columns", "summary", "detail"]) ||
        !isRecord(value.columns) || !hasExactKeys(value.columns, ["out", "incoming", "outAverage", "inAverage", "total"]) ||
        !Object.values(value.columns).every((column) => typeof column === "string")) {
        return false;
    }
    return [value.summary, value.detail].every((table) =>
        isRecord(table) && hasExactKeys(table, ["caption", "rows"]) && typeof table.caption === "string" &&
        Array.isArray(table.rows) && table.rows.every(isRow),
    );
}
