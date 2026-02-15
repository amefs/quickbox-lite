/* eslint-disable camelcase */
import si from "systeminformation";

async function enuminterface() {
    const interfaces = await si.networkInterfaces();
    return interfaces.filter(i => i.operstate === "up").map(i => i.iface);
}

export const netStatus = async () => {
    const interfaces = await enuminterface();
    const ret: Record<string, {rx_bytes: number; tx_bytes: number}> = {};
    const statsResults = await Promise.all(interfaces.map(iface => si.networkStats(iface)));
    for (let i = 0; i < interfaces.length; i++) {
        const stats = statsResults[i];
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
