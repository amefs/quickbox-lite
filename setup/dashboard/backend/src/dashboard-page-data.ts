// SPDX-License-Identifier: GPL-3.0-or-later

import type {
    DashboardBasePath,
    DashboardPageData,
    DashboardRuntimeConfig,
    DashboardShellLabels,
    DashboardSocketPath,
} from "@quickbox-dashboard/shared";

import { dashboardConfig } from "./dashboard-config";
import i18n from "./i18n";
import { resolveDashboardMenuState } from "./widgets/menu";
import { packageManagementCenter } from "./widgets/package-management-center";
import { removalModals } from "./widgets/removal-modals";
import { serviceControl } from "./widgets/service-control";
import { upTime } from "./widgets/up";

const shellLabelKeys = [
    "AGREE",
    "APP_INSTALL_TXT",
    "APP_UNINSTALL_TXT",
    "APP_UPGRADE_TXT",
    "BANDWIDTH_DATA",
    "BW_SELECT",
    "CANCEL",
    "CHANGEINTERFACE_TXT",
    "CLEAN_LOG_TXT",
    "CLEAN_MEM_TXT",
    "CLOSE_REFRESH",
    "CPU_STATUS",
    "CURRENT_VERSIONS_CHANGELOG",
    "DISKTEST_TXT",
    "DOWNLOAD",
    "DOWNLOADS",
    "ENABLED",
    "DISABLED",
    "ESSENTIAL_USER_COMMANDS",
    "FIX_DPKG_TXT",
    "HELP_COMMANDS",
    "ISSUE_REPORT_TXT",
    "LANG_SELECT",
    "MAIN_MENU",
    "NETWORK",
    "PANEL_CONFIG",
    "PANEL_RESET",
    "QUICK_SYSTEM_TIPS",
    "RECENT_UPDATES",
    "REFRESH",
    "RPLUGIN_MENU",
    "SCREEN_RTORRNENT_TXT",
    "SEEDBOX_COMMANDS",
    "SERVER_LOAD",
    "SET_LANG_TXT",
    "SL_TXT",
    "SWITCH_DEV",
    "SWITCH_MASTER",
    "SYSTEM_RAM_STATUS",
    "SYSTEM_RESPONSE_TITLE",
    "THEME_CHANGE_TXT",
    "THEME_SELECT",
    "TROUBLESHOOT_TXT",
    "UPDATE",
    "UPLOAD",
    "UPTIME",
    "VIEW_ADDITIONAL_BANDWIDTH_DETAILS",
    "WEB_CONSOLE",
    "YOUR_DISK_STATUS",
] as const;

function normalizeBasePath(basePath: string | undefined): DashboardBasePath {
    return basePath === "/ws" ? "/ws" : "";
}

function runtimeConfig(basePath: DashboardBasePath, locale: string): DashboardRuntimeConfig {
    const socketPath: DashboardSocketPath = basePath === "/ws" ? "/ws/socket.io" : "/socket.io";

    return {
        basePath,
        locale,
        endpoints: {
            dashboardConfig: "/node/dashboard_config",
            systemStatic: "/node/system_static",
            theme: "/node/theme",
            plugins: "/node/plugins",
            plugin: "/node/plugin",
            outputLog: "/db/output.log",
            widgets: {
                bandwidthTables: "/node/bw_tables",
                diskData: "/node/disk_data",
                load: "/node/load",
                memoryStats: "/node/ram_stats",
                menu: "/node/menu",
                removalModals: "/node/removal_modals",
            },
        },
        socket: {
            path: socketPath,
        },
        assets: {
            skins: "/skins",
            lib: "/lib",
            fonts: "/fonts",
            img: "/img",
            js: "/js",
            lang: "/lang",
        },
        messages: {
            enabled: i18n.t("ENABLED"),
            disabled: i18n.t("DISABLED"),
            refresh: i18n.t("REFRESH"),
        },
    };
}

function dashboardShellLabels(): DashboardShellLabels {
    return Object.fromEntries(
        shellLabelKeys.map((key) => [key, i18n.t(key)]),
    );
}

export async function createDashboardPageData(locale: string, basePath?: string): Promise<DashboardPageData> {
    const [menuState, serviceControlHtml, packageManagementCenterHtml, removalModalsHtml] = await Promise.all([
        resolveDashboardMenuState(),
        serviceControl(),
        packageManagementCenter(),
        removalModals(),
    ]);

    return {
        config: dashboardConfig(),
        labels: dashboardShellLabels(),
        menuState,
        runtimeConfig: runtimeConfig(normalizeBasePath(basePath), locale),
        ssrFragments: {
            packageManagementCenterHtml,
            serviceControlHtml,
            removalModalsHtml,
            uptimeHtml: upTime(),
            diskDataHtml: "",
            ramStatsHtml: "",
            loadHtml: "",
            cpuStaticHtml: "",
            networkInterfaces: [],
        },
    };
}
