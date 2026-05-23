import os from "os";
import si from "systeminformation";

export const widgetsLoad = async () => {
    const processes = await si.processes();
    if (process.platform !== "win32") {
        const loadavg = os.loadavg();
        return `${loadavg.map(l => l.toFixed(2)).join(" ")} ${processes.all}`;
    }
    const cpuLoad = await si.currentLoad();
    return `${cpuLoad.currentLoad.toFixed(2)}% ${processes.all}`;
};
