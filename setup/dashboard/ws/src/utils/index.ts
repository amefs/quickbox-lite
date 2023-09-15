import * as si from "systeminformation";

export async function processExists(processName: string, username: string) {
    const processes = await si.processes();
    const idx = processes.list.findIndex((process) => process.name === processName && process.user === username);
    return idx !== -1;
}
