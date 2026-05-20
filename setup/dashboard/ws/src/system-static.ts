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

const SYSTEM_STATIC_TIMEOUT_MS = 1200;
const UNKNOWN_CPU: CpuStaticInfo = {
    modelHtml: "<h4>Unknown</h4>",
    count: "-",
};

async function withTimeout<T>(task: Promise<T>, fallback: T): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            task,
            new Promise<T>((resolve) => {
                timer = setTimeout(() => { resolve(fallback); }, SYSTEM_STATIC_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
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
        const [cpu, cache] = await withTimeout(Promise.all([
            si.cpu(),
            readCpuCache(),
        ]), [undefined, undefined] as [Awaited<ReturnType<typeof si.cpu>> | undefined, string | undefined]);
        if (!cpu) {
            return UNKNOWN_CPU;
        }
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
        return UNKNOWN_CPU;
    }
}

export async function getNetworkInterfaces() {
    try {
        const interfaces = await withTimeout(si.networkInterfaces(), []);
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
    const [cpu, interfaces] = await withTimeout(Promise.all([
        getCpuStaticInfo(),
        getNetworkInterfaces(),
    ]), [UNKNOWN_CPU, []] as [CpuStaticInfo, string[]]);

    return {
        cpu,
        interfaces,
    };
}

export async function systemStaticInfoWithProviders(
    cpuProvider = getCpuStaticInfo,
    networkProvider = getNetworkInterfaces,
) {
    const [cpu, interfaces] = await withTimeout(Promise.all([
        cpuProvider(),
        networkProvider(),
    ]), [UNKNOWN_CPU, []] as [CpuStaticInfo, string[]]);

    return {
        cpu,
        interfaces,
    };
}
