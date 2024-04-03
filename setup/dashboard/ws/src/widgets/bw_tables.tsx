/* eslint-disable camelcase */
import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getVnstatData, ParsedTrafficEntry, ParsedVnstatData } from "../utils/vnstat";
import { formatSize, formatSpeed } from "../utils";

function writeDataTable(caption: string, tab: ParsedTrafficEntry[]) {

    const evenOdd = (index: number) => index % 2 === 1 ? "odd" : "even";

    return (
        <table className="table table-hover table-default nomargin" width="100%" cellSpacing="0">
            <thead>
                <tr>
                    <th className="text-right" style={{ width: "20%" }}>{caption}</th>
                    <th className="text-right" style={{ width: "15%" }}>{i18n.t("Out")}</th>
                    <th className="text-left" style={{ width: "15%" }}>{i18n.t("In")}</th>
                    <th className="text-right" style={{ width: "15%" }}>{i18n.t("Out_AVG")}</th>
                    <th className="text-left" style={{ width: "15%" }}>{i18n.t("In_AVG")}</th>
                    <th className="text-left" style={{ width: "18%" }}>{i18n.t("Total")}</th>
                </tr>
            </thead>
            <tbody>
                {tab.map((item, index) => (
                    <tr key={index}>
                        <td className={`label_${evenOdd(index)}`} style={{ fontSize: "12px", textAlign: "right" }}>
                            <b>{item.label}</b>
                        </td>
                        <td className={`numeric_${evenOdd(index)} text-success`} style={{ fontSize: "12px", textAlign: "right" }}>
                            {formatSize(item.tx)}
                        </td>
                        <td className={`numeric_${evenOdd(index)} text-primary`} style={{ fontSize: "12px", textAlign: "left" }}>
                            {formatSize(item.rx)}
                        </td>
                        <td className={`numeric_${evenOdd(index)} text-success`} style={{ fontSize: "12px", textAlign: "right" }}>
                            {formatSpeed(item.tx_avg)}
                        </td>
                        <td className={`numeric_${evenOdd(index)} text-primary`} style={{ fontSize: "12px", textAlign: "left" }}>
                            {formatSpeed(item.rx_avg)}
                        </td>
                        <td className={`numeric_${evenOdd(index)}`} style={{ fontSize: "12px", textAlign: "left" }}>
                            {formatSize(item.rx + item.tx)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function writeSummary(data: ParsedVnstatData) {

    const trx = data.summary.totalrx;
    const ttx = data.summary.totaltx;
    const ttime = Math.floor(Date.now() / 1000) - data.summary.created;
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

    return writeDataTable(i18n.t("Summary"), sum);
}

export async function bwTables(iface: string, page: "h"|"d"|"m"|"t") {
    const vnstatData = await getVnstatData(iface);

    const renderDataTable = () => {
        if (page === undefined || page === "h") {
            return writeDataTable(i18n.t("Recent hours"), vnstatData.hour);
        } else if (page === "d") {
            return writeDataTable(i18n.t("Last 30 days"), vnstatData.day);
        } else if (page === "m") {
            return writeDataTable(i18n.t("Last 12 months"), vnstatData.month);
        } else if (page === "t") {
            return writeDataTable(i18n.t("Top 10 days"), vnstatData.top);
        }
        return null;
    };

    return ReactDOMServer.renderToString(
        <div className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="table-responsive">
                {writeSummary(vnstatData)}
            </div>
            <div className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div className="table-responsive">{renderDataTable()}</div>
            </div>
        </div>
    );
}
