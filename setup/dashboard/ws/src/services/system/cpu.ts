// SPDX-License-Identifier: GPL-3.0-or-later

import { readFile } from "fs/promises";
import os from "os";
import si from "systeminformation";
import { listActiveInterfaceNames } from "../../utils/network-interfaces";
import type { CpuStaticData } from "../../shared/cpu-status-contract";

export type CpuStaticInfo = CpuStaticData;

const SYSTEM_STATIC_TIMEOUT_MS = 1200;
const CPU_INFO_TIMEOUT_MS = 5000;
const NETWORK_INTERFACES_TIMEOUT_MS = 5000;
const CPU_INFO_CACHE_TTL_MS = 5 * 60 * 1000;
const UNKNOWN_CPU: CpuStaticInfo = {};

let cachedCpuStaticInfo: CpuStaticInfo | undefined;
let cachedCpuStaticInfoTs = 0;

async function withTimeout<T>(task: Promise<T>, fallback: T, timeoutMs = SYSTEM_STATIC_TIMEOUT_MS): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            task,
            new Promise<T>((resolve) => {
                timer = setTimeout(() => { resolve(fallback); }, timeoutMs);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
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
    if (cachedCpuStaticInfo && (Date.now() - cachedCpuStaticInfoTs) < CPU_INFO_CACHE_TTL_MS) {
        return cachedCpuStaticInfo;
    }
    try {
        const cpu = await withTimeout(
            si.cpu(),
            undefined as Awaited<ReturnType<typeof si.cpu>> | undefined,
            CPU_INFO_TIMEOUT_MS,
        );
        const cache = await readCpuCache();
        if (!cpu) {
            return UNKNOWN_CPU;
        }
        const model = cpu.brand || cpu.manufacturer || cpu.vendor || undefined;
        const count = cpu.cores || os.cpus().length || undefined;
        const speedGHz = cpu.speed || undefined;

        const cpuInfo: CpuStaticInfo = {
            ...(model !== undefined ? { model } : {}),
            ...(count !== undefined ? { count } : {}),
            ...(speedGHz !== undefined ? { speedGHz } : {}),
            ...(cache !== undefined ? { cache } : {}),
        };
        cachedCpuStaticInfo = cpuInfo;
        cachedCpuStaticInfoTs = Date.now();

        return cpuInfo;
    } catch {
        if (cachedCpuStaticInfo) {
            return cachedCpuStaticInfo;
        }
        return UNKNOWN_CPU;
    }
}

export async function getNetworkInterfaces() {
    try {
        const interfaces = await withTimeout(si.networkInterfaces(), [], NETWORK_INTERFACES_TIMEOUT_MS);
        const list = Array.isArray(interfaces) ? interfaces : [interfaces];
        return listActiveInterfaceNames(list);
    } catch {
        return [];
    }
}

export async function systemStaticInfo() {
    const [cpuResult, interfacesResult] = await Promise.allSettled([
        getCpuStaticInfo(),
        getNetworkInterfaces(),
    ]);

    const cpu = cpuResult.status === "fulfilled" ? cpuResult.value : UNKNOWN_CPU;
    const interfaces = interfacesResult.status === "fulfilled" ? interfacesResult.value : [];

    return {
        cpu,
        interfaces,
    };
}

export async function systemStaticInfoWithProviders(
    cpuProvider = getCpuStaticInfo,
    networkProvider = getNetworkInterfaces,
) {
    const [cpuResult, interfacesResult] = await Promise.allSettled([
        cpuProvider(),
        networkProvider(),
    ]);

    const cpu = cpuResult.status === "fulfilled" ? cpuResult.value : UNKNOWN_CPU;
    const interfaces = interfacesResult.status === "fulfilled" ? interfacesResult.value : [];

    return {
        cpu,
        interfaces,
    };
}
