// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { UptimeParts } from "../shared/system-summary-contract";
import { SystemLoadPlaceholder } from "./placeholder";

export function SystemLoadValue({ text }: { text: string | null }) {
    return text === null ? <SystemLoadPlaceholder /> : text;
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
