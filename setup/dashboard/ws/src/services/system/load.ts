import os from "os";
import { readdir } from "fs/promises";
import si from "systeminformation";
import { isMockMode } from "../../../mock/mode";
import type { SystemLoadData } from "../../shared/system-summary-contract";

export const systemLoadData = async (): Promise<SystemLoadData> => {
    if (process.platform !== "win32") {
        const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg();
        if (process.platform === "linux" && process.env.NODE_ENV !== "test" && !isMockMode()) {
            try {
                const entries = await readdir("/proc");
                const processes = entries.filter((entry) => /^\d+$/.test(entry)).length;
                return { loadavg: [load1, load5, load15], processes };
            } catch {
                // Fall back to systeminformation when /proc is unavailable (e.g. unit tests on macOS).
            }
        }
        const processes = await si.processes();
        return { loadavg: [load1, load5, load15], processes: processes.all };
    }
    const processes = await si.processes();
    const cpuLoad = await si.currentLoad();
    return { currentLoad: cpuLoad.currentLoad, processes: processes.all };
};
