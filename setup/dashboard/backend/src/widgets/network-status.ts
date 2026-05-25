/* eslint-disable camelcase */
import si from "systeminformation";
import { listActiveInterfaceNames } from "../utils/network-interfaces";

async function enuminterface() {
    const interfaces = await si.networkInterfaces();
    return listActiveInterfaceNames(interfaces);
}

export const netStatus = async () => {
    const interfaces = await enuminterface();
    const ret: Record<string, {rx_bytes: number; tx_bytes: number}> = {};
    const statsResults = await Promise.allSettled(interfaces.map(iface => si.networkStats(iface)));
    for (let i = 0; i < interfaces.length; i++) {
        const statsResult = statsResults[i];
        if (statsResult.status !== "fulfilled") {
            continue;
        }
        const statsValue = statsResult.value;
        const stats = Array.isArray(statsValue) ? statsValue : [statsValue];
        if (stats.length > 0) {
            ret[interfaces[i]] = {
                rx_bytes: stats[0].rx_bytes,
                tx_bytes: stats[0].tx_bytes,
            };
        }
    }
    return {
        net: ret,
        ts: Date.now() / 1000.0,
    };
};
