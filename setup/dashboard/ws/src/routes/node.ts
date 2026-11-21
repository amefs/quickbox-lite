// SPDX-License-Identifier: GPL-3.0-or-later

import express, { Router, type Request, type Response } from "express";
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
import { isMockMode, MOCK_BRANCHES } from "../../mock";

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

/**
 * Node API sub-router (mounted at `/node` and `/ws/node`).
 *
 * Routes:
 *   GET  /dashboard_config
 *   GET  /branches
 *   GET  /data/system_static
 *   GET  /data/system_load
 *   GET  /data/disk_data
 *   GET  /data/ram_stats
 *   GET  /data/pmc
 *   POST /theme
 *   GET  /plugins
 *   POST /plugin
 */
export function createNodeRouter(runExecFile: typeof childProcess.execFile): Router {
    const router = Router();

    router.get("/dashboard_config", getDashboardConfig);

    router.get("/branches", (_req: Request, res: Response) => {
        if (isMockMode()) {
            res.json({ branches: MOCK_BRANCHES });
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

    router.get("/data/system_static", getSystemStatic);
    router.get("/data/system_load", async (_req: Request, res: Response) => {
        res.json(await systemLoadData());
    });
    router.get("/data/disk_data", async (_req: Request, res: Response) => {
        res.json(await diskDataData());
    });
    router.get("/data/ram_stats", async (_req: Request, res: Response) => {
        res.json(await ramStatsData());
    });
    router.get("/data/pmc", (_req: Request, res: Response) => {
        res.json(getPackageManagementStateData());
    });

    router.post("/theme", express.json(), applyTheme(runExecFile));
    router.get("/plugins", getPlugins);
    router.post("/plugin", express.json(), applyPlugin(runExecFile));

    return router;
}
