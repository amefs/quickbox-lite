// SPDX-License-Identifier: GPL-3.0-or-later

export type BandwidthPage = "h" | "d" | "m" | "t";

export type BandwidthSummaryLabel = "hour" | "day" | "month" | "all";

export interface BandwidthSummaryRow {
    label: BandwidthSummaryLabel;
    rx: number;
    tx: number;
    rxAvg: number;
    txAvg: number;
}

export interface BandwidthDetailRow {
    time: number;
    rx: number;
    tx: number;
    rxAvg: number;
    txAvg: number;
}

export interface BandwidthTableData {
    page: BandwidthPage;
    summary: BandwidthSummaryRow[];
    detail: BandwidthDetailRow[];
}

export interface BandwidthIslandBridge {
    onMessage: (data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) =>
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

const isSummaryLabel = (value: unknown): value is BandwidthSummaryLabel =>
    value === "hour" || value === "day" || value === "month" || value === "all";

function isSummaryRow(value: unknown): value is BandwidthSummaryRow {
    return isRecord(value) && hasExactKeys(value, ["label", "rx", "tx", "rxAvg", "txAvg"]) &&
        isSummaryLabel(value.label) &&
        isFiniteNumber(value.rx) && isFiniteNumber(value.tx) &&
        isFiniteNumber(value.rxAvg) && isFiniteNumber(value.txAvg);
}

function isDetailRow(value: unknown): value is BandwidthDetailRow {
    return isRecord(value) && hasExactKeys(value, ["time", "rx", "tx", "rxAvg", "txAvg"]) &&
        isFiniteNumber(value.time) &&
        isFiniteNumber(value.rx) && isFiniteNumber(value.tx) &&
        isFiniteNumber(value.rxAvg) && isFiniteNumber(value.txAvg);
}

export function isBandwidthTableData(value: unknown): value is BandwidthTableData {
    return isRecord(value) && hasExactKeys(value, ["page", "summary", "detail"]) &&
        (value.page === "h" || value.page === "d" || value.page === "m" || value.page === "t") &&
        Array.isArray(value.summary) && value.summary.every(isSummaryRow) &&
        Array.isArray(value.detail) && value.detail.every(isDetailRow);
}
