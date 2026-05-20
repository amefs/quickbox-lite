// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "fs";
import { execFile } from "child_process";

import { username } from "./shared/constants";

export interface DashboardLanguage {
    file: string;
    key: string;
    title: string;
    locale: string;
}

export interface DashboardTheme {
    file: string;
    title: string;
}

export interface DashboardBandwidthPage {
    key: "t" | "h" | "d" | "m";
    title: string;
}

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

export function isDashboardTheme(theme: unknown): theme is string {
    return typeof theme === "string" && dashboardThemes.some((entry) => entry.file === theme);
}

export function applyDashboardTheme(theme: string) {
    return applyDashboardThemeWithExecFile(theme);
}

export function applyDashboardThemeWithExecFile(theme: string, runExecFile: typeof execFile = execFile) {
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

export function dashboardConfig() {
    return {
        username,
        version: "v1.5.12",
        branch: getDashboardBranch(),
        showDeveloper: existsSync("/install/.developer.lock"),
        languages: dashboardLanguages,
        themes: dashboardThemes,
        bwPages: dashboardBandwidthPages,
    };
}
