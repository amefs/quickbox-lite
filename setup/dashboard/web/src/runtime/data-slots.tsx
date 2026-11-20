// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";

import { isBandwidthTableData, type BandwidthIslandBridge, type BandwidthTableData } from "../../../ws/src/shared/bandwidth-contract";
import type { DashboardBootstrapPayload } from "../../../ws/src/shared/bootstrap-contract";
import { isCpuStaticData, type CpuStaticData, type CpuStatusBridge } from "../../../ws/src/shared/cpu-status-contract";
import { isDiskDataPayload, type DiskDataBridge, type DiskDataPayload } from "../../../ws/src/shared/disk-data-contract";
import { isMemoryStatsPayload, type MemoryStatsBridge, type MemoryStatsPayload } from "../../../ws/src/shared/memory-stats-contract";
import {
    isNetworkInterfaces,
    isNetworkSnapshot,
    type NetworkRate,
    type NetworkSnapshot,
    type NetworkStatusBridge,
} from "../../../ws/src/shared/network-status-contract";
import {
    isPackageManagementData,
    isPackageManagementStateData,
    type PackageManagementBridge,
    type PackageManagementData,
} from "../../../ws/src/shared/package-management-contract";
import { isRunningTaskData, type RunningTaskBridge, type RunningTaskData } from "../../../ws/src/shared/running-task-contract";
import {
    isSystemLoadData,
    isUptimeParts,
    type SystemLoadData,
    type SystemSummaryBridge,
    type UptimeParts,
} from "../../../ws/src/shared/system-summary-contract";
import { BandwidthTablesRoot } from "../components/bandwidth-tables-view";
import { CpuStatusValue } from "../components/cpu-status-island";
import { DiskDataRoot } from "../components/disk-data-island";
import { MemoryStatsRoot } from "../components/memory-stats-island";
import { NetworkInterfaceRows } from "../components/network-status-island";
import { PackageManagementCenterView } from "../components/package-management-center-view";
import { RunningTaskIsland } from "../components/running-task-island";
import { SystemLoadValue, UptimeValue } from "../components/system-summary-island";
import { executePackageAction } from "./dashboard-runtime-client";
import { useDashboardTheme } from "./theme-store";

declare global {
    interface Window {
        quickboxBandwidthIsland?: BandwidthIslandBridge;
        quickboxCpuStatusIsland?: CpuStatusBridge;
        quickboxDiskDataIsland?: DiskDataBridge;
        quickboxMemoryStatsIsland?: MemoryStatsBridge;
        quickboxNetworkIsland?: NetworkStatusBridge;
        quickboxPackageManagementIsland?: PackageManagementBridge;
        quickboxRunningTaskIsland?: RunningTaskBridge;
        quickboxSystemSummaryIsland?: SystemSummaryBridge;
    }
}

function createValueStore<T>(initialValue: T) {
    let value = initialValue;
    let serialized = JSON.stringify(initialValue);
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => value;
    const setValue = (nextValue: T) => {
        if (Object.is(value, nextValue)) {
            return;
        }
        const nextSerialized = JSON.stringify(nextValue);
        if (nextSerialized === serialized) {
            return;
        }
        value = nextValue;
        serialized = nextSerialized;
        publish();
    };
    return { subscribe, getSnapshot, setValue };
}

interface NetworkState {
    interfaces: string[];
    loaded: boolean;
    rates: Record<string, NetworkRate>;
}

interface SummaryState {
    load: SystemLoadData | null;
    uptime: UptimeParts | null;
}

const bandwidthStore = createValueStore<BandwidthTableData | null>(null);
const cpuStatusStore = createValueStore<CpuStaticData | null>(null);
const diskDataStore = createValueStore<DiskDataPayload | null>(null);
const memoryStatsStore = createValueStore<MemoryStatsPayload | null>(null);
const networkStore = createValueStore<NetworkState>({ interfaces: [], loaded: false, rates: {} });
const packageStore = createValueStore<PackageManagementData | null>(null);
const runningTaskStore = createValueStore<RunningTaskData | null>(null);
const systemSummaryStore = createValueStore<SummaryState>({ load: null, uptime: null });
let previousNetwork: NetworkSnapshot | undefined;

function emptyRates(interfaces: string[], value: string): Record<string, NetworkRate> {
    return Object.fromEntries(interfaces.map((iface) => [iface, { tx: value, rx: value }]));
}

function formatNetworkSpeed(length: number): string {
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

const updateDisk = (value: unknown) => {
    if (!isDiskDataPayload(value)) {return false;}
    diskDataStore.setValue(value);
    return true;
};

const updateMemory = (value: unknown) => {
    if (!isMemoryStatsPayload(value)) {return false;}
    memoryStatsStore.setValue(value);
    return true;
};

export const dataIslandBridges = {
    bandwidth: {
        onMessage: (value: unknown) => {
            if (!isBandwidthTableData(value)) {return false;}
            bandwidthStore.setValue(value);
            return true;
        },
    } satisfies BandwidthIslandBridge,
    cpuStatus: {
        onMessage: (value: unknown) => {
            if (!isCpuStaticData(value)) {return false;}
            cpuStatusStore.setValue(value);
            return true;
        },
    } satisfies CpuStatusBridge,
    diskData: { onPrefetch: updateDisk, onMessage: updateDisk } satisfies DiskDataBridge,
    memoryStats: { onPrefetch: updateMemory, onMessage: updateMemory } satisfies MemoryStatsBridge,
    network: {
        onInterfaces: (interfaces: unknown) => {
            if (!isNetworkInterfaces(interfaces)) {return false;}
            if (!previousNetwork) {
                networkStore.setValue({ interfaces, loaded: true, rates: emptyRates(interfaces, "0 B/s") });
            }
            return true;
        },
        onMessage: (value: unknown) => {
            if (!isNetworkSnapshot(value)) {return false;}
            const previous = previousNetwork;
            const duration = previous ? value.ts - previous.ts : 0;
            if (previous && duration >= 0 && duration < 1e-5) {return true;}

            const interfaces = Object.keys(value.net);
            const rates = Object.fromEntries(Object.entries(value.net).map(([iface, next]) => {
                const prior = previous && duration > 0 && Object.hasOwn(previous.net, iface) ? previous.net[iface] : undefined;
                return [iface, {
                    tx: prior ? formatNetworkSpeed((next.tx_bytes - prior.tx_bytes) / duration) : "0 B/s",
                    rx: prior ? formatNetworkSpeed((next.rx_bytes - prior.rx_bytes) / duration) : "0 B/s",
                }];
            }));
            previousNetwork = value;
            networkStore.setValue({ interfaces, loaded: true, rates });
            return true;
        },
    } satisfies NetworkStatusBridge,
    packageManagement: {
        onMessage: (value: unknown) => {
            if (isPackageManagementStateData(value)) {
                const current = packageStore.getSnapshot();
                if (!current) {return false;}
                packageStore.setValue({
                    rows: current.rows.map((row) => ({
                        ...row,
                        installed: value.installedByPackage[row.package] ?? row.installed,
                    })),
                    installLockExists: value.installLockExists,
                });
                return true;
            }
            if (!isPackageManagementData(value)) {return false;}
            packageStore.setValue(value);
            return true;
        },
    } satisfies PackageManagementBridge,
    runningTask: {
        onMessage: (value: unknown) => {
            if (!isRunningTaskData(value)) {return false;}
            runningTaskStore.setValue(value);
            return true;
        },
    } satisfies RunningTaskBridge,
    systemSummary: {
        onPrefetch: (value: unknown) => {
            if (!isSystemLoadData(value)) {return false;}
            systemSummaryStore.setValue({ ...systemSummaryStore.getSnapshot(), load: value });
            return true;
        },
        onMessage: (key: "TOP" | "UPTIME", value: unknown) => {
            if (key === "TOP" && isSystemLoadData(value)) {
                systemSummaryStore.setValue({ ...systemSummaryStore.getSnapshot(), load: value });
                return true;
            }
            if (key === "UPTIME" && isUptimeParts(value)) {
                systemSummaryStore.setValue({ ...systemSummaryStore.getSnapshot(), uptime: value });
                return true;
            }
            return false;
        },
    } satisfies SystemSummaryBridge,
};

export function registerDataIslands(bootstrap: DashboardBootstrapPayload) {
    previousNetwork = undefined;

    networkStore.setValue({
        interfaces: bootstrap.networkInterfaces,
        loaded: bootstrap.networkInterfacesLoaded,
        rates: emptyRates(bootstrap.networkInterfaces, "0 B/s"),
    });
    packageStore.setValue(bootstrap.packageManagement.data);
    runningTaskStore.setValue(bootstrap.runningTask);
    systemSummaryStore.setValue({ load: null, uptime: bootstrap.systemSummary.uptime });

    window.quickboxBandwidthIsland = dataIslandBridges.bandwidth;
    window.quickboxCpuStatusIsland = dataIslandBridges.cpuStatus;
    window.quickboxDiskDataIsland = dataIslandBridges.diskData;
    window.quickboxMemoryStatsIsland = dataIslandBridges.memoryStats;
    window.quickboxNetworkIsland = dataIslandBridges.network;
    window.quickboxPackageManagementIsland = dataIslandBridges.packageManagement;
    window.quickboxRunningTaskIsland = dataIslandBridges.runningTask;
    window.quickboxSystemSummaryIsland = dataIslandBridges.systemSummary;
}

export function BandwidthTablesSlot() {
    const data = useSyncExternalStore(bandwidthStore.subscribe, bandwidthStore.getSnapshot, bandwidthStore.getSnapshot);
    return <BandwidthTablesRoot data={data} />;
}

export function CpuStatusSlot() {
    const data = useSyncExternalStore(cpuStatusStore.subscribe, cpuStatusStore.getSnapshot, cpuStatusStore.getSnapshot);
    return <CpuStatusValue data={data} />;
}

export function DiskDataSlot() {
    const data = useSyncExternalStore(diskDataStore.subscribe, diskDataStore.getSnapshot, diskDataStore.getSnapshot);
    return <DiskDataRoot data={data} />;
}

export function MemoryStatsSlot() {
    const data = useSyncExternalStore(memoryStatsStore.subscribe, memoryStatsStore.getSnapshot, memoryStatsStore.getSnapshot);
    return <MemoryStatsRoot data={data} />;
}

export function NetworkInterfaceRowsSlot() {
    const state = useSyncExternalStore(networkStore.subscribe, networkStore.getSnapshot, networkStore.getSnapshot);
    return <NetworkInterfaceRows interfaces={state.interfaces} loaded={state.loaded} rates={state.rates} />;
}

export function PackageManagementSlot({ bootstrap, ready = true }: { bootstrap: DashboardBootstrapPayload; ready?: boolean }) {
    const data = useSyncExternalStore(packageStore.subscribe, packageStore.getSnapshot, packageStore.getSnapshot);
    const activeTheme = useDashboardTheme(bootstrap.serviceTheme);
    return (
        <PackageManagementCenterView
            data={ready ? data : null}
            theme={activeTheme}
            onPackageAction={(action, row) => { executePackageAction(action, row.package); }}
        />
    );
}

export function RunningTaskSlot() {
    const data = useSyncExternalStore(runningTaskStore.subscribe, runningTaskStore.getSnapshot, runningTaskStore.getSnapshot);
    return <RunningTaskIsland data={data} />;
}

export function SystemLoadSlot() {
    const state = useSyncExternalStore(systemSummaryStore.subscribe, systemSummaryStore.getSnapshot, systemSummaryStore.getSnapshot);
    return <SystemLoadValue data={state.load} />;
}

export function UptimeSlot() {
    const state = useSyncExternalStore(systemSummaryStore.subscribe, systemSummaryStore.getSnapshot, systemSummaryStore.getSnapshot);
    return <UptimeValue parts={state.uptime} />;
}
