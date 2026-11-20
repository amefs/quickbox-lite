// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

export function SkeletonText({ width }: { width: string }) {
    return (
        <span
            className="qb-skeleton"
            aria-hidden="true"
            style={{ display: "inline-block", width, height: "0.7lh", marginBlockStart: "0.15lh", verticalAlign: "top" }}
        />
    );
}
