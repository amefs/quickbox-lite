// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { SystemLoadData, UptimeParts } from "../../../ws/src/shared/system-summary-contract";
import { SystemLoadPlaceholder } from "./placeholder";

export function formatSystemLoad(data: SystemLoadData): string {
    if (Array.isArray(data.loadavg)) {
        return `${data.loadavg.map((load) => load.toFixed(2)).join(" ")} ${data.processes}`;
    }
    return `${(data.currentLoad ?? 0).toFixed(2)}% ${data.processes}`;
}

export function SystemLoadValue({ data }: { data: SystemLoadData | null }) {
    return data === null ? <SystemLoadPlaceholder /> : <>{formatSystemLoad(data)}</>;
}

export function UptimeValue({ parts, labels }: {
    parts: UptimeParts;
    labels: { days: string; hours: string; minutes: string };
}) {
    return (
        <span style={{ fontSize: "14px" }}>
            <b>{parts.days}</b><small>{labels.days}</small>
            <b>{parts.hours}</b><small>{labels.hours}</small>
            <b>{parts.minutes}</b><small>{labels.minutes}</small>
        </span>
    );
}
