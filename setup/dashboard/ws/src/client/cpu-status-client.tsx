// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";

import { isCpuStaticData, type CpuStatusBridge, type CpuStaticData } from "../shared/cpu-status-contract";
import { CpuStatusValue } from "../widgets/cpu-status-island";

function createCpuStatusStore() {
    let data: CpuStaticData | null = null;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => data;
    const getServerSnapshot = () => null;
    const onMessage = (value: unknown) => {
        if (!isCpuStaticData(value)) {
            return false;
        }
        data = value;
        publish();
        return true;
    };
    const bridge: CpuStatusBridge = { onMessage };
    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const store = createCpuStatusStore();
window.quickboxCpuStatusIsland = store.bridge;

const mount = document.getElementById("node-cpu-static");
if (mount) {
    function ClientCpuStatus() {
        const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
        return <CpuStatusValue data={data} />;
    }
    hydrateRoot(mount, <ClientCpuStatus />);
}
