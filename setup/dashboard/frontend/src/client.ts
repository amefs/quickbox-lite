// SPDX-License-Identifier: GPL-3.0-or-later

import type { DashboardRuntimeConfig } from "@quickbox-dashboard/shared";
import { $, io, bootbox, AnsiUp, PerfectScrollbar, Visibility } from "./vendor/index.js";
import { initializeQuickUi } from "./runtime/quick.js";
import { initializeDashboardRuntime } from "./runtime/dashboard.js";

declare global {
    interface Window {
        quickboxRuntime?: DashboardRuntimeConfig;
    }
}

export function getDashboardRuntime() {
    return window.quickboxRuntime;
}

initializeQuickUi($);
initializeDashboardRuntime({
    $,
    io,
    bootbox,
    AnsiUp,
    PerfectScrollbar,
    Visibility,
});
