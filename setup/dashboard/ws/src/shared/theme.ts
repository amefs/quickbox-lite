// SPDX-License-Identifier: GPL-3.0-or-later

export type DashboardTheme = "defaulted" | "smoked";

export function isDashboardTheme(value: unknown): value is DashboardTheme {
    return value === "defaulted" || value === "smoked";
}
