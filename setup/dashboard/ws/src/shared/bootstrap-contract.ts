// SPDX-License-Identifier: GPL-3.0-or-later

import type { PackageManagementRuntime } from "./package-management-contract";
import type { RunningTaskData } from "./running-task-contract";
import type { ServiceRow } from "./service-control-contract";
import type { SystemSummaryRuntime } from "./system-summary-contract";
import type { DashboardTheme } from "./theme";

export interface DashboardChromeConfig {
    username: string;
    version: string;
    branch: string;
    branchCommit?: string;
    showDeveloper: boolean;
    hasExternalAuth: boolean;
    ssoLogoutUrl: string;
    languages: { file: string; key: string }[];
    themes: { file: string }[];
    bwPages: { key: "t" | "h" | "d" | "m" }[];
}

export interface DashboardChromeMenuEntry {
    name: string;
    url: string;
    logo?: string;
}

export interface DashboardChromeMenuState {
    installedMenuEntries: DashboardChromeMenuEntry[];
    installedDownloadEntries: { name: string; url: string }[];
    showPluginTab: boolean;
    showWebConsole: boolean;
}

export interface DashboardChromeData {
    config: DashboardChromeConfig;
    menuState: DashboardChromeMenuState;
}

export type WsPushMode = "push" | "poll";

export interface DashboardBootstrapPayload {
    basePath: string;
    locales: readonly string[];
    defaultLocale: string | null;
    serviceKeys: string[];
    socketUpgrade: boolean;
    wsPushMode?: WsPushMode;
    serviceTheme: DashboardTheme;
    serviceRows: ServiceRow[];
    systemSummary: SystemSummaryRuntime;
    networkInterfaces: string[];
    networkInterfacesLoaded: boolean;
    runningTask: RunningTaskData;
    packageManagement: PackageManagementRuntime;
    chrome: DashboardChromeData;
}

export interface DebugEndpointItem {
    name: string;
    url: string;
    description: string;
    category: "widget" | "service";
}

export interface DebugPackageItem {
    name: string;
    pkg: string;
}

export interface DebugMetaPayload {
    basePath: string;
    theme: DashboardTheme;
    defaultLocale: string | null;
    endpoints: DebugEndpointItem[];
    packages: DebugPackageItem[];
}
