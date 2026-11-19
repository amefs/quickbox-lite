// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { CpuStaticData } from "../../../ws/src/shared/cpu-status-contract";
import { CpuStatusPlaceholder } from "./placeholder";

function CpuStatusValue({ data }: { data: CpuStaticData | null }) {
    if (!data) {
        return <CpuStatusPlaceholder />;
    }
    return (
        <>
            <h4>{data.model ?? "Unknown"}</h4>
            {data.speedGHz !== undefined ? <> <span style={{ color: "#999", fontWeight: 600 }}>Frequency:</span> {data.speedGHz} GHz</> : null}
            {data.cache ? <><br /> <span style={{ color: "#999", fontWeight: 600 }}>Secondary cache:</span> {data.cache}</> : null}
            <br />[<span style={{ color: "#999", fontWeight: 600 }}>x{data.count ?? "-"}</span> core]
        </>
    );
}

export { CpuStatusValue };
