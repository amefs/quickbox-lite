// SPDX-License-Identifier: GPL-3.0-or-later

import { readFile } from "fs/promises";
import os from "os";
import si from "systeminformation";

export interface CpuStaticInfo {
    modelHtml: string;
    count: number | string;
    frequency?: string;
    cache?: string;
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function readCpuCache() {
    try {
        const cpuinfo = await readFile("/proc/cpuinfo", "utf8");
        const match = cpuinfo.match(/cache\s+size\s*:\s*([^\n]+)/);
        return match?.[1]?.trim();
    } catch {
        return undefined;
    }
}

export async function getCpuStaticInfo(): Promise<CpuStaticInfo> {
    try {
        const [cpu, cache] = await Promise.all([si.cpu(), readCpuCache()]);
        const model = cpu.brand || cpu.manufacturer || "Unknown";
        const frequency = cpu.speed ? `${cpu.speed}` : undefined;
        const parts = [`<h4>${escapeHtml(model)}</h4>`];
        if (frequency) {
            parts.push(` <span style="color:#999;font-weight:600">Frequency:</span> ${escapeHtml(frequency)}`);
        }
        if (cache) {
            parts.push(`<br/> <span style="color:#999;font-weight:600">Secondary cache:</span> ${escapeHtml(cache)}`);
        }

        return {
            modelHtml: parts.join(""),
            count: cpu.cores || os.cpus().length || "-",
            frequency,
            cache,
        };
    } catch {
        return {
            modelHtml: "<h4>Unknown</h4>",
            count: "-",
        };
    }
}

export async function getNetworkInterfaces() {
    try {
        const interfaces = await si.networkInterfaces();
        const list = Array.isArray(interfaces) ? interfaces : [interfaces];
        return list
            .filter((iface) => iface.operstate === "up")
            .map((iface) => iface.iface)
            .filter((iface): iface is string => typeof iface === "string" && iface !== "");
    } catch {
        return [];
    }
}

export async function systemStaticInfo() {
    const [cpu, interfaces] = await Promise.all([
        getCpuStaticInfo(),
        getNetworkInterfaces(),
    ]);

    return {
        cpu,
        interfaces,
    };
}
