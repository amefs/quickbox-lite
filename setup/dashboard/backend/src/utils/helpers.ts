import si from "systeminformation";

export async function getProcessList() {
    return (await si.processes()).list;
}

export function processExistsIn(processList: si.Systeminformation.ProcessesProcessData[], processName: string, username: string) {
    const lowerName = processName.toLowerCase();
    return processList.some((process) => process.name.toLowerCase() === lowerName && process.user === username);
}

export async function processExists(processName: string, username: string) {
    const processList = await getProcessList();
    return processExistsIn(processList, processName, username);
}

export function formatSize(length: number) {
    const value = isNaN(length) ? 0 : length;
    if (value <= 0) {
        return "0 B";
    }
    const suffixList = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const idx = Math.min(Math.max(Math.floor(Math.log2(value) / 10), 0), suffixList.length - 1);
    return (value / Math.pow(2, idx * 10)).toFixed(idx > 0 ? 2 : 0) + " " + suffixList[idx];
}

export function formatSpeed(length: number, decimals = 3, startWith = 0) {
    if (!Number.isFinite(length) || length < 1e-5) {
        return "0 bps";
    }
    const siPrefix = ["bps", "Kbps", "Mbps", "Gbps", "Tbps", "Pbps", "Ebps", "Zbps", "Ybps"];
    const base = 1024;
    const index = Math.min(
        Math.max(Math.floor(Math.log(length) / Math.log(base)), 0),
        siPrefix.length - 1 - Math.max(startWith, 0),
    );

    return (length / Math.pow(base, index)).toFixed(decimals) + " " + siPrefix[Math.min(index + startWith, siPrefix.length - 1)];
}
