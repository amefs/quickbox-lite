import os from "os";
import si from "systeminformation";
export const widgetsLoad = async () => {
    const loadavg = os.loadavg();
    const processes = await si.processes();
    return `${loadavg.map(l=>l.toFixed(2)).join(" ")} ${processes.all}`;
};
