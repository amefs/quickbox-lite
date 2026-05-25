// SPDX-License-Identifier: GPL-3.0-or-later
// HTTP route factory — owns all Express GET/POST routes; Socket.IO middleware lives in server.tsx.

import express, { Router, type Request, type Response } from "express";
import * as childProcess from "child_process";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { resolveWidget } from "./handlers/message";
import { normalizeLocale, resolveRequestLocale, withLocale } from "./i18n";
import { DebugPage } from "./debug";
import { DashboardPage, type DashboardSsrFragments } from "./dashboard-page";
import { applyDashboardThemeWithExecFile, dashboardConfig } from "./dashboard-config";
import { isTestMode, setActiveProfile } from "./testing";
import { dashboardMenu, resolveDashboardMenuState } from "./widgets/menu";
import { removalModals } from "./widgets/removal-modals";
import { packageManagementCenter } from "./widgets/package-management-center";
import { serviceControl } from "./widgets/service-control";
import { upTime } from "./widgets/up";
import { diskData } from "./widgets/disk-data";
import { ramStats } from "./widgets/memory-stats";
import { widgetsLoad } from "./widgets/load";
import { applyRutorrentPluginActionWithExecFile, getRutorrentPlugins, isPluginAction } from "./plugins";
import { systemStaticInfoWithProviders } from "./system-static";
import { readOutputLog } from "./widgets/output-log";

export interface AppRouterOptions {
    /** Absolute path to the dashboard root (setup/dashboard). Used by /debug/assets/* static routes. */
    dashboardDir: string;
    /** Allows tests to inject command execution without shelling out. */
    execFile?: typeof childProcess.execFile;
}

/**
 * Creates and returns an Express Router with all HTTP routes for the ws service.
 *
 * Route groups:
 *   /            — Node-rendered dashboard shell
 *   /set         — legacy locale normalizer for older clients
 *   /node/*      — React SSR widget endpoints consumed by the dashboard shell
 *   /debug*      — debug/introspection endpoints (gated by NODE_ENV)
 *   /test/*      — test-only endpoints (gated by isTestMode())
 */
export function createAppRouter(options: AppRouterOptions): Router {
    const router = Router();
    const runExecFile = options.execFile ?? childProcess.execFile;
    const debugEnabled = process.env.NODE_ENV !== "production";
    const renderWithLocale = async <T,>(req: Request, callback: () => T | Promise<T>): Promise<T> => {
        return await withLocale(resolveRequestLocale(req), callback);
    };

    router.use("/skins", express.static(path.join(options.dashboardDir, "skins")));
    router.use("/lib", express.static(path.join(options.dashboardDir, "lib")));
    router.use("/fonts", express.static(path.join(options.dashboardDir, "fonts")));
    router.use("/img", express.static(path.join(options.dashboardDir, "img")));
    router.use("/js", express.static(path.join(options.dashboardDir, "js")));
    router.use("/lang", express.static(path.join(options.dashboardDir, "lang")));

    // ── Root ─────────────────────────────────────────────────────────────────

    const renderDashboard = async (req: Request, res: Response, basePath = "") => {
        const locale = resolveRequestLocale(req);
        const html = await withLocale(locale, async () => {
            const [menuState, serviceControlHtml, packageManagementCenterHtml] = await Promise.all([
                resolveDashboardMenuState(),
                serviceControl(),
                packageManagementCenter(),
            ]);
            const ssrFragments: DashboardSsrFragments = {
                serviceControlHtml,
                packageManagementCenterHtml,
                uptimeHtml: upTime(),
                diskDataHtml: "",
                ramStatsHtml: "",
                loadHtml: "",
                cpuStaticHtml: "",
                networkInterfaces: [],
            };
            return ReactDOMServer.renderToString(
                <DashboardPage
                    basePath={basePath}
                    locale={locale}
                    menuState={menuState}
                    ssrFragments={ssrFragments}
                />,
            );
        });
        res.send(`<!DOCTYPE html>${html}`);
    };

    router.get("/", async (req: Request, res: Response) => {
        await renderDashboard(req, res);
    });

    router.get("/ws", async (req: Request, res: Response) => {
        await renderDashboard(req, res, "/ws");
    });

    router.get("/ws/", async (req: Request, res: Response) => {
        await renderDashboard(req, res, "/ws");
    });

    // ── Locale ───────────────────────────────────────────────────────────────

    router.get("/set", (req: Request, res: Response) => {
        const remoteAddr = req.ip ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal && !isTestMode()) {
            res.status(403).send("Forbidden");
            return;
        }
        res.send(normalizeLocale(req.query.lang));
    });

    // ── Node widget HTTP endpoints consumed by the dashboard shell ───────────

    router.get("/node/menu", async (req: Request, res: Response) => {
        const result = await renderWithLocale(req, async () => await dashboardMenu());
        res.json(result);
    });

    router.get("/node/dashboard_config", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, () => dashboardConfig()));
    });

    router.get("/node/system_static", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await systemStaticInfoWithProviders()));
    });

    router.get("/node/load", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await widgetsLoad()));
    });

    router.get("/node/disk_data", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await diskData()));
    });

    router.get("/node/ram_stats", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await ramStats()));
    });

    router.post("/node/theme", express.json(), async (req: Request, res: Response) => {
        const { theme } = req.body as { theme?: unknown };
        if (typeof theme !== "string") {
            res.status(400).json({ error: "theme field required" });
            return;
        }
        try {
            await applyDashboardThemeWithExecFile(theme, runExecFile);
            res.json({ ok: true, theme });
        } catch (error) {
            const status = error instanceof Error && error.message === "Invalid theme" ? 400 : 500;
            res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply theme" });
        }
    });

    router.get("/node/plugins", (_req: Request, res: Response) => {
        res.json({ plugins: getRutorrentPlugins() });
    });

    router.post("/node/plugin", express.json(), async (req: Request, res: Response) => {
        const { plugin, action } = req.body as { plugin?: unknown; action?: unknown };
        if (typeof plugin !== "string" || !isPluginAction(action)) {
            res.status(400).json({ error: "plugin and action fields required" });
            return;
        }
        try {
            await applyRutorrentPluginActionWithExecFile(plugin, action, runExecFile);
            res.json({ ok: true, plugin, action });
        } catch (error) {
            const status = error instanceof Error && error.message.startsWith("Invalid ") ? 400 : 500;
            res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply plugin action" });
        }
    });

    router.get("/node/removal_modals", async (req: Request, res: Response) => {
        const result = await renderWithLocale(req, async () => await removalModals());
        res.send(result);
    });

    router.get("/db/output.log", (req: Request, res: Response) => {
        const parseQueryNumber = (value: unknown) => {
            if (typeof value !== "string") {
                return undefined;
            }
            const parsed = parseInt(value, 10);
            return Number.isNaN(parsed) ? undefined : parsed;
        };

        res.json(readOutputLog(
            parseQueryNumber(req.query.offset),
            parseQueryNumber(req.query.length),
        ));
    });

    // ── Debug endpoints ───────────────────────────────────────────────────────

    if (debugEnabled) {
        router.use("/debug/assets/skins", express.static(path.join(options.dashboardDir, "skins")));
        router.use("/debug/assets/lib", express.static(path.join(options.dashboardDir, "lib")));
        router.use("/debug/assets/fonts", express.static(path.join(options.dashboardDir, "fonts")));

        router.get("/debug/node", async (req: Request, res: Response) => {
            const url = req.query.url;
            if (typeof url !== "string" || !url) {
                res.status(400).json({ error: "url query param required, e.g. /debug/node?url=/node/up" });
                return;
            }
            const result = await renderWithLocale(req, async () => await resolveWidget(url));
            res.send(result);
        });

        router.get("/debug", (_req: Request, res: Response) => {
            res.send(ReactDOMServer.renderToString(<DebugPage />));
        });
    }

    // ── Test-only endpoints ───────────────────────────────────────────────────

    if (isTestMode()) {
        router.post("/test/profile", express.json(), (req: Request, res: Response) => {
            const { profile } = req.body as { profile?: string };
            if (typeof profile === "string") {
                setActiveProfile(profile);
                res.json({ ok: true, profile });
            } else {
                res.status(400).json({ error: "profile field required" });
            }
        });
    }

    return router;
}
