// SPDX-License-Identifier: GPL-3.0-or-later

import type { ServiceStatusAllData } from "../../shared/service-control-contract";
import { getInstalledPackagesWithServices } from "../packages/panels";
import { getServiceHealth } from "./state";

export async function serviceStatusAllData(): Promise<ServiceStatusAllData> {
    const { snapshot, health, retryAfterMs } = await getServiceHealth();
    const installedServiceIds = new Set(
        getInstalledPackagesWithServices().flatMap((pkg) => Object.keys(pkg.services ?? {})),
    );
    const states = Object.fromEntries(
        Object.entries(snapshot).filter(([service]) => installedServiceIds.has(service)),
    );
    return { states, health, retryAfterMs };
}
