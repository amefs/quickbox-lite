// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";

import {
    isSystemLoadData,
    isUptimeParts,
    type SystemSummaryBridge,
    type SystemSummaryRuntime,
    type UptimeParts,
} from "../shared/system-summary-contract";
import { SystemLoadValue, UptimeValue } from "../widgets/system-summary-island";

interface SystemSummarySnapshot {
    loadText: string | null;
    uptime: UptimeParts;
}

function createSystemSummaryStore(initial: SystemSummaryRuntime) {
    const serverSnapshot: SystemSummarySnapshot = { loadText: null, uptime: initial.uptime };
    let snapshot = serverSnapshot;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };

    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => snapshot;
    const getServerSnapshot = () => serverSnapshot;

    const setLoad = (data: unknown) => {
        if (!isSystemLoadData(data)) {
            return false;
        }
        if (snapshot.loadText === data.text) {
            return true;
        }
        snapshot = { ...snapshot, loadText: data.text };
        publish();
        return true;
    };

    const setUptime = (data: unknown) => {
        if (!isUptimeParts(data)) {
            return false;
        }
        if (snapshot.uptime.days === data.days && snapshot.uptime.hours === data.hours &&
            snapshot.uptime.minutes === data.minutes) {
            return true;
        }
        snapshot = { ...snapshot, uptime: data };
        publish();
        return true;
    };

    const bridge: SystemSummaryBridge = {
        onPrefetch: setLoad,
        onMessage: (key, data) => key === "TOP" ? setLoad(data) : setUptime(data),
    };

    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const runtime = window.quickboxRuntime;
const systemSummary = runtime?.systemSummary;
if (runtime && systemSummary) {
    const summaryRuntime = systemSummary;
    const store = createSystemSummaryStore(summaryRuntime);
    window.quickboxSystemSummaryIsland = store.bridge;

    const loadMount = document.getElementById("cpuload");
    if (loadMount) {
        function ClientSystemLoad() {
            const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
            return <SystemLoadValue text={snapshot.loadText} />;
        }
        hydrateRoot(loadMount, <ClientSystemLoad />);
    }

    const uptimeMount = document.getElementById("uptime");
    if (uptimeMount) {
        function ClientUptime() {
            const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
            return <UptimeValue parts={snapshot.uptime} labels={summaryRuntime.labels} />;
        }
        hydrateRoot(uptimeMount, <ClientUptime />);
    }
}
