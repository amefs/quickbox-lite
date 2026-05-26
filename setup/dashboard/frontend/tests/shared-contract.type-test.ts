// SPDX-License-Identifier: GPL-3.0-or-later

import type {
    DashboardPageData,
    DashboardRuntimeConfig,
    DashboardShellLabels,
} from "@quickbox-dashboard/shared";

const labels: DashboardShellLabels = {
    ENABLED: "Enabled",
    DISABLED: "Disabled",
    REFRESH: "Refresh",
};

const runtimeConfig: DashboardRuntimeConfig = {
    basePath: "/ws",
    locale: "en",
    endpoints: {
        dashboardConfig: "/node/dashboard_config",
        systemStatic: "/node/system_static",
        theme: "/node/theme",
        plugins: "/node/plugins",
        plugin: "/node/plugin",
        outputLog: "/db/output.log",
        widgets: {
            menu: "/node/menu",
        },
    },
    socket: {
        path: "/ws/socket.io",
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
        enabled: labels.ENABLED,
        disabled: labels.DISABLED,
        refresh: labels.REFRESH,
    },
};

export const frontendSharedContractFixture: DashboardPageData = {
    config: {
        username: "quickbox",
        version: "v0.0.0",
        branch: "master",
        showDeveloper: false,
        languages: [],
        themes: [],
        bwPages: [],
    },
    labels,
    menuState: {
        installedMenuEntries: [],
        installedDownloadEntries: [],
        showPluginTab: false,
        showWebConsole: false,
    },
    runtimeConfig,
    ssrFragments: {
        packageManagementCenterHtml: "",
        serviceControlHtml: "",
        removalModalsHtml: "",
        uptimeHtml: "",
        diskDataHtml: "",
        ramStatsHtml: "",
        loadHtml: "",
        cpuStaticHtml: "",
        networkInterfaces: [],
    },
};
