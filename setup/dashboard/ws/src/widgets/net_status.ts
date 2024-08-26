/* eslint-disable camelcase */
import si from "systeminformation";

async function enuminterface() {
    const interfaces = await si.networkInterfaces();
    if (Array.isArray(interfaces)) {
        return interfaces.filter(i => i.operstate === "up").map(i => i.iface);
    }
    return [interfaces.iface];
}

export const netStatus = async () => {
    const interfaces = await enuminterface();
    const ret: Record<string, {rx_bytes: number; tx_bytes: number}> = {};
    for(const iface of interfaces) {
        const stats = await si.networkStats(iface);
        if (stats.length > 0) {
            ret[iface] = {
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
