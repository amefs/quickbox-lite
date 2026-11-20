// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { CpuStaticData } from "../../../ws/src/shared/cpu-status-contract";
import { SkeletonText } from "./placeholder";

function CpuStatusValue({ data }: { data: CpuStaticData | null }) {
    if (!data) {
        return (
            <>
                <h3 className="qb-stat-heading"><SkeletonText width="85%" /></h3>
                <SkeletonText width="55%" />
                <br />
                <SkeletonText width="45%" />
            </>
        );
    }
    return (
        <>
            <h3 className="qb-stat-heading">{data.model ?? "Unknown"}</h3>
            {data.speedGHz !== undefined ? <> <span style={{ color: "#999", fontWeight: 600 }}>Frequency:</span> {data.speedGHz} GHz</> : null}
            {data.cache ? <><br /> <span style={{ color: "#999", fontWeight: 600 }}>Secondary cache:</span> {data.cache}</> : null}
            <br />[<span style={{ color: "#999", fontWeight: 600 }}>x{data.count ?? "-"}</span> core]
        </>
    );
}

export { CpuStatusValue };
