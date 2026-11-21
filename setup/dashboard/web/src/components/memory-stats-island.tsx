// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { useTranslation } from "react-i18next";

import type { MemoryProgress, MemoryStatsData, MemoryStatsPayload, MemoryStatsRawData } from "../../../ws/src/shared/memory-stats-contract";
import { executeBoxAction, useCommandConnection } from "../runtime/dashboard-runtime-client";
import { formatSize } from "../utils/format";
import { SkeletonText } from "./placeholder";

function getRamColor(percent: number): MemoryProgress["colorClass"] {
    if (percent >= 90) {
        return "progress-bar-danger";
    }
    if (percent >= 70) {
        return "progress-bar-warning";
    }
    return "progress-bar-success";
}

function normalizeMemoryStats(payload: MemoryStatsPayload): Omit<MemoryStatsData, "labels"> {
    if ("physical" in payload) {
        return payload;
    }
    const raw: MemoryStatsRawData = payload;
    const memPercent = raw.total > 0 ? Number((raw.used / raw.total * 100).toFixed(2)) : 0;
    const memRealUsedNumber = raw.used - raw.cached - raw.buffers;
    const memRealPercent = raw.total > 0 ? Number((memRealUsedNumber / raw.total * 100).toFixed(2)) : 0;
    const memCachedPercent = raw.total > 0 ? Number((raw.cached / raw.total * 100).toFixed(2)) : 0;
    const swapPercent = raw.swapTotal > 0 ? Number((raw.swapUsed / raw.swapTotal * 100).toFixed(2)) : 0;

    return {
        physical: {
            percent: memPercent,
            colorClass: getRamColor(memPercent),
            used: formatSize(raw.used),
            free: formatSize(raw.free),
        },
        ...(raw.cached > 1e-5 ? {
            cached: {
                percent: memCachedPercent,
                colorClass: getRamColor(memCachedPercent),
                description: "",
                buffersDescription: "",
                used: formatSize(raw.cached),
                buffered: formatSize(raw.buffers),
            },
            real: {
                percent: memRealPercent,
                colorClass: getRamColor(memRealPercent),
                description: "",
                freeDescription: "",
                used: formatSize(memRealUsedNumber),
                free: formatSize(raw.total - memRealUsedNumber),
            },
        } : {}),
        ...(raw.swapTotal > 1e-5 ? {
            swap: {
                percent: swapPercent,
                colorClass: getRamColor(swapPercent),
                totalDescription: "",
                usedDescription: "",
                freeDescription: "",
                total: formatSize(raw.swapTotal),
                used: formatSize(raw.swapUsed),
                free: formatSize(raw.swapFree),
            },
        } : {}),
        total: formatSize(raw.total),
    };
}

function Progress({ data, labelKey }: { data: MemoryProgress; labelKey: string } | { data: null; labelKey?: string }) {
    const { t } = useTranslation();
    const barStyle = data ? {
        "width": "100%",
        "transform": `scaleX(${data.percent / 100})`,
        "--qb-progress-hatch-scale": data.percent > 0 ? 100 / data.percent : 1,
    } as React.CSSProperties : undefined;
    return (
        <div className="progress progress-striped">
            {data ? <div style={barStyle} aria-label={t(labelKey)} aria-valuemax={100} aria-valuemin={0} aria-valuenow={data.percent} role="progressbar" className={`progress-bar ${data.colorClass}`}>
                <span className="sr-only">{data.percent}% {t("USED")}</span>
            </div> : <div className="qb-skeleton" style={{ height: "100%" }} />}
        </div>
    );
}

export function MemoryStatsRoot({ data: payload }: { data: MemoryStatsPayload | null }) {
    const { t } = useTranslation();
    const commandsConnected = useCommandConnection();
    const data = payload ? normalizeMemoryStats(payload) : null;
    return (
        <div aria-busy={!data}>
            <div className="row">
                <div className="col-sm-12">
                    {data ? (
                        <p style={{ fontSize: "10px" }}>{t("PHYSICAL_MEMORY_TITLE")}: {data.physical.percent}%<br />
                            {t("PHYSICAL_MEMORY_USED_TXT")}: <span style={{ color: "#eb4549" }}>{data.physical.used}</span>{"  | "}{t("PHYSICAL_MEMORY_IDLE_TXT")}: <span style={{ color: "#eb4549" }}>{data.physical.free}</span>
                        </p>
                    ) : (
                        <p style={{ fontSize: "10px" }} aria-hidden="true"><SkeletonText width="48%" /><br /><SkeletonText width="75%" /></p>
                    )}
                    <Progress data={data?.physical ?? null} labelKey="PHYSICAL_MEMORY_TITLE" />
                </div>
                {!data && [0, 1].map((index) => (
                    <div key={index} className="col-sm-12" style={{ paddingTop: "10px" }} aria-hidden="true">
                        <p style={{ fontSize: "10px" }}><SkeletonText width="65%" /></p>
                        <Progress data={null} />
                    </div>
                ))}
                {data?.cached ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>{t("CACHED_MEMORY_TITLE")}: {data.cached.percent}%<br />
                            {data.cached.used !== undefined ? t("CACHED_MEMORY_USAGE_TXT", { cached: data.cached.used }) : data.cached.description}
                            {" | "}
                            {data.cached.buffered !== undefined ? t("CACHED_MEMORY_BUFFERS_TXT", { buffered: data.cached.buffered }) : data.cached.buffersDescription}
                        </p>
                        <Progress data={data.cached} labelKey="CACHED_MEMORY_TITLE" />
                    </div>
                ) : null}
                {data?.real ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>{t("REAL_MEMORY_TITLE")}: {data.real.percent}%<br />
                            {data.real.used !== undefined ? t("REAL_MEMORY_USAGE_TXT", { used: data.real.used }) : data.real.description}
                            {" | "}
                            {data.real.free !== undefined ? t("REAL_MEMORY_FREE_TXT", { free: data.real.free }) : data.real.freeDescription}
                        </p>
                        <Progress data={data.real} labelKey="REAL_MEMORY_TITLE" />
                    </div>
                ) : null}
                {data?.swap ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>
                            {t("SWAP_TITLE")}: {data.swap.percent}%<br />
                            {data.swap.total !== undefined ? `${t("SWAP_TOTAL_TXT")}: ${t("TOTAL_L", { total: data.swap.total })}` : data.swap.totalDescription}
                            {" | "}
                            {data.swap.used !== undefined ? t("SWAP_USED_TXT", { used: data.swap.used }) : data.swap.usedDescription}
                            {" | "}
                            {data.swap.free !== undefined ? t("SWAP_IDLE_TXT", { free: data.swap.free }) : data.swap.freeDescription}
                        </p>
                        <Progress data={data.swap} labelKey="SWAP_TITLE" />
                    </div>
                ) : null}
            </div>
            <hr />
            <h3>{t("TOTAL_RAM")}</h3>
            <div className="nomargin qb-stat-heading">
                {data?.total ?? <SkeletonText width="35%" />}
                <button
                    type="button"
                    className="btn btn-xs btn-default pull-right"
                    disabled={!data || !commandsConnected}
                    onClick={() => { executeBoxAction("clean", "mem", true); }}
                >
                    {t("CLEAR_CACHE")}
                </button>
            </div>
        </div>
    );
}
