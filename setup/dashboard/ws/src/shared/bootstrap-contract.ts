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
    languages: { file: string; key: string; title: string }[];
    themes: { file: string; title: string }[];
    bwPages: { key: "t" | "h" | "d" | "m"; title: string }[];
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
    locale: string;
    config: DashboardChromeConfig;
    menuState: DashboardChromeMenuState;
}

export interface DashboardBootstrapPayload {
    basePath: string;
    locale: string;
    locales: readonly string[];
    serviceKeys: string[];
    socketUpgrade: boolean;
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
    endpoints: DebugEndpointItem[];
    packages: DebugPackageItem[];
}
