// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";

import { isMemoryStatsData, type MemoryStatsBridge, type MemoryStatsData } from "../shared/memory-stats-contract";
import { MemoryStatsRoot } from "../widgets/memory-stats-island";

function createMemoryStatsStore() {
    let data: MemoryStatsData | null = null;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => data;
    const getServerSnapshot = () => null;
    const update = (value: unknown) => {
        if (!isMemoryStatsData(value)) {
            return false;
        }
        data = value;
        publish();
        return true;
    };
    const bridge: MemoryStatsBridge = { onPrefetch: update, onMessage: update };
    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const store = createMemoryStatsStore();
window.quickboxMemoryStatsIsland = store.bridge;

const mount = document.getElementById("meterram");
if (mount) {
    function ClientMemoryStats() {
        const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
        return <MemoryStatsRoot data={data} />;
    }
    hydrateRoot(mount, <ClientMemoryStats />);
}
