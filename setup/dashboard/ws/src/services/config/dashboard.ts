// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "fs";
import { execFile } from "child_process";
import path from "path";

import { username } from "../../shared/constants";

export interface DashboardLanguage {
    file: string;
    key: string;
    locale: string;
}

export interface DashboardTheme {
    file: string;
}

export interface DashboardBandwidthPage {
    key: "t" | "h" | "d" | "m";
}

export const dashboardLanguages: DashboardLanguage[] = [
    { file: "lang_zh", key: "zh", locale: "zh_CN.UTF-8" },
    { file: "lang_da", key: "da", locale: "da_DK.UTF-8" },
    { file: "lang_en", key: "en", locale: "en_US.UTF-8" },
    { file: "lang_fr", key: "fr", locale: "fr_FR.UTF-8" },
    { file: "lang_de", key: "de", locale: "de_DE.UTF-8" },
    { file: "lang_es", key: "es", locale: "es_ES.UTF-8" },
];

export const dashboardThemes: DashboardTheme[] = [
    { file: "defaulted" },
    { file: "smoked" },
];

export function isDashboardTheme(theme: unknown): theme is string {
    return typeof theme === "string" && dashboardThemes.some((entry) => entry.file === theme);
}

export function applyDashboardTheme(theme: unknown) {
    return applyDashboardThemeWithExecFile(theme);
}

export function applyDashboardThemeWithExecFile(theme: unknown, runExecFile: typeof execFile = execFile) {
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
    { key: "t" },
    { key: "h" },
    { key: "d" },
    { key: "m" },
];

export function getDashboardBranch() {
    try {
        const branch = readFileSync("/install/.quickbox-branch", "utf8").split("\n")[0]?.trim();
        if (branch) { return branch; }
    } catch { /* Older installations use lock files. */ }
    if (existsSync("/install/.legacy.lock")) { return "legacy"; }
    if (!existsSync("/install/.developer.lock")) {
        return "master";
    }
    if (existsSync("/install/.debug.lock")) {
        try {
            const branch = readFileSync("/install/.debug.lock", "utf8").split("\n")[0]?.trim();
            if (branch) {
                return branch.replace(/\([0-9a-f]+\)$/, "");
            }
        } catch {
            return "development";
        }
    }
    return "development";
}

function getDashboardCommit(): string | undefined {
    try {
        return readFileSync("/install/.quickbox-branch", "utf8").split("\n")[1]?.trim() || undefined;
    } catch {
        return undefined;
    }
}

export function dashboardAccountLabel(account: string, devServer: boolean, devLabel: string): string {
    return account || (devServer ? devLabel : "");
}

export function dashboardConfig() {
    const version = getDashboardVersion();
    const ssoLogoutUrl = getSsoLogoutUrl();
    const hasVouchProxy = existsSync("/install/.vouchproxy.lock");
    const hasAuthelia = existsSync("/install/.authelia.lock");

    return {
        username,
        version,
        branch: getDashboardBranch(),
        branchCommit: getDashboardCommit(),
        showDeveloper: existsSync("/install/.developer.lock"),
        hasVouchProxy,
        hasAuthelia,
        hasExternalAuth: hasVouchProxy || hasAuthelia,
        ssoLogoutUrl,
        languages: dashboardLanguages,
        themes: dashboardThemes,
        bwPages: dashboardBandwidthPages,
    };
}

function getSsoLogoutUrl() {
    if (existsSync("/install/.authelia.lock")) {
        return "/";
    }

    const vouchConfigPath = "/opt/vouch-proxy/config.yml";
    if (!existsSync(vouchConfigPath)) {
        return "/";
    }

    try {
        const content = readFileSync(vouchConfigPath, "utf8");
        const match = content.match(/^\s*end_session_endpoint:\s*['"]?([^'"\n]+)['"]?\s*$/m);
        return match?.[1]?.trim() || "/";
    } catch {
        return "/";
    }
}

function getDashboardVersion() {
    const packageJsonPath = [
        path.resolve(__dirname, "..", "package.json"),
        path.resolve(__dirname, "..", "..", "..", "package.json"),
    ].find((candidate) => existsSync(candidate));
    if (!packageJsonPath) {
        return "v0.0.0";
    }
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
