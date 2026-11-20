// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { useTranslation } from "react-i18next";

import type {
    BandwidthDetailRow,
    BandwidthPage,
    BandwidthSummaryLabel,
    BandwidthSummaryRow,
    BandwidthTableData,
} from "../../../ws/src/shared/bandwidth-contract";
import { formatSize, formatSpeed } from "../utils/format";
import { SkeletonText } from "./placeholder";

const SUMMARY_LABEL_KEYS: Record<BandwidthSummaryLabel, string> = {
    hour: "This hour",
    day: "This day",
    month: "This month",
    all: "All time",
};

const DETAIL_CAPTION_KEYS: Record<BandwidthPage, string> = {
    h: "Recent hours",
    d: "Last 30 days",
    m: "Last 12 months",
    t: "Top 10 days",
};

function formatDetailTime(time: number, page: BandwidthPage, locale: string): string {
    const date = new Date(time);
    const resolvedLocale = locale || undefined;
    if (page === "h") {
        return date.toLocaleTimeString(resolvedLocale, { hour: "numeric" });
    }
    if (page === "d") {
        return date.toLocaleDateString(resolvedLocale, { day: "numeric", month: "short" });
    }
    if (page === "m") {
        return date.toLocaleDateString(resolvedLocale, { month: "long", year: "numeric" });
    }
    return date.toLocaleDateString(resolvedLocale, { day: "numeric", month: "short", year: "numeric" });
}

interface DisplayRow {
    label: string;
    rx: number;
    tx: number;
    rxAvg: number;
    txAvg: number;
}

function DataTable({ captionKey, rows, placeholderRows = 0 }: {
    captionKey: string;
    rows: DisplayRow[];
    placeholderRows?: number;
}) {
    const { t } = useTranslation();
    const evenOdd = (index: number) => index % 2 === 1 ? "odd" : "even";
    return (
        <table className="table table-hover table-default nomargin" width="100%" cellSpacing="0">
            <thead>
                <tr>
                    <th className="text-right" style={{ width: "20%" }}>{t(captionKey)}</th>
                    <th className="text-right" style={{ width: "15%" }}>{t("Out")}</th>
                    <th className="text-left" style={{ width: "15%" }}>{t("In")}</th>
                    <th className="text-right" style={{ width: "15%" }}>{t("Out_AVG")}</th>
                    <th className="text-left" style={{ width: "15%" }}>{t("In_AVG")}</th>
                    <th className="text-left" style={{ width: "18%" }}>{t("Total")}</th>
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: placeholderRows }, (_row, index) => (
                    <tr key={index} aria-hidden="true">
                        {[0, 1, 2, 3, 4, 5].map((column) => (
                            <td key={column} style={{ fontSize: "12px" }}><SkeletonText width={column === 0 ? "75%" : "60%"} /></td>
                        ))}
                    </tr>
                ))}
                {rows.map((row, index) => (
                    <tr key={index}>
                        <td className={`label_${evenOdd(index)}`} style={{ fontSize: "12px", textAlign: "right" }}><b>{row.label}</b></td>
                        <td className={`numeric_${evenOdd(index)} text-success`} style={{ fontSize: "12px", textAlign: "right" }}>{formatSize(row.tx)}</td>
                        <td className={`numeric_${evenOdd(index)} text-primary`} style={{ fontSize: "12px", textAlign: "left" }}>{formatSize(row.rx)}</td>
                        <td className={`numeric_${evenOdd(index)} text-success`} style={{ fontSize: "12px", textAlign: "right" }}>{formatSpeed(row.txAvg)}</td>
                        <td className={`numeric_${evenOdd(index)} text-primary`} style={{ fontSize: "12px", textAlign: "left" }}>{formatSpeed(row.rxAvg)}</td>
                        <td className={`numeric_${evenOdd(index)}`} style={{ fontSize: "12px", textAlign: "left" }}>{formatSize(row.rx + row.tx)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function BandwidthTablesRoot({ data }: { data: BandwidthTableData | null }) {
    const { t, i18n } = useTranslation();
    const summaryRows: DisplayRow[] = (data?.summary ?? []).map((row: BandwidthSummaryRow) => ({
        label: t(SUMMARY_LABEL_KEYS[row.label]),
        rx: row.rx,
        tx: row.tx,
        rxAvg: row.rxAvg,
        txAvg: row.txAvg,
    }));
    const page = data?.page ?? "t";
    const detailRows: DisplayRow[] = (data?.detail ?? []).map((row: BandwidthDetailRow) => ({
        label: formatDetailTime(row.time, page, i18n.language),
        rx: row.rx,
        tx: row.tx,
        rxAvg: row.rxAvg,
        txAvg: row.txAvg,
    }));

    return (
        <div id={data ? undefined : "bw_tables_loading"} className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }} aria-busy={!data}>
            <div className="table-responsive">
                <DataTable captionKey="Summary" rows={summaryRows} placeholderRows={data ? 0 : 4} />
            </div>
            <div className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div className="table-responsive">
                    <DataTable captionKey={DETAIL_CAPTION_KEYS[page]} rows={detailRows} placeholderRows={data ? 0 : 1} />
                </div>
            </div>
        </div>
    );
}
