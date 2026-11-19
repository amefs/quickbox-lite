// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { hydrateRoot } from "react-dom/client";
import { createCache, StyleProvider } from "@ant-design/cssinjs";

import {
    isPackageManagementData,
    type PackageManagementBridge,
    type PackageManagementData,
    type PackageManagementRow,
} from "../shared/package-management-contract";
import { PackageManagementCenterView } from "../widgets/package-management-center-view";
import { useDashboardTheme } from "./theme-store";

interface PackageManagementActions {
    run: (action: "install" | "remove", packageName: string) => void;
}

declare global {
    interface Window {
        quickboxPackageManagementIsland?: PackageManagementBridge;
        quickboxPackageManagementActions?: PackageManagementActions;
    }
}

function createPackageManagementStore(initial: PackageManagementData) {
    let data = initial;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => data;
    const getServerSnapshot = () => initial;
    const onMessage = (value: unknown) => {
        if (!isPackageManagementData(value)) {
            return false;
        }
        data = value;
        publish();
        return true;
    };
    const bridge: PackageManagementBridge = { onMessage };
    return { subscribe, getSnapshot, getServerSnapshot, bridge };
}

const runtime = window.quickboxRuntime?.packageManagement;
if (runtime) {
    const clientRuntime = runtime;
    const store = createPackageManagementStore(clientRuntime.data);
    window.quickboxPackageManagementIsland = store.bridge;
    const mount = document.getElementById("pmc_widget");
    if (mount) {
        function ClientPackageManagement() {
            const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
            const activeTheme = useDashboardTheme(clientRuntime.theme);
            const actions = window.quickboxPackageManagementActions;
            return (
                <PackageManagementCenterView
                    data={data}
                    labels={clientRuntime.labels}
                    theme={activeTheme}
                    onPackageAction={(action, row: PackageManagementRow) => actions?.run(action, row.package)}
                />
            );
        }
        const cache = createCache();
        hydrateRoot(mount, <StyleProvider cache={cache}><ClientPackageManagement /></StyleProvider>);
    }
}
