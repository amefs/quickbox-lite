// SPDX-License-Identifier: GPL-3.0-or-later

import { theme as antdTheme, type ThemeConfig } from "antd";

export type DashboardTheme = "defaulted" | "smoked";

export function isDashboardTheme(value: unknown): value is DashboardTheme {
    return value === "defaulted" || value === "smoked";
}

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
