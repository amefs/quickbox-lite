// SPDX-License-Identifier: GPL-3.0-or-later

import { useSyncExternalStore } from "react";
import { theme as antdTheme, type ThemeConfig } from "antd";

import { isDashboardTheme, type DashboardTheme } from "../../../ws/src/shared/theme";

export function getAntdThemeConfig(currentTheme: DashboardTheme, overrides?: Partial<ThemeConfig["token"]>): ThemeConfig {
    return {
        algorithm: currentTheme === "smoked" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
            colorPrimary: currentTheme === "smoked" ? "#2574ab" : "#337ab7",
            fontFamily: '"Open Sans", sans-serif',
            borderRadius: 3,
            ...overrides,
        },
    };
}

const listeners = new Set<() => void>();

function readInitialTheme(): DashboardTheme {
    if (typeof document === "undefined") {
        return "defaulted";
    }
    const bodyTheme = document.body.getAttribute("data-theme");
    if (isDashboardTheme(bodyTheme)) {
        return bodyTheme;
    }
    try {
        const stored = localStorage.getItem("quickbox:theme");
        if (isDashboardTheme(stored)) {
            return stored;
        }
    } catch { /* Ignore storage errors in restricted environments. */ }
    return "defaulted";
}

let currentTheme: DashboardTheme = readInitialTheme();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getDashboardThemeSnapshot(): DashboardTheme {
    return currentTheme;
}

export function useDashboardTheme(fallback: DashboardTheme = "defaulted"): DashboardTheme {
    return useSyncExternalStore(subscribe, getDashboardThemeSnapshot, () => fallback);
}

export function applyFrontendTheme(nextTheme: DashboardTheme) {
    const changed = currentTheme !== nextTheme;
    currentTheme = nextTheme;
    if (typeof document !== "undefined") {
        if (document.body.getAttribute("data-theme") !== nextTheme) {
            document.body.setAttribute("data-theme", nextTheme);
        }
        let cookie = `quickbox_theme=${encodeURIComponent(nextTheme)}; Path=/; SameSite=Lax`;
        if (window.location.protocol === "https:") {
            cookie += "; Secure";
        }
        document.cookie = cookie;
    }
    try {
        localStorage.setItem("quickbox:theme", nextTheme);
    } catch { /* Ignore storage errors in restricted environments. */ }
    if (changed) {
        listeners.forEach((listener) => { listener(); });
    }
}
