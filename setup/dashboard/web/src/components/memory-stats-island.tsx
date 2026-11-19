// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { useTranslation } from "react-i18next";

import type { MemoryProgress, MemoryStatsData } from "../../../ws/src/shared/memory-stats-contract";
import { MemoryStatusPlaceholder } from "./placeholder";

function Progress({ data, usedLabel }: { data: MemoryProgress; usedLabel: string }) {
    return (
        <div className="progress progress-striped">
            <div style={{ width: `${data.percent}%` }} aria-valuemax={100} aria-valuemin={0} aria-valuenow={data.percent} role="progressbar" className={`progress-bar ${data.colorClass}`}>
                <span className="sr-only">{data.percent}% {usedLabel}</span>
            </div>
        </div>
    );
}

function MemoryStatsView({ data }: { data: MemoryStatsData }) {
    const { t } = useTranslation();
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
        <div>
            <div className="row">
                <div className="col-sm-12">
                    <p style={{ fontSize: "10px" }}>{labels.physical}: {data.physical.percent}%<br />
                        {labels.physicalUsed}: <span style={{ color: "#eb4549" }}>{data.physical.used}</span>{"  | "}{labels.physicalIdle}: <span style={{ color: "#eb4549" }}>{data.physical.free}</span>
                    </p>
                    <Progress data={data.physical} usedLabel={labels.used} />
                </div>
                {data.cached ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>{labels.cached}: {data.cached.percent}%<br />
                            {data.cached.used !== undefined ? t("CACHED_MEMORY_USAGE_TXT", { cached: data.cached.used }) : data.cached.description}
                            {" | "}
                            {data.cached.buffered !== undefined ? t("CACHED_MEMORY_BUFFERS_TXT", { buffered: data.cached.buffered }) : data.cached.buffersDescription}
                        </p>
                        <Progress data={data.cached} usedLabel={labels.used} />
                    </div>
                ) : null}
                {data.real ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>{labels.real}: {data.real.percent}%<br />
                            {data.real.used !== undefined ? t("REAL_MEMORY_USAGE_TXT", { used: data.real.used }) : data.real.description}
                            {" | "}
                            {data.real.free !== undefined ? t("REAL_MEMORY_FREE_TXT", { free: data.real.free }) : data.real.freeDescription}
                        </p>
                        <Progress data={data.real} usedLabel={labels.used} />
                    </div>
                ) : null}
                {data.swap ? (
                    <div className="col-sm-12" style={{ paddingTop: "10px" }}>
                        <p style={{ fontSize: "10px" }}>
                            {labels.swap}: {data.swap.percent}%<br />
                            {data.swap.total !== undefined ? `${t("SWAP_TOTAL_TXT")}: ${t("TOTAL_L", { total: data.swap.total })}` : data.swap.totalDescription}
                            {" | "}
                            {data.swap.used !== undefined ? t("SWAP_USED_TXT", { used: data.swap.used }) : data.swap.usedDescription}
                            {" | "}
                            {data.swap.free !== undefined ? t("SWAP_IDLE_TXT", { free: data.swap.free }) : data.swap.freeDescription}
                        </p>
                        <Progress data={data.swap} usedLabel={labels.used} />
                    </div>
                ) : null}
            </div>
            <hr />
            <h3>{labels.totalRam}</h3>
            <h4 className="nomargin">
                {data.total}
                <button
                    type="button"
                    data-click-handler="boxHandler"
                    data-package="mem"
                    data-operation="clean"
                    data-toggle="modal"
                    data-target="#sysResponse"
                    className="btn btn-xs btn-default pull-right"
                >
                    {labels.clearCache}
                </button>
            </h4>
        </div>
    );
}

export function MemoryStatsRoot({ data }: { data: MemoryStatsData | null }) {
    return data ? <MemoryStatsView data={data} /> : <MemoryStatusPlaceholder />;
}
