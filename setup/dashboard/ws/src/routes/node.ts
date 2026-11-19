// SPDX-License-Identifier: GPL-3.0-or-later

import express, { type Request, type Response, type Router } from "express";
import * as childProcess from "child_process";
import path from "path";

import { applyDashboardThemeWithExecFile, dashboardConfig } from "../services/config/dashboard";
import {
    applyRutorrentPluginActionWithExecFile,
    getRutorrentPlugins,
    isPluginAction,
} from "../services/packages/plugins";
import { getPackageManagementStateData } from "../services/packages/pmc";
import { systemStaticInfoWithProviders } from "../services/system/cpu";
import { diskDataData } from "../services/system/disk";
import { systemLoadData } from "../services/system/load";
import { ramStatsData } from "../services/system/memory";
import {
    DISK_DATA_URL,
    PACKAGE_MANAGEMENT_DATA_URL,
    RAM_STATS_DATA_URL,
    SYSTEM_LOAD_DATA_URL,
    SYSTEM_STATIC_DATA_URL,
} from "../shared/widget-streams";
import { isTestMode } from "../testing";

const parseThemeBody = (body: unknown): string | undefined => {
    if (body === null || typeof body !== "object" || !("theme" in body)) {
        return undefined;
    }
    const theme = (body as { theme?: unknown }).theme;
    return typeof theme === "string" ? theme : undefined;
};

const parsePluginBody = (body: unknown): { plugin?: unknown; action?: unknown } => {
    if (body === null || typeof body !== "object") {
        return {};
    }
    const record = body as { plugin?: unknown; action?: unknown };
    return { plugin: record.plugin, action: record.action };
};

export const getDashboardConfig = (_req: Request, res: Response) => {
    res.json(dashboardConfig());
};

export const getSystemStatic = async (_req: Request, res: Response) => {
    res.json(await systemStaticInfoWithProviders());
};

export const applyTheme = (execFile: typeof childProcess.execFile) => async (req: Request, res: Response) => {
    const theme = parseThemeBody(req.body);
    if (theme === undefined) {
        res.status(400).json({ error: "theme field required" });
        return;
    }
    try {
        await applyDashboardThemeWithExecFile(theme, execFile);
        res.json({ ok: true, theme });
    } catch (error) {
        const status = error instanceof Error && error.message === "Invalid theme" ? 400 : 500;
        res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply theme" });
    }
};

export const getPlugins = (_req: Request, res: Response) => {
    res.json({ plugins: getRutorrentPlugins() });
};

export const applyPlugin = (execFile: typeof childProcess.execFile) => async (req: Request, res: Response) => {
    const { plugin, action } = parsePluginBody(req.body);
    if (typeof plugin !== "string" || !isPluginAction(action)) {
        res.status(400).json({ error: "plugin and action fields required" });
        return;
    }
    try {
        await applyRutorrentPluginActionWithExecFile(plugin, action, execFile);
        res.json({ ok: true, plugin, action });
    } catch (error) {
        const status = error instanceof Error && error.message.startsWith("Invalid ") ? 400 : 500;
        res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply plugin action" });
    }
};

export function mountNodeRoutes(router: Router, runExecFile: typeof childProcess.execFile): void {
    router.get("/node/dashboard_config", getDashboardConfig);

    router.get("/node/branches", (_req: Request, res: Response) => {
        if (isTestMode()) {
            res.json({ branches: ["master", "development"] });
            return;
        }
        const repo = path.resolve(process.env.QUICKBOX_REPO_ROOT || "/etc/QuickBox");
        runExecFile("git", ["-c", `safe.directory=${repo}`, "-C", repo, "ls-remote", "--heads", "origin"], { timeout: 15000 }, (error, stdout) => {
            if (error) {
                console.warn("[branch-list] Git failed", { code: error.code, signal: error.signal, killed: error.killed });
                res.status(503).json({ error: "Unable to list remote branches" });
                return;
            }
            const branches = stdout.split("\n").map((line) => line.split("\trefs/heads/")[1]).filter((branch): branch is string => Boolean(branch));
            res.json({ branches });
        });
    });

    router.get(SYSTEM_STATIC_DATA_URL, getSystemStatic);
    router.get(SYSTEM_LOAD_DATA_URL, async (_req: Request, res: Response) => {
        res.json(await systemLoadData());
    });
    router.get(DISK_DATA_URL, async (_req: Request, res: Response) => {
        res.json(await diskDataData());
    });
    router.get(RAM_STATS_DATA_URL, async (_req: Request, res: Response) => {
        res.json(await ramStatsData());
    });
    router.get(PACKAGE_MANAGEMENT_DATA_URL, (_req: Request, res: Response) => {
        res.json(getPackageManagementStateData());
    });

    router.post("/node/theme", express.json(), applyTheme(runExecFile));
    router.get("/node/plugins", getPlugins);
    router.post("/node/plugin", express.json(), applyPlugin(runExecFile));
}
