// SPDX-License-Identifier: GPL-3.0-or-later

export interface NetworkInterfaceInfo {
    iface?: string;
    operstate?: string;
    internal?: boolean;
}

const DOWN_OPER_STATES = new Set(["down", "notpresent", "lowerlayerdown"]);
const MACOS_SYSTEM_INTERFACE_PREFIXES = ["awdl", "llw", "utun"];
const LINUX_SYSTEM_INTERFACE_PREFIXES = [
    "docker",
    "veth",
    "br-",
    "virbr",
    "cni",
    "flannel",
    "cali",
    "podman",
];

function normalizeInterfaceName(value?: string): string {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeOperstate(value?: string): string {
    return typeof value === "string"
        ? value.trim().toLowerCase().replace(/[\s_-]+/g, "")
        : "";
}

function isLoopbackInterface(iface: string): boolean {
    const normalized = iface.toLowerCase();
    return normalized === "lo" || normalized === "lo0";
}

export function isActiveNetworkInterface(
    networkInterface: NetworkInterfaceInfo,
    platform: NodeJS.Platform = process.platform,
    monitoredInterfaces: ReadonlySet<string> = new Set(),
): boolean {
    const iface = normalizeInterfaceName(networkInterface.iface);
    if (!iface || isLoopbackInterface(iface)) {
        return false;
    }
    if (networkInterface.internal === true) {
        return false;
    }
    const operstate = normalizeOperstate(networkInterface.operstate);
    if (operstate !== "" && DOWN_OPER_STATES.has(operstate)) {
        return false;
    }
    return !isSystemManagedInterface(iface, platform, monitoredInterfaces);
}

function isSystemManagedInterface(
    iface: string,
    platform: NodeJS.Platform,
    monitoredInterfaces: ReadonlySet<string>,
): boolean {
    if ([...monitoredInterfaces].some((monitoredInterface) => normalizeInterfaceName(monitoredInterface) === iface)) {
        return false;
    }

    const prefixes = platform === "darwin"
        ? MACOS_SYSTEM_INTERFACE_PREFIXES
        : platform === "linux"
            ? LINUX_SYSTEM_INTERFACE_PREFIXES
            : [];

    return prefixes.some((prefix) => iface.toLowerCase().startsWith(prefix));
}

export function listActiveInterfaceNames(
    interfaces: NetworkInterfaceInfo[],
    platform: NodeJS.Platform = process.platform,
    monitoredInterfaces: ReadonlySet<string> = new Set(),
): string[] {
    const uniqueNames = new Set<string>();
    for (const networkInterface of interfaces) {
        if (!isActiveNetworkInterface(networkInterface, platform, monitoredInterfaces)) {
            continue;
        }
        const iface = normalizeInterfaceName(networkInterface.iface);
        if (iface) {
            uniqueNames.add(iface);
        }
    }
    return [...uniqueNames];
}
