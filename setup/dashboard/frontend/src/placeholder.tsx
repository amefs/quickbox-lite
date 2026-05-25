// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

function SkeletonLine({ width = "100%", height = 12, noMargin }: { width?: string; height?: number; noMargin?: boolean }) {
    return <div className="qb-skeleton" style={{ width, height, marginBottom: noMargin ? 0 : 6 }} />;
}

function SkeletonBlock({ width = "100%", height = 60 }: { width?: string; height?: number }) {
    return <div className="qb-skeleton" style={{ width, height, marginBottom: 8 }} />;
}

function SkeletonProgress({ width = "100%" }: { width?: string }) {
    return <div className="qb-skeleton qb-skeleton-progress" style={{ width }} />;
}

function SkeletonBtn({ width = 56 }: { width?: number }) {
    return <div className="qb-skeleton qb-skeleton-btn" style={{ width }} />;
}

function SkeletonCircle({ size = 90 }: { size?: number }) {
    return <div className="qb-skeleton qb-skeleton-circle" style={{ width: size, height: size }} />;
}

/** Network interface bandwidth rows — table with 3 columns (33% each) */
export function NetworkInterfacePlaceholder() {
    return (
        <tr>
            <td colSpan={3} style={{ padding: "8px 12px" }}>
                {[1, 2, 3].map((i) => (
                    <div key={i} style={{ display: "flex", marginBottom: 10 }}>
                        <div style={{ width: "33.33%" }}><SkeletonLine width="80%" height={14} noMargin /></div>
                        <div style={{ width: "33.33%" }}><SkeletonLine width="75%" height={14} noMargin /></div>
                        <div style={{ width: "33.33%" }}><SkeletonLine width="70%" height={14} noMargin /></div>
                    </div>
                ))}
            </td>
        </tr>
    );
}

function SkeletonTable({ rows, cols }: { rows: number; cols: number[] }) {
    return (
        <table className="table table-hover table-default nomargin" width="100%" cellSpacing="0">
            <thead>
                <tr>
                    {cols.map((w, i) => (
                        <th key={i} className="text-right" style={{ width: `${w}%`, padding: "8px" }}>
                            <SkeletonLine width={`${40 + (i * 10)}%`} height={12} noMargin />
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: rows }, (_, r) => (
                    <tr key={r}>
                        {cols.map((_w, c) => (
                            <td key={c} style={{ padding: "6px 8px" }}>
                                <SkeletonLine width={`${45 + ((r + c) % 3) * 12}%`} height={14} noMargin />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Bandwidth details — summary (4 rows) + data table (7 rows), 6 columns each */
export function BandwidthTablePlaceholder() {
    const cols = [20, 15, 15, 15, 15, 18];
    return (
        <div className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="table-responsive">
                <SkeletonTable rows={4} cols={cols} />
            </div>
            <div className="col-sm-12" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div className="table-responsive">
                    <SkeletonTable rows={7} cols={cols} />
                </div>
            </div>
        </div>
    );
}

/** Service control center — panel with heading + table rows */
export function ServiceControlPlaceholder() {
    return (
        <div className="panel panel-inverse" data-inner-id="panel-server-service-control">
            <div className="panel-heading">
                <SkeletonLine width="42%" height={18} />
            </div>
            <div className="panel-body" style={{ padding: "0 15px 15px" }}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                        <SkeletonLine width="32%" height={14} />
                        <SkeletonBtn />
                        <SkeletonBtn width={48} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Package management center — panel with heading + alert + table rows */
export function PackageManagementPlaceholder() {
    return (
        <div className="panel panel-main panel-inverse" data-inner-id="panel-server-package-management">
            <div className="panel-heading">
                <SkeletonLine width="48%" height={18} />
            </div>
            <div className="panel-body" style={{ padding: "0 15px 15px" }}>
                <SkeletonBlock height={36} />
                <div style={{ height: 12 }} />
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                        <SkeletonLine width="18%" height={14} />
                        <SkeletonLine width="44%" height={14} />
                        <SkeletonBtn width={72} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** System load — single line of text in h4 */
export function SystemLoadPlaceholder() {
    return <span className="qb-skeleton" style={{ display: "inline-block", width: "75%", height: 20, verticalAlign: "middle" }} />;
}

/** CPU status — multi-line text block */
export function CpuStatusPlaceholder() {
    return (
        <span className="nomargin" style={{ display: "block", fontSize: "14px" }}>
            <SkeletonLine width="85%" height={16} />
            <SkeletonLine width="55%" height={14} />
            <SkeletonLine width="45%" height={14} />
        </span>
    );
}

/** Disk status — progress bars + text + HDD icons + torrent counts */
export function DiskStatusPlaceholder() {
    return (
        <div>
            {[1, 2].map((i) => (
                <div key={i}>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <SkeletonLine width="28%" height={14} />
                            <SkeletonLine width="55%" height={14} />
                            <SkeletonLine width="72%" height={12} />
                            <SkeletonLine width="65%" height={12} />
                            <div style={{ height: 6 }} />
                            <SkeletonProgress />
                            <div style={{ height: 4 }} />
                            <SkeletonLine width="35%" height={10} />
                        </div>
                        <SkeletonCircle size={90} />
                    </div>
                    <hr />
                </div>
            ))}
            <SkeletonLine width="35%" height={14} />
            <SkeletonLine width="55%" height={12} />
        </div>
    );
}

/** Memory stats — progress bars + total RAM + clear cache button */
export function MemoryStatusPlaceholder() {
    return (
        <div>
            {[1, 2, 3].map((i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                    <SkeletonLine width="48%" height={12} />
                    <SkeletonLine width="75%" height={12} />
                    <div style={{ height: 4 }} />
                    <SkeletonProgress />
                </div>
            ))}
            <hr />
            <SkeletonLine width="25%" height={16} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <SkeletonLine width="38%" height={18} />
                <SkeletonBtn width={80} />
            </div>
        </div>
    );
}

/** Activity feed — recent updates list */
export function ActivityFeedPlaceholder() {
    return (
        <div style={{ padding: 12 }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                    <SkeletonLine width={`${70 - (i - 1) * 8}%`} height={14} />
                    <SkeletonLine width={`${45 - (i - 1) * 6}%`} height={10} />
                </div>
            ))}
        </div>
    );
}
