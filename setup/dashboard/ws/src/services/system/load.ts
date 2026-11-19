import os from "os";
import si from "systeminformation";
import type { SystemLoadData } from "../../shared/system-summary-contract";

export const systemLoadData = async (): Promise<SystemLoadData> => {
    const processes = await si.processes();
    if (process.platform !== "win32") {
        const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg();
        return { loadavg: [load1, load5, load15], processes: processes.all };
    }
    const cpuLoad = await si.currentLoad();
    return { currentLoad: cpuLoad.currentLoad, processes: processes.all };
};
