import si from "systeminformation";

export async function processExists(processName: string, username: string) {
    const processes = await si.processes();
    const idx = processes.list.findIndex((process) => process.name === processName && process.user === username);
    return idx !== -1;
}

export function formatSize(length: number) {
    const value = isNaN(length) ? 0 : length;
    const suffixList = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const idx = Math.min(Math.max(Math.floor(Math.log2(value) / 10), 0), suffixList.length - 1);
    return (value / Math.pow(2, idx * 10)).toFixed(idx > 0 ? 2 : 0).toString() + " " + suffixList[idx];
}

export function formatSpeed(length: number, decimals = 3, startWith = 0) {
    if (length < 1e-5) {
        return "0 bps";
    }
    const siPrefix = ["bps", "Kbps", "Mbps", "Gbps", "Tbps", "Pbps", "Ebps", "Zbps", "Ybps"];
    const base = 1024;
    const index = Math.floor(Math.log(length) / Math.log(base));

    return (length / Math.pow(base, index)).toFixed(decimals) + " " + siPrefix[index + startWith];
}
