import { execFile } from "child_process";
import { promisify } from "util";

import si from "systeminformation";

const execFileAsync = promisify(execFile);

export async function systemdUnitActive(unit: string): Promise<boolean> {
    try {
        const { stdout } = await execFileAsync("systemctl", ["is-active", unit]);
        return stdout.trim() === "active";
    } catch {
        return false;
    }
}

export async function getProcessList() {
    return (await si.processes()).list;
}

export function processExistsIn(
    processList: si.Systeminformation.ProcessesProcessData[],
    processName: string,
    username: string,
    params?: string[],
) {
    const lowerName = processName.toLowerCase();
    return processList.some((process) => {
        if (process.user !== username) {
            return false;
        }

        if (process.name.toLowerCase() !== lowerName) {
            return false;
        }

        if (!params) {
            return true;
        }

        const processParams = process.params.toLowerCase();
        return params.every((part) => processParams.includes(part.toLowerCase()));
    });
}

export async function processExists(processName: string, username: string, params?: string[]) {
    const processList = await getProcessList();
    return processExistsIn(processList, processName, username, params);
}
