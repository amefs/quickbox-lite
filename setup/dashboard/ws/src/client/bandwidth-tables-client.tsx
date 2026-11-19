// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";

import {
    isBandwidthTableData,
    type BandwidthIslandBridge,
    type BandwidthTableData,
} from "../shared/bandwidth-contract";
import { BandwidthTablesRoot } from "../widgets/bandwidth-tables-view";

function createBandwidthStore() {
    let data: BandwidthTableData | null = null;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => data;
    const getServerSnapshot = () => null;
    const onMessage = (value: unknown) => {
        if (!isBandwidthTableData(value)) {
            return false;
        }
        data = value;
        publish();
        return true;
    };
    const bridge: BandwidthIslandBridge = { onMessage };
    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const store = createBandwidthStore();
window.quickboxBandwidthIsland = store.bridge;

const mount = document.getElementById("bw_tables");
if (mount) {
    function ClientBandwidthTables() {
        const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
        return <BandwidthTablesRoot data={data} />;
    }
    hydrateRoot(mount, <ClientBandwidthTables />);
}
