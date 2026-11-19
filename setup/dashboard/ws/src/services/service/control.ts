// SPDX-License-Identifier: GPL-3.0-or-later

import type { ServiceRow } from "../../shared/service-control-contract";
import { getInstalledPackagesWithServices, isServiceEnabled } from "../packages/panels";

export function getServiceControlRows(): ServiceRow[] {
    return getInstalledPackagesWithServices().flatMap((pkg) =>
        Object.entries(pkg.services ?? {}).map(([id, info]) => ({
            id,
            name: info.name,
            enabledAtBoot: isServiceEnabled(id, info.username),
            ...(info.tooltips === undefined ? {} : { tooltip: info.tooltips }),
            ...(info.tooltipsicon === undefined ? {} : { tooltipIcon: info.tooltipsicon }),
        })),
    );
}
