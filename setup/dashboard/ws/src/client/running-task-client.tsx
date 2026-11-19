// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";

import { isRunningTaskData, type RunningTaskBridge, type RunningTaskData } from "../shared/running-task-contract";
import { RunningTaskIsland } from "../widgets/running-task-island";

declare global {
    interface Window {
        quickboxRunningTaskIsland?: RunningTaskBridge;
    }
}

function createRunningTaskStore(initialData: RunningTaskData | null) {
    let data: RunningTaskData | null = initialData;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => data;
    const getServerSnapshot = () => initialData;
    const onMessage = (value: unknown) => {
        if (!isRunningTaskData(value)) {
            return false;
        }
        data = value;
        publish();
        return true;
    };
    const bridge: RunningTaskBridge = { onMessage };
    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const initialData = window.quickboxRuntime?.runningTask && isRunningTaskData(window.quickboxRuntime.runningTask)
    ? window.quickboxRuntime.runningTask
    : null;

const store = createRunningTaskStore(initialData);
window.quickboxRunningTaskIsland = store.bridge;

const mount = document.getElementById("running_task_widget");
if (mount) {
    function ClientRunningTask() {
        const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
        return <RunningTaskIsland data={data} />;
    }
    hydrateRoot(mount, <ClientRunningTask />);
}
