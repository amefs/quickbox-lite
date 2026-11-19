// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "fs";
import path from "path";

interface DashboardClientManifest {
    version?: number;
    dashboardClient?: unknown;
}

export function resolveDashboardClientBundle(dashboardDir: string): string | undefined {
    const manifestPath = path.join(dashboardDir, "js", "client", "dashboard-client-manifest.json");
    if (!existsSync(manifestPath)) {
        return undefined;
    }
    try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as DashboardClientManifest;
        const assetPath = manifest.dashboardClient;
        if (manifest.version !== 1 || typeof assetPath !== "string" ||
            !/^\/js\/client\/dashboard-client\.[A-Za-z0-9_-]{8}\.js$/.test(assetPath)) {
            return undefined;
        }
        const assetFile = path.join(dashboardDir, "js", assetPath.slice("/js/".length));
        return existsSync(assetFile) ? assetPath : undefined;
    } catch {
        return undefined;
    }
}
