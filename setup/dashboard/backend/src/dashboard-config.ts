// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "fs";
import { execFile } from "child_process";
import path from "path";
import type {
    DashboardBandwidthPageOption,
    DashboardConfigResponse,
    DashboardLanguageOption,
    DashboardThemeName,
    DashboardThemeOption,
} from "@quickbox-dashboard/shared";

import { username } from "./shared/constants";
import i18n from "./i18n";

export type DashboardLanguage = DashboardLanguageOption;

export type DashboardTheme = DashboardThemeOption;

export type DashboardBandwidthPage = DashboardBandwidthPageOption;

export const dashboardLanguages: DashboardLanguage[] = [
    { file: "lang_zh", key: "zh", title: "Chinese", locale: "zh_CN.UTF-8" },
    { file: "lang_da", key: "da", title: "Danish", locale: "da_DK.UTF-8" },
    { file: "lang_en", key: "en", title: "English", locale: "en_US.UTF-8" },
    { file: "lang_fr", key: "fr", title: "French", locale: "fr_FR.UTF-8" },
    { file: "lang_de", key: "de", title: "German", locale: "de_DE.UTF-8" },
    { file: "lang_es", key: "es", title: "Spanish", locale: "es_ES.UTF-8" },
];

export const dashboardThemes: DashboardTheme[] = [
    { file: "defaulted", title: "Defaulted" },
    { file: "smoked", title: "Smoked" },
];

export function isDashboardTheme(theme: unknown): theme is DashboardThemeName {
    return typeof theme === "string" && dashboardThemes.some((entry) => entry.file === theme);
}

export function applyDashboardTheme(theme: DashboardThemeName) {
    return applyDashboardThemeWithExecFile(theme);
}

export function applyDashboardThemeWithExecFile(theme: DashboardThemeName, runExecFile: typeof execFile = execFile) {
    if (!isDashboardTheme(theme)) {
        return Promise.reject(new Error("Invalid theme"));
    }
    return new Promise<void>((resolve, reject) => {
        runExecFile("sudo", [`/usr/local/bin/quickbox/system/theme/themeSelect-${theme}`], (error) => {
            if (error) {
                reject(new Error(error.message));
                return;
            }
            resolve();
        });
    });
}

export const dashboardBandwidthPages: DashboardBandwidthPage[] = [
    { key: "t", title: "Top 10 days" },
    { key: "h", title: "Recent hours" },
    { key: "d", title: "Last 30 days" },
    { key: "m", title: "Last 12 months" },
];

export function getDashboardBranch() {
    if (!existsSync("/install/.developer.lock")) {
        return "master";
    }
    if (existsSync("/install/.debug.lock")) {
        try {
            const branch = readFileSync("/install/.debug.lock", "utf8").split("\n")[0]?.trim();
            if (branch) {
                return branch;
            }
        } catch {
            return "development";
        }
    }
    return "development";
}

export function dashboardConfig(): DashboardConfigResponse {
    const version = getDashboardVersion();

    return {
        username,
        version,
        branch: getDashboardBranch(),
        showDeveloper: existsSync("/install/.developer.lock"),
        languages: dashboardLanguages,
        themes: dashboardThemes,
        bwPages: dashboardBandwidthPages.map((page) => ({ ...page, title: i18n.t(page.title) })),
    };
}

function getDashboardVersion() {
    const packageJsonPath = path.resolve(__dirname, "..", "package.json");
    try {
        const content = readFileSync(packageJsonPath, "utf8");
        const parsed = JSON.parse(content) as { version?: string };
        if (typeof parsed.version === "string" && parsed.version.trim() !== "") {
            return `v${parsed.version.trim()}`;
        }
    } catch {
        // Ignore parse/read errors and fall back to the last known version.
    }

    return "v0.0.0";
}
