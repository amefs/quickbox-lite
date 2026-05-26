// SPDX-License-Identifier: GPL-3.0-or-later

import type {
    DashboardConfigResponse,
    DashboardPageData,
    DashboardSocketResponse,
    ThemeRequest,
} from "@quickbox-dashboard/shared";

const configResponse: DashboardConfigResponse = {
    username: "quickbox",
    version: "v0.0.0",
    branch: "master",
    showDeveloper: false,
    languages: [],
    themes: [{ file: "defaulted", title: "Defaulted" }],
    bwPages: [{ key: "t", title: "Top 10 days" }],
};

export const backendSharedThemeRequest: ThemeRequest = {
    theme: "defaulted",
};

export const backendSharedSocketResponse: DashboardSocketResponse = {
    key: "load",
    url: "/node/load",
    pathName: "/node/load",
    success: true,
    message: "",
    response: "",
};

export const backendSharedPageDataFixture: Pick<DashboardPageData, "config" | "menuState"> = {
    config: configResponse,
    menuState: {
        installedMenuEntries: [],
        installedDownloadEntries: [],
        showPluginTab: false,
        showWebConsole: false,
    },
};
