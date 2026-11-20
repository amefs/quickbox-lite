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

function Progress({ data, label, usedLabel }: { data: MemoryProgress | null; label: string; usedLabel: string }) {
    return (
        <div className="progress progress-striped">
            {data ? <div style={{ width: `${data.percent}%` }} aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={data.percent} role="progressbar" className={`progress-bar ${data.colorClass}`}>
                <span className="sr-only">{data.percent}% {usedLabel}</span>
            </div> : <div className="qb-skeleton" style={{ height: "100%" }} />}
        </div>
    );
}

export function MemoryStatsRoot({ data: payload }: { data: MemoryStatsPayload | null }) {
    const { t } = useTranslation();
    const commandsConnected = useCommandConnection();
    const data = payload ? normalizeMemoryStats(payload) : null;
    const labels = {
        physical: t("PHYSICAL_MEMORY_TITLE"),
        physicalUsed: t("PHYSICAL_MEMORY_USED_TXT"),
        physicalIdle: t("PHYSICAL_MEMORY_IDLE_TXT"),
        cached: t("CACHED_MEMORY_TITLE"),
        real: t("REAL_MEMORY_TITLE"),
        swap: t("SWAP_TITLE"),
        used: t("USED"),
        totalRam: t("TOTAL_RAM"),
        clearCache: t("CLEAR_CACHE"),
    };
    return (
        <div aria-busy={!data}>
            <div className="row">
                <div className="col-sm-12">
                    {data ? (
                        <p style={{ fontSize: "10px" }}>{labels.physical}: {data.physical.percent}%<br />
                            {labels.physicalUsed}: <span style={{ color: "#eb4549" }}>{data.physical.used}</span>{"  | "}{labels.physicalIdle}: <span style={{ color: "#eb4549" }}>{data.physical.free}</span>
                        </p>
                    ) : (
                        <p style={{ fontSize: "10px" }} aria-hidden="true"><SkeletonText width="48%" /><br /><SkeletonText width="75%" /></p>
                    )}
                    <Progress data={data?.physical ?? null} label={labels.physical} usedLabel={labels.used} />
                </div>
                {!data && [0, 1].map((index) => (
                    <div key={index} className="col-sm-12" style={{ paddingTop: "10px" }} aria-hidden="true">
                        <p style={{ fontSize: "10px" }}><SkeletonText width="65%" /></p>
                        <Progress data={null} label="" usedLabel="" />
                    </div>
                ))}
                {data?.cached ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>{labels.cached}: {data.cached.percent}%<br />
                            {data.cached.used !== undefined ? t("CACHED_MEMORY_USAGE_TXT", { cached: data.cached.used }) : data.cached.description}
                            {" | "}
                            {data.cached.buffered !== undefined ? t("CACHED_MEMORY_BUFFERS_TXT", { buffered: data.cached.buffered }) : data.cached.buffersDescription}
                        </p>
                        <Progress data={data.cached} label={labels.cached} usedLabel={labels.used} />
                    </div>
                ) : null}
                {data?.real ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>{labels.real}: {data.real.percent}%<br />
                            {data.real.used !== undefined ? t("REAL_MEMORY_USAGE_TXT", { used: data.real.used }) : data.real.description}
                            {" | "}
                            {data.real.free !== undefined ? t("REAL_MEMORY_FREE_TXT", { free: data.real.free }) : data.real.freeDescription}
                        </p>
                        <Progress data={data.real} label={labels.real} usedLabel={labels.used} />
                    </div>
                ) : null}
                {data?.swap ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>
                            {labels.swap}: {data.swap.percent}%<br />
                            {data.swap.total !== undefined ? `${t("SWAP_TOTAL_TXT")}: ${t("TOTAL_L", { total: data.swap.total })}` : data.swap.totalDescription}
                            {" | "}
                            {data.swap.used !== undefined ? t("SWAP_USED_TXT", { used: data.swap.used }) : data.swap.usedDescription}
                            {" | "}
                            {data.swap.free !== undefined ? t("SWAP_IDLE_TXT", { free: data.swap.free }) : data.swap.freeDescription}
                        </p>
                        <Progress data={data.swap} label={labels.swap} usedLabel={labels.used} />
                    </div>
                ) : null}
            </div>
            <hr />
            <h3>{labels.totalRam}</h3>
            <div className="nomargin qb-stat-heading">
                {data?.total ?? <SkeletonText width="35%" />}
                <button
                    type="button"
                    className="btn btn-xs btn-default pull-right"
                    disabled={!data || !commandsConnected}
                    onClick={() => { executeBoxAction("clean", "mem", true); }}
                >
                    {labels.clearCache}
                </button>
            </div>
        </div>
    );
}
