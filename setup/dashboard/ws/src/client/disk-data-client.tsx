// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";

import { isDiskDataData, type DiskDataBridge, type DiskDataData } from "../shared/disk-data-contract";
import { DiskDataRoot } from "../widgets/disk-data-island";

function createDiskDataStore() {
    let data: DiskDataData | null = null;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => data;
    const getServerSnapshot = () => null;
    const update = (value: unknown) => {
        if (!isDiskDataData(value)) {
            return false;
        }
        data = value;
        publish();
        return true;
    };
    const bridge: DiskDataBridge = { onPrefetch: update, onMessage: update };
    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const store = createDiskDataStore();
window.quickboxDiskDataIsland = store.bridge;

const mount = document.getElementById("disk_data");
if (mount) {
    function ClientDiskData() {
        const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
        return <DiskDataRoot data={data} />;
    }
    hydrateRoot(mount, <ClientDiskData />);
}
