// SPDX-License-Identifier: GPL-3.0-or-later

import si from "systeminformation";
import type { UptimeParts } from "../../shared/system-summary-contract";

export const getUptimeParts = (): UptimeParts => {
    const uptime = si.time().uptime;
    return {
        days: Math.floor(uptime / 60 / 60 / 24),
        hours: Math.floor(uptime / 60 / 60 % 24),
        minutes: Math.floor(uptime / 60 % 60),
    };
};
