// SPDX-License-Identifier: GPL-3.0-or-later

import { useSyncExternalStore } from "react";

import { isDashboardTheme, type DashboardTheme } from "../shared/theme";

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
    currentTheme = nextTheme;
    if (typeof document !== "undefined") {
        document.body.setAttribute("data-theme", nextTheme);
        const themeLink = document.querySelector('link[href*="/css/dashboard-theme-"]');
        if (themeLink instanceof HTMLLinkElement) {
            themeLink.href = `/css/dashboard-theme-${nextTheme}.css`;
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
    listeners.forEach((listener) => { listener(); });
}
