// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";

import {
    isNetworkInterfaces,
    isNetworkSnapshot,
    type NetworkInterfaceCounters,
    type NetworkRate,
    type NetworkSnapshot,
    type NetworkStatusBridge,
} from "../shared/network-status-contract";
import { NetworkInterfaceRows } from "../widgets/network-status-island";

interface NetworkStatusSnapshot {
    interfaces: string[];
    interfacesLoaded: boolean;
    rates: Record<string, NetworkRate>;
}

function emptyRates(interfaces: string[], value: string) {
    return Object.fromEntries(interfaces.map((iface) => [iface, { tx: value, rx: value }])) as Record<string, NetworkRate>;
}

function formatNetworkSpeed(length: number) {
    const suffixList = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
    let numeric = length;
    let idx = 0;
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return "0 B/s";
    }
    while (numeric >= 1024 && idx < suffixList.length - 1) {
        numeric /= 1024;
        idx += 1;
    }
    return `${numeric.toFixed(idx > 0 ? 2 : 0)} ${suffixList[idx]}`;
}

function createNetworkStatusStore(initialInterfaces: string[], initiallyLoaded: boolean) {
    let snapshot: NetworkStatusSnapshot = {
        interfaces: initialInterfaces,
        interfacesLoaded: initiallyLoaded,
        rates: emptyRates(initialInterfaces, "0 B/s"),
    };
    const serverSnapshot = snapshot;
    let previous: NetworkSnapshot | undefined;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => snapshot;
    const getServerSnapshot = () => serverSnapshot;

    const onInterfaces = (value: unknown) => {
        if (!isNetworkInterfaces(value)) {
            return false;
        }
        snapshot = {
            ...snapshot,
            interfaces: value,
            interfacesLoaded: true,
            rates: emptyRates(value, "0B/s"),
        };
        publish();
        return true;
    };

    const onMessage = (value: unknown) => {
        if (!isNetworkSnapshot(value)) {
            return false;
        }
        const current = value;
        if (!previous) {
            previous = current;
            return true;
        }
        const duration = current.ts - previous.ts;
        if (duration < 1e-5) {
            return true;
        }

        let invalidData = false;
        const rates = { ...snapshot.rates };
        for (const networkInterface of Object.keys(current.net)) {
            if (!Object.hasOwn(previous.net, networkInterface) || !Object.hasOwn(current.net, networkInterface)) {
                invalidData = true;
                continue;
            }
            const prior: NetworkInterfaceCounters = previous.net[networkInterface];
            const next: NetworkInterfaceCounters = current.net[networkInterface];

            const outSpeed = (next.tx_bytes - prior.tx_bytes) / duration;
            if (Number.isNaN(outSpeed)) {
                invalidData = true;
                console.warn("[NaN DETECTED] " + networkInterface + "/tx", outSpeed, next, prior, duration);
            } else if (snapshot.interfaces.includes(networkInterface)) {
                rates[networkInterface] = {
                    ...(rates[networkInterface] ?? { tx: "0B/s", rx: "0B/s" }),
                    tx: formatNetworkSpeed(outSpeed),
                };
            }

            const inSpeed = (next.rx_bytes - prior.rx_bytes) / duration;
            if (Number.isNaN(inSpeed)) {
                invalidData = true;
                console.warn("[NaN DETECTED] " + networkInterface + "/rx", inSpeed, next, prior, duration);
            } else if (snapshot.interfaces.includes(networkInterface)) {
                rates[networkInterface] = {
                    ...(rates[networkInterface] ?? { tx: "0B/s", rx: "0B/s" }),
                    rx: formatNetworkSpeed(inSpeed),
                };
            }
        }

        if (Object.keys(rates).some((iface) => rates[iface] !== snapshot.rates[iface])) {
            snapshot = { ...snapshot, rates };
            publish();
        }
        if (!invalidData) {
            previous = current;
        }
        return true;
    };

    const bridge: NetworkStatusBridge = { onInterfaces, onMessage };
    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const runtime = window.quickboxRuntime;
if (runtime) {
    const store = createNetworkStatusStore(runtime.networkInterfaces, runtime.networkInterfacesLoaded);
    window.quickboxNetworkIsland = store.bridge;
    const mount = document.getElementById("node-network-interface-rows");
    if (mount) {
        function ClientNetworkInterfaceRows() {
            const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
            return <NetworkInterfaceRows interfaces={snapshot.interfaces} loaded={snapshot.interfacesLoaded} rates={snapshot.rates} />;
        }
        hydrateRoot(mount, <ClientNetworkInterfaceRows />);
    }
}
