// SPDX-License-Identifier: GPL-3.0-or-later

export const PACKAGE_MANAGEMENT_DATA_URL = "/node/data/pmc" as const;

export type PackageManagementTheme = "defaulted" | "smoked";

export interface PackageManagementRow {
    package: string;
    name: string;
    descriptionHtml: string;
    descriptionText: string;
    installTooltip: string;
    uninstallHtml?: string;
    installed: boolean;
    boxOnly: boolean;
}

export interface PackageManagementLabels {
    title: string;
    name: string;
    details: string;
    availability: string;
    installed: string;
    install: string;
    box: string;
    noticeHtml: string;
    clearLockHtml: string;
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
    labels: PackageManagementLabels;
    theme: PackageManagementTheme;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

function isPackageRow(value: unknown): value is PackageManagementRow {
    return isRecord(value) && typeof value.package === "string" && value.package.length > 0 &&
        typeof value.name === "string" && typeof value.descriptionHtml === "string" &&
        typeof value.descriptionText === "string" && typeof value.installTooltip === "string" &&
        (value.uninstallHtml === undefined || typeof value.uninstallHtml === "string") &&
        typeof value.installed === "boolean" && typeof value.boxOnly === "boolean";
}

export function isPackageManagementData(value: unknown): value is PackageManagementData {
    return isRecord(value) && Array.isArray(value.rows) && value.rows.every(isPackageRow) &&
        typeof value.installLockExists === "boolean";
}
