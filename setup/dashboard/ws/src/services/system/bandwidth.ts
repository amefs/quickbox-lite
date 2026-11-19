/* eslint-disable camelcase */
import { getVnstatData, ParsedTrafficEntry, ParsedVnstatData } from "../../utils/vnstat";
import type {
    BandwidthDetailRow,
    BandwidthPage,
    BandwidthSummaryRow,
    BandwidthTableData,
} from "../../shared/bandwidth-contract";

function summaryEntries(data: ParsedVnstatData): BandwidthSummaryRow[] {
    const trx = data.summary.totalrx;
    const ttx = data.summary.totaltx;
    const ttime = Math.max(1, Math.floor(Date.now() / 1000) - data.summary.created);
    const trx_avg = Math.round(trx / ttime) * 8;
    const ttx_avg = Math.round(ttx / ttime) * 8;

    const sum: BandwidthSummaryRow[] = [];

    if (data.hour.length > 0 && data.day.length > 0 && data.month.length > 0) {
        const lastHour = data.hour[data.hour.length - 1];
        const lastDay = data.day[data.day.length - 1];
        const lastMonth = data.month[data.month.length - 1];
        sum.push({
            label: "hour",
            rx: lastHour.rx,
            tx: lastHour.tx,
            rxAvg: lastHour.rx_avg,
            txAvg: lastHour.tx_avg,
        });
        sum.push({
            label: "day",
            rx: lastDay.rx,
            tx: lastDay.tx,
            rxAvg: lastDay.rx_avg,
            txAvg: lastDay.tx_avg,
        });
        sum.push({
            label: "month",
            rx: lastMonth.rx,
            tx: lastMonth.tx,
            rxAvg: lastMonth.rx_avg,
            txAvg: lastMonth.tx_avg,
        });
        sum.push({
            label: "all",
            rx: trx,
            tx: ttx,
            rxAvg: trx_avg,
            txAvg: ttx_avg,
        });
    }

    return sum;
}

function toDetailRows(entries: ParsedTrafficEntry[]): BandwidthDetailRow[] {
    return entries.map((item) => ({
        time: item.time,
        rx: item.rx,
        tx: item.tx,
        rxAvg: item.rx_avg,
        txAvg: item.tx_avg,
    }));
}

export async function bandwidthTablesData(iface: string, page: BandwidthPage | undefined, signal?: AbortSignal): Promise<BandwidthTableData> {
    const vnstatData = await getVnstatData(iface, signal);
    const resolvedPage: BandwidthPage = page === "d" || page === "m" || page === "t" ? page : "h";
    const detailEntries = resolvedPage === "d"
        ? vnstatData.day
        : resolvedPage === "m"
            ? vnstatData.month
            : resolvedPage === "t"
                ? vnstatData.top
                : vnstatData.hour;

    return {
        page: resolvedPage,
        summary: summaryEntries(vnstatData),
        detail: toDetailRows(detailEntries),
    };
}
