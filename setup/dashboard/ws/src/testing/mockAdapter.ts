// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Mock adapter: manages the active mock profile for testing.
 * All module-level patching is handled by bootstrap.ts — this
 * module only provides profile lifecycle management.
 */

import { getPackage, serviceMap } from "../info";
import { username } from "../constant";
import { type MockProcess, type MockProfile, getProfile } from "./mockProfiles";

let activeProfile: MockProfile | null = null;
let nextMockPid = 5000;

export function isTestMode(): boolean {
    return process.env.NODE_ENV === "test" && process.env.MOCK_ENABLED === "1";
}

function cloneProfile(profile: MockProfile): MockProfile {
    return {
        ...profile,
        processes: profile.processes.map((proc) => ({ ...proc })),
        memory: { ...profile.memory },
        disks: profile.disks.map((disk) => ({ ...disk })),
        networkInterfaces: profile.networkInterfaces.map((networkInterface) => ({ ...networkInterface })),
        loadavg: [...profile.loadavg] as MockProfile["loadavg"],
        lockFiles: [...profile.lockFiles],
        enabledServices: [...profile.enabledServices],
        torrentDirs: Object.fromEntries(
            Object.entries(profile.torrentDirs).map(([dir, files]) => [dir, [...files]]),
        ),
        vnstatData: profile.vnstatData ? { ...profile.vnstatData } : undefined,
    };
}

export function getActiveProfile(): MockProfile {
    if (!activeProfile) {
        activeProfile = cloneProfile(getProfile());
    }
    return activeProfile;
}

export function setActiveProfile(profileName: string) {
    activeProfile = cloneProfile(getProfile(profileName));
}

function addUnique<T>(list: T[], value: T) {
    if (!list.includes(value)) {
        list.push(value);
    }
}

function removeMatching(list: string[], predicate: (value: string) => boolean) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
        if (predicate(list[i])) {
            list.splice(i, 1);
        }
    }
}

function serviceUnitName(service: string) {
    const detail = serviceMap.get(service);
    if (!detail) {
        return service;
    }
    return detail.username === "root" ? service : `${service}@${detail.username}`;
}

function ensureProcessRunning(service: string) {
    const detail = serviceMap.get(service);
    if (!detail) {
        return;
    }
    const profile = getActiveProfile();
    const exists = profile.processes.some((proc) => proc.name === detail.process && proc.user === detail.username);
    if (!exists) {
        const mockProcess: MockProcess = {
            name: detail.process,
            user: detail.username,
            pid: nextMockPid++,
            cpu: 0.1,
            mem: 0.2,
        };
        profile.processes.push(mockProcess);
    }
}

function stopProcess(service: string) {
    const detail = serviceMap.get(service);
    if (!detail) {
        return;
    }
    const profile = getActiveProfile();
    profile.processes = profile.processes.filter((proc) => !(proc.name === detail.process && proc.user === detail.username));
}

export function installPackage(packageName: string) {
    const pkg = getPackage(packageName);
    if (!pkg || !pkg.lockfile) {
        return false;
    }
    const profile = getActiveProfile();
    addUnique(profile.lockFiles, pkg.lockfile);
    if (pkg.services) {
        for (const serviceName of Object.keys(pkg.services)) {
            addUnique(profile.enabledServices, serviceUnitName(serviceName));
            ensureProcessRunning(serviceName);
        }
    }
    return true;
}

export function removePackage(packageName: string) {
    const pkg = getPackage(packageName);
    if (!pkg || !pkg.lockfile) {
        return false;
    }
    const profile = getActiveProfile();
    removeMatching(profile.lockFiles, (lockFile) => lockFile === pkg.lockfile);
    if (pkg.services) {
        for (const serviceName of Object.keys(pkg.services)) {
            removeMatching(profile.enabledServices, (serviceUnit) => serviceUnit === serviceUnitName(serviceName));
            stopProcess(serviceName);
        }
    }
    return true;
}

export function updateService(service: string, operation: string) {
    if (!serviceMap.has(service)) {
        return false;
    }
    const profile = getActiveProfile();
    const unitName = serviceUnitName(service);
    switch (operation) {
        case "enable":
            addUnique(profile.enabledServices, unitName);
            return true;
        case "disable":
            removeMatching(profile.enabledServices, (serviceUnit) => serviceUnit === unitName);
            return true;
        case "start":
        case "restart":
            ensureProcessRunning(service);
            return true;
        case "stop":
            stopProcess(service);
            return true;
        case "status":
            return true;
        default:
            return false;
    }
}

export function runBoxCommand(operation: string, target: string) {
    const profile = getActiveProfile();
    if (operation === "fix" && target === "dpkg") {
        removeMatching(profile.lockFiles, (lockFile) => lockFile === "/install/.install.lock");
        return true;
    }
    if (operation === "clean" && target === "log") {
        return true;
    }
    if (operation === "lang" && target.startsWith("lang_")) {
        return true;
    }
    if ((operation === "enable-dev" || operation === "disable-dev") && target === "") {
        return true;
    }
    if (target === username || target === "") {
        return true;
    }
    return false;
}
