// SPDX-License-Identifier: GPL-3.0-or-later

import { PACKAGE_MANAGEMENT_DATA_URL } from "./widget-streams";

export { PACKAGE_MANAGEMENT_DATA_URL };

export type PackageManagementTheme = "defaulted" | "smoked";

export interface PackageManagementRow {
    package: string;
    name: string;
    descriptionText?: string;
    installTooltip?: string;
    descriptionKey?: string;
    installTooltipKey?: string;
    uninstallKey?: string;
    installed: boolean;
    boxOnly: boolean;
}

export interface PackageManagementStateData {
    installedByPackage: Record<string, boolean>;
    installLockExists: boolean;
}

export interface PackageManagementLabels {
    title: string;
    name: string;
    details: string;
    availability: string;
    installed: string;
    install: string;
    box: string;
    notice: string;
    clearLockText: string;
    clearLock: string;
    viewLog: string;
    uninstallTitle: string;
    cancel: string;
    agree: string;
    empty: string;
    searchPlaceholder: string;
    total: string;
}

export interface PackageManagementData {
    rows: PackageManagementRow[];
    installLockExists: boolean;
}

export interface PackageManagementBridge {
    onMessage: (value: unknown) => boolean;
}

export interface PackageManagementRuntime {
    data: PackageManagementData;
    theme: PackageManagementTheme;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

function isPackageRow(value: unknown): value is PackageManagementRow {
    return isRecord(value) && typeof value.package === "string" && value.package.length > 0 &&
        typeof value.name === "string" &&
        (value.descriptionText === undefined || typeof value.descriptionText === "string") &&
        (value.installTooltip === undefined || typeof value.installTooltip === "string") &&
        (value.descriptionKey === undefined || typeof value.descriptionKey === "string") &&
        (value.installTooltipKey === undefined || typeof value.installTooltipKey === "string") &&
        (value.uninstallKey === undefined || typeof value.uninstallKey === "string") &&
        typeof value.installed === "boolean" && typeof value.boxOnly === "boolean";
}

export function isPackageManagementData(value: unknown): value is PackageManagementData {
    return isRecord(value) && Array.isArray(value.rows) && value.rows.every(isPackageRow) &&
        typeof value.installLockExists === "boolean";
}

export function isPackageManagementStateData(value: unknown): value is PackageManagementStateData {
    return isRecord(value) && isRecord(value.installedByPackage) &&
        Object.values(value.installedByPackage).every((installed) => typeof installed === "boolean") &&
        typeof value.installLockExists === "boolean";
}
