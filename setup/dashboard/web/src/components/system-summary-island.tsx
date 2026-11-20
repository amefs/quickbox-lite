// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { SystemLoadData, UptimeParts } from "../../../ws/src/shared/system-summary-contract";
import { SkeletonText } from "./placeholder";

export function formatSystemLoad(data: SystemLoadData): string {
    if (Array.isArray(data.loadavg)) {
        return `${data.loadavg.map((load) => load.toFixed(2)).join(" ")} ${data.processes}`;
    }
    return `${(data.currentLoad ?? 0).toFixed(2)}% ${data.processes}`;
}

export function SystemLoadValue({ data }: { data: SystemLoadData | null }) {
    return data === null ? <SkeletonText width="75%" /> : <>{formatSystemLoad(data)}</>;
}

export function UptimeValue({ parts, labels }: {
    parts: UptimeParts | null;
    labels: { days: string; hours: string; minutes: string };
}) {
    const loading = parts === null;
    const placeholderDigits = "\u2007\u2007";
    return (
        <span
            className={loading ? "qb-skeleton" : undefined}
            aria-hidden={loading || undefined}
            style={{ fontSize: "14px", color: loading ? "transparent" : undefined }}
        >
            <b>{parts?.days ?? placeholderDigits}</b><small>{labels.days}</small>
            <b>{parts?.hours ?? placeholderDigits}</b><small>{labels.hours}</small>
            <b>{parts?.minutes ?? placeholderDigits}</b><small>{labels.minutes}</small>
        </span>
    );
}
