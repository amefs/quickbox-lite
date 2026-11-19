/* eslint-disable camelcase */
import { readFile } from "fs/promises";
import si from "systeminformation";
import { listActiveInterfaceNames } from "../../utils/network-interfaces";

const INTERFACE_CACHE_TTL_MS = 30_000;
let cachedInterfaces: string[] = [];
let interfacesExpiresAt = 0;

async function enuminterface() {
    const useCache = process.env.NODE_ENV !== "test";
    if (useCache && interfacesExpiresAt > Date.now()) {
        return cachedInterfaces;
    }
    const interfaces = await si.networkInterfaces();
    cachedInterfaces = listActiveInterfaceNames(interfaces);
    if (useCache) {
        interfacesExpiresAt = Date.now() + INTERFACE_CACHE_TTL_MS;
    }
    return cachedInterfaces;
}

export const netStatus = async () => {
    const interfaces = await enuminterface();
    const ret: Record<string, {rx_bytes: number; tx_bytes: number}> = {};
    if (process.platform === "linux" && process.env.NODE_ENV !== "test") {
        try {
            const contents = await readFile("/proc/net/dev", "utf8");
            const activeInterfaces = new Set(interfaces);
            for (const line of contents.split("\n").slice(2)) {
                const separator = line.indexOf(":");
                if (separator < 0) {
                    continue;
                }
                const iface = line.slice(0, separator).trim();
                if (!activeInterfaces.has(iface)) {
                    continue;
                }
                const counters = line.slice(separator + 1).trim().split(/\s+/).map(Number);
                if (counters.length >= 9 && Number.isFinite(counters[0]) && Number.isFinite(counters[8])) {
                    ret[iface] = { rx_bytes: counters[0], tx_bytes: counters[8] };
                }
            }
            return { net: ret, ts: Date.now() / 1000.0 };
        } catch {
            // Use systeminformation if procfs is unavailable.
        }
    }
    const statsResults = await Promise.allSettled(interfaces.map(iface => si.networkStats(iface)));
    for (let i = 0; i < interfaces.length; i++) {
        const statsResult = statsResults[i];
        if (statsResult.status !== "fulfilled") {
            continue;
        }
        const statsValue = statsResult.value as si.Systeminformation.NetworkStatsData | si.Systeminformation.NetworkStatsData[] | undefined;
        const stats = Array.isArray(statsValue) ? statsValue : (statsValue ? [statsValue] : []);
        const firstStat = stats[0] as si.Systeminformation.NetworkStatsData | undefined;
        if (firstStat) {
            ret[interfaces[i]] = {
                rx_bytes: firstStat.rx_bytes,
                tx_bytes: firstStat.tx_bytes,
            };
        }
    }
    return {
        net: ret,
        ts: Date.now() / 1000.0,
    };
};
