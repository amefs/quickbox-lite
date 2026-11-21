// SPDX-License-Identifier: GPL-3.0-or-later

export const NETWORK_STATUS_URL = "/node/net_status" as const;
export const TASK_STATUS_DATA_URL = "/node/data/task_status" as const;
export const SERVICE_CONTROL_URL = "/node/data/service_control" as const;
export const SERVICE_STATUS_ALL_URL = "/node/data/service_status_all" as const;
export const RAM_STATS_DATA_URL = "/node/data/ram_stats" as const;
export const DISK_DATA_URL = "/node/data/disk_data" as const;
export const PACKAGE_MANAGEMENT_DATA_URL = "/node/data/pmc" as const;
export const SYSTEM_UPTIME_DATA_URL = "/node/data/system_uptime" as const;
export const SYSTEM_LOAD_DATA_URL = "/node/data/system_load" as const;
export const SYSTEM_STATIC_DATA_URL = "/node/data/system_static" as const;
export const BANDWIDTH_DATA_URL = "/node/data/bandwidth" as const;
export const OUTPUT_LOG_URL = "/db/output.log" as const;

export type BandwidthPage = "h" | "d" | "m" | "t";

export const VALID_BANDWIDTH_PAGES: readonly BandwidthPage[] = ["h", "d", "m", "t"];

export function normalizeBandwidthPage(value: unknown): BandwidthPage {
    return typeof value === "string" && VALID_BANDWIDTH_PAGES.includes(value as BandwidthPage)
        ? (value as BandwidthPage)
        : "t";
}

export type DashboardStreamKey =
    | "NETWORK"
    | "TASK_STATUS"
    | "SERVICE_STATUS_ALL"
    | "SERVICE_CONTROL"
    | "RAM_USAGE"
    | "DISK_USAGE"
    | "PMC"
    | "UPTIME"
    | "TOP"
    | "BANDWIDTH";

export interface DashboardStreamConfig {
    key: DashboardStreamKey;
    url: string;
    elementId?: string;
    group: "widget" | "service";
    bootstrap?: boolean;
    visibleMs: number;
    activeVisibleMs?: number;
    hiddenMs: number;
    dedupe?: boolean;
    param?: "bandwidthPage";
}

export const DASHBOARD_STREAMS: readonly DashboardStreamConfig[] = [
    {
        key: "NETWORK",
        url: NETWORK_STATUS_URL,
        group: "widget",
        bootstrap: true,
        visibleMs: 1000,
        hiddenMs: 10000,
    },
    {
        key: "TASK_STATUS",
        url: TASK_STATUS_DATA_URL,
        elementId: "#running_task_widget",
        group: "widget",
        bootstrap: true,
        visibleMs: 15000,
        activeVisibleMs: 5000,
        hiddenMs: 60000,
        dedupe: true,
    },
    {
        key: "SERVICE_STATUS_ALL",
        url: SERVICE_STATUS_ALL_URL,
        group: "service",
        visibleMs: 5000,
        hiddenMs: 30000,
        dedupe: true,
    },
    {
        key: "SERVICE_CONTROL",
        url: SERVICE_CONTROL_URL,
        group: "service",
        visibleMs: 60000,
        hiddenMs: 120000,
        dedupe: true,
    },
    {
        key: "RAM_USAGE",
        url: RAM_STATS_DATA_URL,
        elementId: "#meterram",
        group: "widget",
        bootstrap: true,
        visibleMs: 10000,
        hiddenMs: 60000,
    },
    {
        key: "DISK_USAGE",
        url: DISK_DATA_URL,
        elementId: "#disk_data",
        group: "widget",
        bootstrap: true,
        visibleMs: 15000,
        hiddenMs: 60000,
        dedupe: true,
    },
    {
        key: "PMC",
        url: PACKAGE_MANAGEMENT_DATA_URL,
        elementId: "#pmc_widget",
        group: "widget",
        bootstrap: false,
        visibleMs: 30000,
        hiddenMs: 120000,
        dedupe: true,
    },
    {
        key: "UPTIME",
        url: SYSTEM_UPTIME_DATA_URL,
        elementId: "#uptime",
        group: "widget",
        bootstrap: true,
        visibleMs: 60000,
        hiddenMs: 180000,
        dedupe: true,
    },
    {
        key: "TOP",
        url: SYSTEM_LOAD_DATA_URL,
        elementId: "#cpuload",
        group: "widget",
        bootstrap: true,
        visibleMs: 60000,
        hiddenMs: 180000,
    },
    {
        key: "BANDWIDTH",
        url: BANDWIDTH_DATA_URL,
        elementId: "#bw_tables",
        group: "widget",
        bootstrap: true,
        visibleMs: 60000,
        hiddenMs: 180000,
        param: "bandwidthPage",
    },
];

export const DASHBOARD_STREAM_BY_KEY: Record<DashboardStreamKey, DashboardStreamConfig> = Object.fromEntries(
    DASHBOARD_STREAMS.map((stream) => [stream.key, stream]),
) as Record<DashboardStreamKey, DashboardStreamConfig>;

