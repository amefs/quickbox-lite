// SPDX-License-Identifier: GPL-3.0-or-later

export interface NetworkInterfaceInfo {
    iface?: string;
    operstate?: string;
    internal?: boolean;
}

const DOWN_OPER_STATES = new Set(["down", "notpresent", "lowerlayerdown"]);

export function isActiveNetworkInterface(networkInterface: NetworkInterfaceInfo): boolean {
    const iface = typeof networkInterface.iface === "string" ? networkInterface.iface.trim() : "";
    if (!iface || iface.toLowerCase() === "lo") {
        return false;
    }
    if (networkInterface.internal === true) {
        return false;
    }
    const operstate = typeof networkInterface.operstate === "string"
        ? networkInterface.operstate.trim().toLowerCase()
        : "";
    if (operstate === "") {
        return true;
    }
    return !DOWN_OPER_STATES.has(operstate);
}

export function listActiveInterfaceNames(interfaces: NetworkInterfaceInfo[]): string[] {
    const uniqueNames = new Set<string>();
    for (const networkInterface of interfaces) {
        if (!isActiveNetworkInterface(networkInterface)) {
            continue;
        }
        const iface = networkInterface.iface?.trim();
        if (iface) {
            uniqueNames.add(iface);
        }
    }
    return [...uniqueNames];
}
