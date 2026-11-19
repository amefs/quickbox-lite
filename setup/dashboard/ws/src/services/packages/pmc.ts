// SPDX-License-Identifier: GPL-3.0-or-later

import { getVisiblePackages, isPackageInstalled } from "./panels";
import type {
    PackageManagementData,
    PackageManagementStateData,
} from "../../shared/package-management-contract";

export function getPackageManagementData(): PackageManagementData {
    return {
        rows: getVisiblePackages().map((pkg) => {
            const packageName = pkg.package.toLowerCase();
            return {
                package: packageName,
                name: pkg.name,
                ...(pkg.description ? { descriptionKey: pkg.description } : {}),
                ...(pkg.install ? { installTooltipKey: pkg.install } : {}),
                ...(pkg.uninstall ? { uninstallKey: pkg.uninstall } : {}),
                installed: isPackageInstalled(pkg),
                boxOnly: pkg.boxonly === true,
            };
        }),
        installLockExists: isPackageInstalled({ lockfile: "/install/.install.lock" }),
    };
}

export function getPackageManagementStateData(): PackageManagementStateData {
    const installedByPackage: Record<string, boolean> = {};
    for (const pkg of getVisiblePackages()) {
        installedByPackage[pkg.package.toLowerCase()] = isPackageInstalled(pkg);
    }
    return {
        installedByPackage,
        installLockExists: isPackageInstalled({ lockfile: "/install/.install.lock" }),
    };
}
