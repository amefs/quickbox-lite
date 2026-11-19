// SPDX-License-Identifier: GPL-3.0-or-later
// HTTP route factory — owns all Express GET/POST routes; Socket.IO middleware lives in server.tsx.

import express, { Router, type Request, type Response } from "express";
import * as childProcess from "child_process";
import { createHash } from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";

import { resolveWidget } from "./handlers/message";
import i18n, { normalizeLocale, resolveRequestLocale, withLocale } from "./i18n";
import { DebugPage } from "./debug";
import { DashboardPage, type DashboardSsrFragments } from "./dashboard-page";
import { applyDashboardThemeWithExecFile, dashboardConfig } from "./dashboard-config";
import { isTestMode, setActiveProfile } from "./testing";
import { dashboardMenu, resolveDashboardMenuState } from "./widgets/menu";
import { removalModals } from "./widgets/removal-modals";
import {
    getPackageManagementData,
    getPackageManagementLabels,
    renderPackageManagementIsland,
} from "./widgets/package-management-center";
import { getServiceControlRows } from "./widgets/service-control";
import { renderServiceControlIsland, type ServiceControlLabels, type ServiceControlTheme } from "./widgets/service-control-island";
import { getUptimeParts } from "./widgets/up";
import { diskData, diskDataData } from "./widgets/disk-data";
import { ramStats, ramStatsData } from "./widgets/memory-stats";
import { systemLoadData, widgetsLoad } from "./widgets/load";
import { applyRutorrentPluginActionWithExecFile, getRutorrentPlugins, isPluginAction } from "./plugins";
import { systemStaticInfoWithProviders } from "./system-static";
import { readOutputLog } from "./widgets/output-log";
import { resolveDashboardClientBundle } from "./utils/client-assets";
import { runningTask } from "./widgets/running-task";
import { shouldUpgradeDashboardSocket } from "./auth";

export interface AppRouterOptions {
    /** Absolute path to the dashboard root (setup/dashboard). Used by /debug/assets/* static routes. */
    dashboardDir: string;
    /** Optional theme skin directory used by isolated mock servers. */
    skinsDir?: string;
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
    const skinsDir = options.skinsDir ?? path.join(options.dashboardDir, "skins");
    const debugEnabled = process.env.NODE_ENV !== "production" || process.env.QUICKBOX_WS_DEBUG === "1";
    const reactClientBundlePath = resolveDashboardClientBundle(options.dashboardDir);
    const readDashboardTheme = (): ServiceControlTheme =>
        existsSync(path.join(options.dashboardDir, "db", ".smoked.lock")) ? "smoked" : "defaulted";
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
    const renderWithLocale = async <T,>(req: Request, callback: () => T | Promise<T>): Promise<T> => {
        return await withLocale(resolveRequestLocale(req), callback);
    };

    router.use("/skins", express.static(skinsDir));
    router.use("/lib", express.static(path.join(options.dashboardDir, "lib")));
    router.use("/fonts", express.static(path.join(options.dashboardDir, "fonts")));
    router.use("/img", express.static(path.join(options.dashboardDir, "img")));
    router.use("/js", express.static(path.join(options.dashboardDir, "js")));
    router.use("/css", express.static(path.join(options.dashboardDir, "css")));
    router.use("/lang", express.static(path.join(options.dashboardDir, "lang")));

    const assetVersionCache = new Map<string, { mtimeMs: number; size: number; hash: string }>();
    const assetVersion = (relativePath: string): string => {
        try {
            const fullPath = path.join(options.dashboardDir, relativePath);
            const stat = statSync(fullPath);
            const cached = assetVersionCache.get(relativePath);
            if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
                return cached.hash;
            }
            const hash = createHash("sha256").update(readFileSync(fullPath)).digest("hex").slice(0, 12);
            assetVersionCache.set(relativePath, { mtimeMs: stat.mtimeMs, size: stat.size, hash });
            return hash;
        } catch {
            return "";
        }
    };

    // ── Root ─────────────────────────────────────────────────────────────────

    const renderDashboard = async (req: Request, res: Response, basePath = "") => {
        if (!reactClientBundlePath) {
            res.status(503).type("text/plain").send("Dashboard client bundle is unavailable");
            return;
        }
        const locale = resolveRequestLocale(req);
        const html = await withLocale(locale, async () => {
            const menuState = await resolveDashboardMenuState();
            const dashboardTheme = readDashboardTheme();
            const packageManagementData = getPackageManagementData();
            const packageManagementLabels = getPackageManagementLabels();
            const packageManagementIsland = renderPackageManagementIsland(packageManagementData, packageManagementLabels, dashboardTheme);
            const serviceControlRows = getServiceControlRows();
            const serviceControlLabels: ServiceControlLabels = {
                title: i18n.t("SERVICE_CONTROL_CENTER"),
                status: i18n.t("SERVICE_STATUS"),
                restart: i18n.t("RESTART_SERVICES"),
                enableDisable: i18n.t("ENABLE_DISABLE_SERVICES"),
                refresh: i18n.t("REFRESH"),
                enabled: i18n.t("ENABLED"),
                disabled: i18n.t("DISABLED"),
                serviceStatusUnconfirmed: i18n.t("SERVICE_STATUS_UNCONFIRMED"),
                serviceStatusStale: i18n.t("SERVICE_STATUS_STALE"),
                serviceStatusLastConfirmedTemplate: i18n.t("SERVICE_STATUS_LAST_CONFIRMED", { time: "__SERVICE_STATUS_TIME__" }),
            };
            const serviceControlTheme: ServiceControlTheme = dashboardTheme;
            const serviceControlFragment = renderServiceControlIsland({ rows: serviceControlRows, labels: serviceControlLabels, theme: serviceControlTheme, statusById: {} });
            const uptimeParts = getUptimeParts();
            const ssrFragments: DashboardSsrFragments = {
                serviceControlHtml: serviceControlFragment.html,
                serviceControlRows,
                serviceControlLabels,
                serviceControlTheme,
                packageManagementCenterHtml: packageManagementIsland.html,
                runningTaskHtml: await runningTask(),
                packageManagementRuntime: { data: packageManagementData, labels: packageManagementLabels, theme: dashboardTheme },
                uptimeHtml: "",
                uptimeParts,
                diskDataHtml: "",
                ramStatsHtml: "",
                loadHtml: "",
                cpuStaticHtml: "",
                networkInterfaces: [],
            };
            const pageStyleCache = createCache();
            const rendered = ReactDOMServer.renderToString(
                <StyleProvider cache={pageStyleCache}>
                    <DashboardPage
                        basePath={basePath}
                        socketUpgrade={shouldUpgradeDashboardSocket(req.headers)}
                        locale={locale}
                        menuState={menuState}
                        ssrFragments={ssrFragments}
                        reactClientBundlePath={reactClientBundlePath}
                        theme={dashboardTheme}
                        assetVersions={{ css: assetVersion("css/dashboard.css"), js: assetVersion("js/dashboard.js") }}
                    />
                </StyleProvider>,
            );
            const styleMarkup = [extractStyle(pageStyleCache), serviceControlFragment.styleMarkup, packageManagementIsland.styleMarkup]
                .filter(Boolean)
                .join("");
            return styleMarkup
                ? rendered.replace("</head>", `${styleMarkup}</head>`)
                : rendered;
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

    router.get("/node/system_static", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await systemStaticInfoWithProviders()));
    });

    router.get("/node/migration/system_static", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await systemStaticInfoWithProviders()));
    });

    router.get("/node/load", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await widgetsLoad()));
    });

    router.get("/node/migration/system_load", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await systemLoadData()));
    });

    router.get("/node/disk_data", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await diskData()));
    });

    router.get("/node/migration/disk_data", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await diskDataData()));
    });

    router.get("/node/ram_stats", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await ramStats()));
    });

    router.get("/node/migration/ram_stats", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await ramStatsData()));
    });

    router.post("/node/theme", express.json(), async (req: Request, res: Response) => {
        const theme = parseThemeBody(req.body);
        if (theme === undefined) {
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
        const { plugin, action } = parsePluginBody(req.body);
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

    router.get("/node/migration/pmc", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, () => getPackageManagementData()));
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
            typeof req.query.epoch === "string" ? req.query.epoch : undefined,
        ));
    });

    // ── Debug endpoints ───────────────────────────────────────────────────────

    if (debugEnabled) {
        router.use("/debug/assets/skins", express.static(skinsDir));
        router.use("/debug/assets/lib", express.static(path.join(options.dashboardDir, "lib")));
        router.use("/debug/assets/fonts", express.static(path.join(options.dashboardDir, "fonts")));
        router.use("/debug/assets/css", express.static(path.join(options.dashboardDir, "css")));

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
            res.send(ReactDOMServer.renderToString(<DebugPage theme={readDashboardTheme()} />));
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
