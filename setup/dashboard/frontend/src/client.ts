// SPDX-License-Identifier: GPL-3.0-or-later

import type { DashboardRuntimeConfig } from "@quickbox-dashboard/shared";

declare global {
    interface Window {
        quickboxRuntime?: DashboardRuntimeConfig;
    }
}

export function getDashboardRuntime() {
    return window.quickboxRuntime;
}

