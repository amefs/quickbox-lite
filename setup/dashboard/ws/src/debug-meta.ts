// SPDX-License-Identifier: GPL-3.0-or-later

import { packageList, serviceMap } from "./info";
import type { DebugEndpointItem, DebugMetaPayload, DebugPackageItem } from "./shared/bootstrap-contract";
import type { DashboardTheme } from "./shared/theme";

export function getDebugEndpoints(): DebugEndpointItem[] {
    const endpoints: DebugEndpointItem[] = [
        { name: "System Load", url: "/node/load", description: "CPU load averages and process count", category: "widget" },
        { name: "Network Status", url: "/node/net_status", description: "Network interface RX/TX bytes", category: "widget" },
        { name: "Uptime", url: "/node/up", description: "System uptime display", category: "widget" },
        { name: "Disk Data", url: "/node/disk_data", description: "Disk usage and torrent info", category: "widget" },
        { name: "RAM Stats", url: "/node/ram_stats", description: "Memory usage statistics", category: "widget" },
        { name: "Bandwidth - Hourly", url: "/node/bw_tables?page=h", description: "Bandwidth tables (hourly)", category: "widget" },
        { name: "Bandwidth - Daily", url: "/node/bw_tables?page=d", description: "Bandwidth tables (daily)", category: "widget" },
        { name: "Bandwidth - Monthly", url: "/node/bw_tables?page=m", description: "Bandwidth tables (monthly)", category: "widget" },
        { name: "Bandwidth - Top 10", url: "/node/bw_tables?page=t", description: "Bandwidth tables (top 10 days)", category: "widget" },
        { name: "SSH Output Log", url: "/db/output.log", description: "Incremental output log (supports ?offset=N&length=N)", category: "widget" },
    ];

    for (const [key] of serviceMap) {
        endpoints.push({
            name: `Service: ${key}`,
            url: `/node/service_status?service=${key}`,
            description: `Status badge for ${key}`,
            category: "service",
        });
    }

    return endpoints;
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
