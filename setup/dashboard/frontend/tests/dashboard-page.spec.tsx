// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import React from "react";
import ReactDOMServer from "react-dom/server";
import type { DashboardPageData } from "@quickbox-dashboard/shared";

import { DashboardPage } from "../src/dashboard-page.js";

function pageData(overrides: Partial<DashboardPageData> = {}): DashboardPageData {
    const base: DashboardPageData = {
        config: {
            username: "quickbox",
            version: "v0.0.0",
            branch: "master",
            showDeveloper: false,
            languages: [],
            themes: [
                { file: "defaulted", title: "Defaulted" },
                { file: "smoked", title: "Smoked" },
            ],
            bwPages: [],
        },
        labels: {
            AGREE: "Agree",
            APP_INSTALL_TXT: "Install an app",
            APP_UNINSTALL_TXT: "Remove an app",
            APP_UPGRADE_TXT: "Update an app",
            BANDWIDTH_DATA: "Bandwidth Data",
            BW_SELECT: "Bandwidth",
            CANCEL: "Cancel",
            CHANGEINTERFACE_TXT: "Change interface",
            CLEAN_LOG_TXT: "Clean log",
            CLEAN_MEM_TXT: "Clean memory",
            CLOSE_REFRESH: "Close and refresh",
            CPU_STATUS: "CPU Status",
            CURRENT_VERSIONS_CHANGELOG: "Changelog",
            DISKTEST_TXT: "Disk test",
            DOWNLOAD: "Download",
            DOWNLOADS: "Downloads",
            ESSENTIAL_USER_COMMANDS: "Essential User Commands",
            FIX_DPKG_TXT: "Fix dpkg",
            HELP_COMMANDS: "Help Commands",
            ISSUE_REPORT_TXT: "Report issue",
            LANG_SELECT: "Select Language",
            MAIN_MENU: "Main Menu",
            NETWORK: "Network",
            PANEL_CONFIG: "Panel Config",
            PANEL_RESET: "Panel Reset",
            QUICK_SYSTEM_TIPS: "Quick System Tips",
            RECENT_UPDATES: "Recent Updates",
            RPLUGIN_MENU: "ruTorrent Plugin Menu",
            SCREEN_RTORRNENT_TXT: "Restart rtorrent",
            SEEDBOX_COMMANDS: "Seedbox Commands",
            SERVER_LOAD: "Server Load",
            SET_LANG_TXT: "Set language",
            SL_TXT: "Server load text",
            SWITCH_DEV: "Switch to dev",
            SWITCH_MASTER: "Switch to master",
            SYSTEM_RAM_STATUS: "System RAM Status",
            SYSTEM_RESPONSE_TITLE: "System Response",
            THEME_CHANGE_TXT: "Theme change warning",
            THEME_SELECT: "Select Theme",
            TROUBLESHOOT_TXT: "Troubleshoot",
            UPDATE: "Update",
            UPLOAD: "Upload",
            UPTIME: "Uptime",
            VIEW_ADDITIONAL_BANDWIDTH_DETAILS: "View Additional Bandwidth Details",
            WEB_CONSOLE: "Web Console",
            YOUR_DISK_STATUS: "Disk Status",
        },
        menuState: {
            installedMenuEntries: [
                { name: "ruTorrent", url: "/rutorrent/", logo: "img/brands/rtorrent.png" },
            ],
            installedDownloadEntries: [
                { name: "rTorrent", url: "/$username$.rtorrent.downloads" },
            ],
            showPluginTab: true,
            showWebConsole: true,
        },
        runtimeConfig: {
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
                    load: "/node/load",
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
                enabled: "Enabled",
                disabled: "Disabled",
                refresh: "Refresh",
            },
        },
        ssrFragments: {
            packageManagementCenterHtml: "<div data-test-fragment=\"pmc\">Packages</div>",
            serviceControlHtml: "<div data-test-fragment=\"service-control\">Services</div>",
            removalModalsHtml: "<div id=\"rutorrentRemovalConfirm\" data-click-handler=\"packageRemove\"></div>",
            uptimeHtml: "1 day",
            diskDataHtml: "",
            ramStatsHtml: "",
            loadHtml: "",
            cpuStaticHtml: "",
            networkInterfaces: [],
        },
    };

    return {
        ...base,
        ...overrides,
        labels: { ...base.labels, ...overrides.labels },
        config: { ...base.config, ...overrides.config },
        menuState: { ...base.menuState, ...overrides.menuState },
        runtimeConfig: { ...base.runtimeConfig, ...overrides.runtimeConfig },
        ssrFragments: { ...base.ssrFragments, ...overrides.ssrFragments },
    };
}

function render(data = pageData()) {
    return ReactDOMServer.renderToStaticMarkup(<DashboardPage pageData={data} />);
}

describe("DashboardPage", () => {
    it("renders the dashboard shell and runtime config from page data", () => {
        const html = render();

        expect(html).to.include("<title>Quickbox Dashboard</title>");
        expect(html).to.include("<html lang=\"en\">");
        expect(html).to.include("window.quickboxRuntime");
        expect(html).to.include("\"basePath\":\"/ws\"");
        expect(html).to.include("\"path\":\"/ws/socket.io\"");
    });

    it("keeps legacy static references and script order stable", () => {
        const html = render();
        const scripts = [
            "/lib/jquery/jquery.min.js",
            "/lib/jquery-ui/jquery-ui.min.js",
            "/lib/jquery-ui-touch-punch/jquery.ui.touch-punch.min.js",
            "/lib/bootstrap/js/bootstrap.min.js",
            "/lib/perfect-scrollbar/js/perfect-scrollbar.min.js",
            "/lib/visibility/visibility.fallback.js",
            "/lib/visibility/visibility.core.js",
            "/lib/visibility/visibility.timers.js",
            "/lib/socket.io/socket.io.min.js",
            "/lib/ansi_up/ansi_up.min.js",
            "/js/quick.js",
            "/js/dashboard.js",
        ];

        expect(html).to.include("href=\"/skins/quick.css\"");
        expect(html).to.include("href=\"/lib/jquery-ui/jquery-ui.min.css\"");
        expect(html).to.include("src=\"/img/logo-light.png\"");

        const indexes = scripts.map((src) => html.indexOf(src));
        expect(indexes.every((index) => index >= 0)).to.equal(true);
        expect([...indexes].sort((a, b) => a - b)).to.deep.equal(indexes);
    });

    it("preserves widget containers, backend fragments, menus, and theme modals", () => {
        const html = render();

        expect(html).to.include("id=\"service_control_widget\"");
        expect(html).to.include("data-test-fragment=\"service-control\"");
        expect(html).to.include("id=\"pmc_widget\"");
        expect(html).to.include("data-test-fragment=\"pmc\"");
        expect(html).to.include("id=\"rutorrentRemovalConfirm\"");
        expect(html).to.include("href=\"/quickbox.rtorrent.downloads\"");
        expect(html).to.include("href=\"/quickbox.console\"");
        expect(html).to.include("id=\"themeSelectdefaultedGo\"");
        expect(html).to.include("id=\"themeSelectsmokedGo\"");
    });
});
