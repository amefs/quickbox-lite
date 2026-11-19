// SPDX-License-Identifier: GPL-3.0-or-later

import { packageList } from "../packages/info";
import type { DebugEndpointItem, DebugMetaPayload, DebugPackageItem } from "../../shared/bootstrap-contract";
import type { DashboardTheme } from "../../shared/theme";

export function getDebugEndpoints(): DebugEndpointItem[] {
    return [
        { name: "System Load", url: "/node/data/system_load", description: "CPU load averages and process count", category: "widget" },
        { name: "System Static", url: "/node/data/system_static", description: "CPU model and active network interfaces", category: "widget" },
        { name: "Network Status", url: "/node/net_status", description: "Network interface RX/TX bytes", category: "widget" },
        { name: "Uptime", url: "/node/data/system_uptime", description: "System uptime parts", category: "widget" },
        { name: "Disk Data", url: "/node/data/disk_data", description: "Disk usage and torrent counts", category: "widget" },
        { name: "RAM Stats", url: "/node/data/ram_stats", description: "Memory usage raw byte metrics", category: "widget" },
        { name: "Bandwidth - Hourly", url: "/node/data/bandwidth?page=h", description: "Bandwidth tables (hourly)", category: "widget" },
        { name: "Bandwidth - Daily", url: "/node/data/bandwidth?page=d", description: "Bandwidth tables (daily)", category: "widget" },
        { name: "Bandwidth - Monthly", url: "/node/data/bandwidth?page=m", description: "Bandwidth tables (monthly)", category: "widget" },
        { name: "Bandwidth - Top 10", url: "/node/data/bandwidth?page=t", description: "Bandwidth tables (top 10 days)", category: "widget" },
        { name: "Running Task", url: "/node/data/task_status", description: "Active background task status", category: "widget" },
        { name: "Package Management State", url: "/node/data/pmc", description: "Installed package states and lock status", category: "widget" },
        { name: "SSH Output Log", url: "/db/output.log", description: "Incremental output log (supports ?offset=N&length=N)", category: "widget" },
        { name: "Service Control", url: "/node/v2/service_control", description: "Installed service rows and boot state", category: "service" },
        { name: "All Service Statuses", url: "/node/v2/service_status_all", description: "Running state and health for installed services", category: "service" },
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
