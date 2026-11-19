// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";
import { existsSync } from "fs";
import path from "path";

import { isDashboardTheme, type DashboardTheme } from "../shared/theme";

export const parseQueryNumber = (value: unknown): number | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
};

export const readDashboardTheme = (dashboardDir: string, req?: Request): DashboardTheme => {
    const cookieHeader = req?.headers.cookie;
    if (typeof cookieHeader === "string") {
        const match = /(?:^|;\s*)quickbox_theme=(smoked|defaulted)(?:;|$)/.exec(cookieHeader);
        if (isDashboardTheme(match?.[1])) {
            return match[1];
        }
    }
    return existsSync(path.join(dashboardDir, "db", ".smoked.lock")) ? "smoked" : "defaulted";
};

export const serveDashboardIndex = (webIndexHtmlPath: string) => (_req: Request, res: Response) => {
    if (!existsSync(webIndexHtmlPath)) {
        res.status(503).type("text/plain").send("Dashboard web bundle is unavailable");
        return;
    }
    res.sendFile(webIndexHtmlPath);
};
