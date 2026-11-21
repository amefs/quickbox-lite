// SPDX-License-Identifier: GPL-3.0-or-later

import si from "systeminformation";

import type { MemoryStatsRawData } from "../../shared/memory-stats-contract";

export async function ramStatsData(): Promise<MemoryStatsRawData> {
    const mem = await si.mem();
    return {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        cached: mem.cached,
        buffers: mem.buffers,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
        swapFree: mem.swapfree,
    };
}
