// SPDX-License-Identifier: GPL-3.0-or-later

import { getInstalledPackagesWithServices } from "../packages/panels";
import { getServiceHealth } from "./state";

export async function serviceStatusAllData() {
    const { snapshot, health, retryAfterMs } = await getServiceHealth();
    const installedServiceIds = new Set(
        getInstalledPackagesWithServices().flatMap((pkg) => Object.keys(pkg.services ?? {})),
    );
    const states = Object.fromEntries(
        Object.entries(snapshot).filter(([service]) => installedServiceIds.has(service)),
    );
    return { states, health, retryAfterMs };
}
