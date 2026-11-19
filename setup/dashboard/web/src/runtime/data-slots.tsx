// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { isBandwidthTableData, type BandwidthIslandBridge, type BandwidthTableData } from "../../../ws/src/shared/bandwidth-contract";
import type { DashboardBootstrapPayload } from "../../../ws/src/shared/bootstrap-contract";
import { isCpuStaticData, type CpuStaticData, type CpuStatusBridge } from "../../../ws/src/shared/cpu-status-contract";
import { isDiskDataData, type DiskDataBridge, type DiskDataData } from "../../../ws/src/shared/disk-data-contract";
import { isMemoryStatsData, type MemoryStatsBridge, type MemoryStatsData } from "../../../ws/src/shared/memory-stats-contract";
import {
    isNetworkInterfaces,
    isNetworkSnapshot,
    type NetworkInterfaceCounters,
    type NetworkRate,
    type NetworkSnapshot,
    type NetworkStatusBridge,
} from "../../../ws/src/shared/network-status-contract";
import {
    isPackageManagementData,
    isPackageManagementStateData,
    type PackageManagementBridge,
    type PackageManagementData,
    type PackageManagementRow,
} from "../../../ws/src/shared/package-management-contract";
import { isRunningTaskData, type RunningTaskBridge, type RunningTaskData } from "../../../ws/src/shared/running-task-contract";
import {
    isSystemLoadData,
    isUptimeParts,
    type SystemSummaryBridge,
    type UptimeParts,
} from "../../../ws/src/shared/system-summary-contract";
import { BandwidthTablesRoot } from "../components/bandwidth-tables-view";
import { CpuStatusValue } from "../components/cpu-status-island";
import { DiskDataRoot } from "../components/disk-data-island";
import { MemoryStatsRoot } from "../components/memory-stats-island";
import { NetworkInterfaceRows } from "../components/network-status-island";
import { PackageManagementCenterView } from "../components/package-management-center-view";
import { PackageManagementPlaceholder, UptimePlaceholder } from "../components/placeholder";
import { RunningTaskIsland } from "../components/running-task-island";
import { SystemLoadValue, UptimeValue } from "../components/system-summary-island";
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
    loadText: string | null;
    uptime: UptimeParts | null;
}

const bandwidthStore = createValueStore<BandwidthTableData | null>(null);
const cpuStatusStore = createValueStore<CpuStaticData | null>(null);
const diskDataStore = createValueStore<DiskDataData | null>(null);
const memoryStatsStore = createValueStore<MemoryStatsData | null>(null);
const networkStore = createValueStore<NetworkState>({ interfaces: [], loaded: false, rates: {} });
const packageStore = createValueStore<PackageManagementData | null>(null);
const runningTaskStore = createValueStore<RunningTaskData | null>(null);
const systemSummaryStore = createValueStore<SummaryState>({ loadText: null, uptime: null });

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

export function registerDataIslands(bootstrap: DashboardBootstrapPayload) {
    let previousNetwork: NetworkSnapshot | undefined;

    networkStore.setValue({
        interfaces: bootstrap.networkInterfaces,
        loaded: bootstrap.networkInterfacesLoaded,
        rates: emptyRates(bootstrap.networkInterfaces, "0 B/s"),
    });
    packageStore.setValue(bootstrap.packageManagement.data);
    runningTaskStore.setValue(bootstrap.runningTask);
    systemSummaryStore.setValue({ loadText: null, uptime: bootstrap.systemSummary.uptime });

    window.quickboxBandwidthIsland = {
        onMessage: (value) => {
            if (!isBandwidthTableData(value)) {return false;}
            bandwidthStore.setValue(value);
            return true;
        },
    };
    window.quickboxCpuStatusIsland = {
        onMessage: (value) => {
            if (!isCpuStaticData(value)) {return false;}
            cpuStatusStore.setValue(value);
            return true;
        },
    };
    const updateDisk = (value: unknown) => {
        if (!isDiskDataData(value)) {return false;}
        diskDataStore.setValue(value);
        return true;
    };
    window.quickboxDiskDataIsland = { onPrefetch: updateDisk, onMessage: updateDisk };

    const updateMemory = (value: unknown) => {
        if (!isMemoryStatsData(value)) {return false;}
        memoryStatsStore.setValue(value);
        return true;
    };
    window.quickboxMemoryStatsIsland = { onPrefetch: updateMemory, onMessage: updateMemory };

    window.quickboxNetworkIsland = {
        onInterfaces: (interfaces) => {
            if (!isNetworkInterfaces(interfaces)) {return false;}
            networkStore.setValue({ interfaces, loaded: true, rates: emptyRates(interfaces, "0B/s") });
            return true;
        },
        onMessage: (value) => {
            if (!isNetworkSnapshot(value)) {return false;}
            if (!previousNetwork) {
                previousNetwork = value;
                return true;
            }
            const duration = value.ts - previousNetwork.ts;
            if (duration < 1e-5) {return true;}

            const current = networkStore.getSnapshot();
            let invalidData = false;
            const rates = { ...current.rates };
            for (const iface of Object.keys(value.net)) {
                if (!Object.hasOwn(previousNetwork.net, iface) || !Object.hasOwn(value.net, iface)) {
                    invalidData = true;
                    continue;
                }
                const prior: NetworkInterfaceCounters = previousNetwork.net[iface];
                const next: NetworkInterfaceCounters = value.net[iface];
                const outSpeed = (next.tx_bytes - prior.tx_bytes) / duration;
                const inSpeed = (next.rx_bytes - prior.rx_bytes) / duration;
                if (Number.isNaN(outSpeed) || Number.isNaN(inSpeed)) {
                    invalidData = true;
                    continue;
                }
                if (current.interfaces.includes(iface)) {
                    rates[iface] = {
                        tx: formatNetworkSpeed(outSpeed),
                        rx: formatNetworkSpeed(inSpeed),
                    };
                }
            }
            if (Object.keys(rates).some((iface) => rates[iface] !== current.rates[iface])) {
                networkStore.setValue({ ...current, rates });
            }
            if (!invalidData) {
                previousNetwork = value;
            }
            return true;
        },
    };

    window.quickboxPackageManagementIsland = {
        onMessage: (value) => {
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
    };

    window.quickboxRunningTaskIsland = {
        onMessage: (value) => {
            if (!isRunningTaskData(value)) {return false;}
            runningTaskStore.setValue(value);
            return true;
        },
    };

    window.quickboxSystemSummaryIsland = {
        onPrefetch: (value) => {
            if (!isSystemLoadData(value)) {return false;}
            systemSummaryStore.setValue({ ...systemSummaryStore.getSnapshot(), loadText: value.text });
            return true;
        },
        onMessage: (key, value) => {
            if (key === "TOP" && isSystemLoadData(value)) {
                systemSummaryStore.setValue({ ...systemSummaryStore.getSnapshot(), loadText: value.text });
                return true;
            }
            if (key === "UPTIME" && isUptimeParts(value)) {
                systemSummaryStore.setValue({ ...systemSummaryStore.getSnapshot(), uptime: value });
                return true;
            }
            return false;
        },
    };
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

const markdownTextParser = unified().use(remarkParse);

function markdownToPlainText(markdown: string): string {
    return mdastToString(markdownTextParser.parse(markdown)).replace(/\s+/g, " ").trim();
}

export function PackageManagementSlot({ bootstrap, ready = true }: { bootstrap: DashboardBootstrapPayload; ready?: boolean }) {
    const { t } = useTranslation();
    const data = useSyncExternalStore(packageStore.subscribe, packageStore.getSnapshot, packageStore.getSnapshot);
    const activeTheme = useDashboardTheme(bootstrap.serviceTheme);
    const actions = window.quickboxPackageManagementActions;
    if (!ready || !data) {return <PackageManagementPlaceholder />;}
    const localizedData: PackageManagementData = {
        ...data,
        rows: data.rows.map((row) => {
            const descriptionSource = row.descriptionKey ? t(row.descriptionKey) : (row.descriptionText ?? "");
            return {
                ...row,
                descriptionText: markdownToPlainText(descriptionSource),
                installTooltip: row.installTooltipKey ? t(row.installTooltipKey) : (row.installTooltip ?? ""),
            };
        }),
    };
    const localizedLabels = {
        title: t("PACKAGE_MANAGEMENT_CENTER"),
        name: t("NAME"),
        details: t("DETAILS"),
        availability: t("AVAILABILITY"),
        installed: t("INSTALLED"),
        install: t("INSTALL"),
        box: t("BOX"),
        notice: t("PMC_NOTICE_TXT"),
        clearLockText: t("CLEAR_LOCK_TXT"),
        clearLock: t("CLEAR_LOCK"),
        viewLog: t("VIEW_LOG"),
        uninstallTitle: t("UNINSTALL_TITLE"),
        cancel: t("CANCEL"),
        agree: t("AGREE"),
        empty: "No matching records found.",
        searchPlaceholder: "Search:",
        total: "entries",
    };
    return (
        <PackageManagementCenterView
            data={localizedData}
            labels={localizedLabels}
            theme={activeTheme}
            onPackageAction={(action, row: PackageManagementRow) => actions?.run(action, row.package)}
        />
    );
}

export function RunningTaskSlot() {
    const data = useSyncExternalStore(runningTaskStore.subscribe, runningTaskStore.getSnapshot, runningTaskStore.getSnapshot);
    return <RunningTaskIsland data={data} />;
}

export function SystemLoadSlot() {
    const state = useSyncExternalStore(systemSummaryStore.subscribe, systemSummaryStore.getSnapshot, systemSummaryStore.getSnapshot);
    return <SystemLoadValue text={state.loadText} />;
}

export function UptimeSlot({ bootstrap: _bootstrap }: { bootstrap: DashboardBootstrapPayload }) {
    const { t } = useTranslation();
    const state = useSyncExternalStore(systemSummaryStore.subscribe, systemSummaryStore.getSnapshot, systemSummaryStore.getSnapshot);
    const labels = {
        days: t("DAYS_L"),
        hours: t("HOURS_L"),
        minutes: t("MINUTES_L"),
    };
    return state.uptime ? <UptimeValue parts={state.uptime} labels={labels} /> : <UptimePlaceholder />;
}
