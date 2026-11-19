import os from "os";
import si from "systeminformation";
import type { SystemLoadData } from "../shared/system-summary-contract";

export const systemLoadData = async (): Promise<SystemLoadData> => {
    const processes = await si.processes();
    if (process.platform !== "win32") {
        const loadavg = os.loadavg();
        return { text: `${loadavg.map(l => l.toFixed(2)).join(" ")} ${processes.all}` };
    }
    const cpuLoad = await si.currentLoad();
    return { text: `${cpuLoad.currentLoad.toFixed(2)}% ${processes.all}` };
};

export const widgetsLoad = async () => (await systemLoadData()).text;
