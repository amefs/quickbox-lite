/* eslint-disable camelcase */
import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getVnstatData, ParsedTrafficEntry, ParsedVnstatData } from "../utils/vnstat";
import { formatSize, formatSpeed } from "../utils/helpers";
import type { BandwidthTableData, BandwidthTableRow } from "../shared/bandwidth-contract";
import { BandwidthTablesView } from "./bandwidth-tables-view";

function summaryEntries(data: ParsedVnstatData): ParsedTrafficEntry[] {

    const trx = data.summary.totalrx;
    const ttx = data.summary.totaltx;
    const ttime = Math.max(1, Math.floor(Date.now() / 1000) - data.summary.created);
    const trx_avg = Math.round(trx / ttime) * 8;
    const ttx_avg = Math.round(ttx / ttime) * 8;

    const sum: ParsedTrafficEntry[] = [];

    if (data.hour.length > 0 && data.day.length > 0 && data.month.length > 0) {
        sum.push({
            time: NaN,
            label: i18n.t("This hour"),
            rx: data.hour[data.hour.length - 1].rx,
            tx: data.hour[data.hour.length - 1].tx,
            rx_avg: data.hour[data.hour.length - 1].rx_avg,
            tx_avg: data.hour[data.hour.length - 1].tx_avg,
        });
        sum.push({
            time: NaN,
            label: i18n.t("This day"),
            rx: data.day[data.day.length - 1].rx,
            tx: data.day[data.day.length - 1].tx,
            rx_avg: data.day[data.day.length - 1].rx_avg,
            tx_avg: data.day[data.day.length - 1].tx_avg,
        });
        sum.push({
            time: NaN,
            label: i18n.t("This month"),
            rx: data.month[data.month.length - 1].rx,
            tx: data.month[data.month.length - 1].tx,
            rx_avg: data.month[data.month.length - 1].rx_avg,
            tx_avg: data.month[data.month.length - 1].tx_avg,
        });
        sum.push({
            time: NaN,
            label: i18n.t("All time"),
            rx: trx,
            tx: ttx,
            rx_avg: trx_avg,
            tx_avg: ttx_avg,
        });
    }

    return sum;
}

function displayRows(entries: ParsedTrafficEntry[]): BandwidthTableRow[] {
    return entries.map((item) => ({
        label: item.label,
        out: formatSize(item.tx),
        incoming: formatSize(item.rx),
        outAverage: formatSpeed(item.tx_avg),
        inAverage: formatSpeed(item.rx_avg),
        total: formatSize(item.rx + item.tx),
    }));
}

export async function bandwidthTablesData(iface: string, page: "h"|"d"|"m"|"t"|undefined): Promise<BandwidthTableData> {
    const vnstatData = await getVnstatData(iface);
    let detailCaption: string;
    let detailEntries: ParsedTrafficEntry[];
    if (page === undefined || page === "h") {
        detailCaption = i18n.t("Recent hours");
        detailEntries = vnstatData.hour;
    } else if (page === "d") {
        detailCaption = i18n.t("Last 30 days");
        detailEntries = vnstatData.day;
    } else if (page === "m") {
        detailCaption = i18n.t("Last 12 months");
        detailEntries = vnstatData.month;
    } else {
        detailCaption = i18n.t("Top 10 days");
        detailEntries = vnstatData.top;
    }

    return {
        columns: {
            out: i18n.t("Out"),
            incoming: i18n.t("In"),
            outAverage: i18n.t("Out_AVG"),
            inAverage: i18n.t("In_AVG"),
            total: i18n.t("Total"),
        },
        summary: { caption: i18n.t("Summary"), rows: displayRows(summaryEntries(vnstatData)) },
        detail: { caption: detailCaption, rows: displayRows(detailEntries) },
    };
}

export async function bwTables(iface: string, page: "h"|"d"|"m"|"t"|undefined) {
    const data = await bandwidthTablesData(iface, page);
    return ReactDOMServer.renderToString(<BandwidthTablesView data={data} />);
}
