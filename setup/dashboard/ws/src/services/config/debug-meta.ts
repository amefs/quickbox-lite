// SPDX-License-Identifier: GPL-3.0-or-later

import { packageList } from "../packages/info";
import type { DebugEndpointItem, DebugMetaPayload, DebugPackageItem } from "../../shared/bootstrap-contract";
import type { DashboardTheme } from "../../shared/theme";
import {
    BANDWIDTH_DATA_URL,
    DISK_DATA_URL,
    NETWORK_STATUS_URL,
    OUTPUT_LOG_URL,
    PACKAGE_MANAGEMENT_DATA_URL,
    RAM_STATS_DATA_URL,
    SERVICE_CONTROL_URL,
    SERVICE_STATUS_ALL_URL,
    SYSTEM_LOAD_DATA_URL,
    SYSTEM_STATIC_DATA_URL,
    SYSTEM_UPTIME_DATA_URL,
    TASK_STATUS_DATA_URL,
} from "../../shared/widget-streams";

export function getDebugEndpoints(): DebugEndpointItem[] {
    return [
        { name: "System Load", url: SYSTEM_LOAD_DATA_URL, description: "CPU load averages and process count", category: "widget" },
        { name: "System Static", url: SYSTEM_STATIC_DATA_URL, description: "CPU model and active network interfaces", category: "widget" },
        { name: "Network Status", url: NETWORK_STATUS_URL, description: "Network interface RX/TX bytes", category: "widget" },
        { name: "Uptime", url: SYSTEM_UPTIME_DATA_URL, description: "System uptime parts", category: "widget" },
        { name: "Disk Data", url: DISK_DATA_URL, description: "Disk usage and torrent counts", category: "widget" },
        { name: "RAM Stats", url: RAM_STATS_DATA_URL, description: "Memory usage raw byte metrics", category: "widget" },
        { name: "Bandwidth - Hourly", url: `${BANDWIDTH_DATA_URL}?page=h`, description: "Bandwidth tables (hourly)", category: "widget" },
        { name: "Bandwidth - Daily", url: `${BANDWIDTH_DATA_URL}?page=d`, description: "Bandwidth tables (daily)", category: "widget" },
        { name: "Bandwidth - Monthly", url: `${BANDWIDTH_DATA_URL}?page=m`, description: "Bandwidth tables (monthly)", category: "widget" },
        { name: "Bandwidth - Top 10", url: `${BANDWIDTH_DATA_URL}?page=t`, description: "Bandwidth tables (top 10 days)", category: "widget" },
        { name: "Running Task", url: TASK_STATUS_DATA_URL, description: "Active background task status", category: "widget" },
        { name: "Package Management State", url: PACKAGE_MANAGEMENT_DATA_URL, description: "Installed package states and lock status", category: "widget" },
        { name: "SSH Output Log", url: OUTPUT_LOG_URL, description: "Incremental output log (supports ?offset=N&length=N)", category: "widget" },
        { name: "Service Control", url: SERVICE_CONTROL_URL, description: "Installed service rows and boot state", category: "service" },
        { name: "All Service Statuses", url: SERVICE_STATUS_ALL_URL, description: "Running state and health for installed services", category: "service" },
    ];
}

export function getDebugPackages(): DebugPackageItem[] {
    return packageList
        .filter((pkg) => pkg.lockfile)
        .map((pkg) => ({ name: pkg.name, pkg: pkg.package }));
}

export function getDebugMeta(theme: DashboardTheme = "defaulted", basePath = ""): DebugMetaPayload {
    return {
        basePath: basePath === "/ws" ? "/ws" : "",
        theme,
        endpoints: getDebugEndpoints(),
        packages: getDebugPackages(),
    };
}
