// SPDX-License-Identifier: GPL-3.0-or-later

import si from "systeminformation";
import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import type { MemoryProgress, MemoryStatsData } from "../shared/memory-stats-contract";
import { formatSize } from "../utils/helpers";
import { MemoryStatsRoot } from "./memory-stats-island";

function getRamColor(percent: number): MemoryProgress["colorClass"] {
    if (percent >= 90) {
        return "progress-bar-danger";
    }
    if (percent >= 70) {
        return "progress-bar-warning";
    }
    return "progress-bar-success";
}

export async function ramStatsData(): Promise<MemoryStatsData> {
    const mem = await si.mem();
    const memUsed = formatSize(mem.used);
    const memFree = formatSize(mem.free);
    const memTotal = formatSize(mem.total);
    const memPercent = Number((mem.used / mem.total * 100).toFixed(2));
    const memRealUsedNumber = mem.used - mem.cached - mem.buffers;
    const memRealUsed = formatSize(memRealUsedNumber);
    const memRealFree = formatSize(mem.total - memRealUsedNumber);
    const memRealPercent = Number((memRealUsedNumber / mem.total * 100).toFixed(2));
    const memBuffers = formatSize(mem.buffers);
    const memCached = formatSize(mem.cached);
    const memCachedPercent = Number((mem.cached / mem.total * 100).toFixed(2));
    const memSwapUsed = formatSize(mem.swapused);
    const memSwapFree = formatSize(mem.swapfree);
    const memSwapTotal = formatSize(mem.swaptotal);

    return {
        labels: {
            physical: i18n.t("PHYSICAL_MEMORY_TITLE"),
            physicalUsed: i18n.t("PHYSICAL_MEMORY_USED_TXT"),
            physicalIdle: i18n.t("PHYSICAL_MEMORY_IDLE_TXT"),
            cached: i18n.t("CACHED_MEMORY_TITLE"),
            real: i18n.t("REAL_MEMORY_TITLE"),
            swap: i18n.t("SWAP_TITLE"),
            used: i18n.t("USED"),
            totalRam: i18n.t("TOTAL_RAM"),
            clearCache: i18n.t("CLEAR_CACHE"),
        },
        physical: { percent: memPercent, colorClass: getRamColor(memPercent), used: memUsed, free: memFree },
        ...(mem.cached > 1e-5 ? {
            cached: {
                percent: memCachedPercent,
                colorClass: getRamColor(memCachedPercent),
                description: i18n.t("CACHED_MEMORY_USAGE_TXT", { cached: memCached }),
                buffersDescription: i18n.t("CACHED_MEMORY_BUFFERS_TXT", { buffered: memBuffers }),
                used: memCached,
                buffered: memBuffers,
            },
            real: {
                percent: memRealPercent,
                colorClass: getRamColor(memRealPercent),
                description: i18n.t("REAL_MEMORY_USAGE_TXT", { used: memRealUsed }),
                freeDescription: i18n.t("REAL_MEMORY_FREE_TXT", { free: memRealFree }),
                used: memRealUsed,
                free: memRealFree,
            },
        } : {}),
        ...(mem.swaptotal > 1e-5 ? {
            swap: {
                percent: Number((mem.swapused / mem.swaptotal * 100).toFixed(2)),
                colorClass: getRamColor(Number((mem.swapused / mem.swaptotal * 100).toFixed(2))),
                totalDescription: i18n.t("SWAP_TOTAL_TXT") + ": " + i18n.t("TOTAL_L", { total: memSwapTotal }),
                usedDescription: i18n.t("SWAP_USED_TXT", { used: memSwapUsed }),
                freeDescription: i18n.t("SWAP_IDLE_TXT", { free: memSwapFree }),
                total: memSwapTotal,
                used: memSwapUsed,
                free: memSwapFree,
            },
        } : {}),
        total: memTotal,
    };
}

export async function ramStats() {
    const data = await ramStatsData();
    return ReactDOMServer.renderToString(<MemoryStatsRoot data={data} />);
}
