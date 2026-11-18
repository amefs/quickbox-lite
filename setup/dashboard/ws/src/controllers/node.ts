// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";
import * as childProcess from "child_process";

import { applyDashboardThemeWithExecFile, dashboardConfig } from "../dashboard-config";
import { applyRutorrentPluginActionWithExecFile, getRutorrentPlugins } from "../plugins";
import { systemStaticInfoWithProviders } from "../system-static";
import { dashboardMenu } from "../widgets/menu";
import { removalModals } from "../widgets/removal-modals";
import { renderWithRequestLocale } from "./utils";

export const getMenu = async (req: Request, res: Response) => {
    const result = await renderWithRequestLocale(req, async () => await dashboardMenu());
    res.json(result);
};

export const getDashboardConfig = async (req: Request, res: Response) => {
    res.json(await renderWithRequestLocale(req, () => dashboardConfig()));
};

export const getSystemStatic = async (req: Request, res: Response) => {
    res.json(await renderWithRequestLocale(req, async () => await systemStaticInfoWithProviders()));
};

export const applyTheme = (execFile: typeof childProcess.execFile) => async (req: Request, res: Response) => {
    const theme = (req.body as { theme?: unknown } | undefined)?.theme;
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
    const body = req.body as { plugin?: unknown; action?: unknown } | undefined;
    const plugin = body?.plugin;
    const action = body?.action;
    try {
        await applyRutorrentPluginActionWithExecFile(plugin, action, execFile);
        res.json({ ok: true, plugin, action });
    } catch (error) {
        const status = error instanceof Error && error.message.startsWith("Invalid ") ? 400 : 500;
        res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply plugin action" });
    }
};

export const getRemovalModals = async (req: Request, res: Response) => {
    const result = await renderWithRequestLocale(req, async () => await removalModals());
    res.send(result);
};
