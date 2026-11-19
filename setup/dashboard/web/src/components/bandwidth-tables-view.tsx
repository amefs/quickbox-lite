// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { useTranslation } from "react-i18next";

import type { BandwidthTableData, BandwidthTableRow } from "../../../ws/src/shared/bandwidth-contract";
import { BandwidthTablePlaceholder } from "./placeholder";

function DataTable({ caption, rows, columns }: {
    caption: string;
    rows: BandwidthTableRow[];
    columns: BandwidthTableData["columns"];
}) {
    const { t } = useTranslation();
    const evenOdd = (index: number) => index % 2 === 1 ? "odd" : "even";
    return (
        <table className="table table-hover table-default nomargin" width="100%" cellSpacing="0">
            <thead>
                <tr>
                    <th className="text-right" style={{ width: "20%" }}>{t(caption)}</th>
                    <th className="text-right" style={{ width: "15%" }}>{t(columns.out)}</th>
                    <th className="text-left" style={{ width: "15%" }}>{t(columns.incoming)}</th>
                    <th className="text-right" style={{ width: "15%" }}>{t(columns.outAverage)}</th>
                    <th className="text-left" style={{ width: "15%" }}>{t(columns.inAverage)}</th>
                    <th className="text-left" style={{ width: "18%" }}>{t(columns.total)}</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row, index) => (
                    <tr key={index}>
                        <td className={`label_${evenOdd(index)}`} style={{ fontSize: "12px", textAlign: "right" }}><b>{t(row.label)}</b></td>
                        <td className={`numeric_${evenOdd(index)} text-success`} style={{ fontSize: "12px", textAlign: "right" }}>{row.out}</td>
                        <td className={`numeric_${evenOdd(index)} text-primary`} style={{ fontSize: "12px", textAlign: "left" }}>{row.incoming}</td>
                        <td className={`numeric_${evenOdd(index)} text-success`} style={{ fontSize: "12px", textAlign: "right" }}>{row.outAverage}</td>
                        <td className={`numeric_${evenOdd(index)} text-primary`} style={{ fontSize: "12px", textAlign: "left" }}>{row.inAverage}</td>
                        <td className={`numeric_${evenOdd(index)}`} style={{ fontSize: "12px", textAlign: "left" }}>{row.total}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function BandwidthTablesView({ data }: { data: BandwidthTableData }) {
    return (
        <div className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="table-responsive">
                <DataTable caption={data.summary.caption} rows={data.summary.rows} columns={data.columns} />
            </div>
            <div className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div className="table-responsive">
                    <DataTable caption={data.detail.caption} rows={data.detail.rows} columns={data.columns} />
                </div>
            </div>
        </div>
    );
}

export function BandwidthTablesRoot({ data }: { data: BandwidthTableData | null }) {
    return data
        ? <BandwidthTablesView data={data} />
        : <div id="bw_tables_loading"><BandwidthTablePlaceholder /></div>;
}
