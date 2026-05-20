// SPDX-License-Identifier: GPL-3.0-or-later
// HTTP route factory — owns all Express GET/POST routes; Socket.IO middleware lives in server.tsx.

import express, { Router, type Request, type Response } from "express";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { resolveWidget } from "./handlers/message";
import i18n, { VALID_LOCALES } from "./i18n";
import { DebugPage } from "./debug";
import { applyDashboardTheme, dashboardConfig } from "./dashboard-config";
import { isTestMode, setActiveProfile } from "./testing";
import { dashboardMenu } from "./widgets/menu";
import { removalModals } from "./widgets/removal-modals";

export interface AppRouterOptions {
    /** Absolute path to the dashboard root (setup/dashboard). Used by /debug/assets/* static routes. */
    dashboardDir: string;
    /** Whether debug endpoints (/debug, /debug/node, /debug/assets/*) should be registered. */
    debugEnabled: boolean;
}

/**
 * Creates and returns an Express Router with all HTTP routes for the ws service.
 *
 * Route groups:
 *   /            — root info page
 *   /set         — locale switch (loopback-only in production)
 *   /node/*      — React SSR widget endpoints consumed by the PHP dashboard
 *   /debug*      — debug/introspection endpoints (gated by debugEnabled)
 *   /test/*      — test-only endpoints (gated by isTestMode())
 */
export function createAppRouter(options: AppRouterOptions): Router {
    const router = Router();

    // ── Root ─────────────────────────────────────────────────────────────────

    router.get("/", (req: Request, res: Response) => {
        res.send(ReactDOMServer.renderToString(
            <html>
                <head>
                    <title>QuickBox Websocket</title>
                </head>
                <body>
                    <pre>Request from {req.ip}</pre>
                </body>
            </html>,
        ));
    });

    // ── Locale ───────────────────────────────────────────────────────────────

    router.get("/set", (req: Request, res: Response) => {
        const remoteAddr = req.ip ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal && !isTestMode()) {
            res.status(403).send("Forbidden");
            return;
        }
        const lang = req.query.lang;
        const normalizedLang = typeof lang === "string" ? lang.toLowerCase() : "";
        const localeAliases: Record<string, string> = {
            "zh-cn": "zh",
            "zh-hans-cn": "zh",
        };
        const targetLocale = localeAliases[normalizedLang] ?? normalizedLang;
        if (VALID_LOCALES.includes(targetLocale)) {
            i18n.locale = targetLocale;
        } else {
            i18n.locale = "en";
        }
        res.send(i18n.locale);
    });

    // ── Node widget HTTP endpoints (consumed by PHP dashboard via fetch) ──────

    router.get("/node/menu", async (_req: Request, res: Response) => {
        const result = await dashboardMenu();
        res.json(result);
    });

    router.get("/node/dashboard_config", (_req: Request, res: Response) => {
        res.json(dashboardConfig());
    });

    router.post("/node/theme", express.json(), async (req: Request, res: Response) => {
        const { theme } = req.body as { theme?: unknown };
        if (typeof theme !== "string") {
            res.status(400).json({ error: "theme field required" });
            return;
        }
        try {
            await applyDashboardTheme(theme);
            res.json({ ok: true, theme });
        } catch (error) {
            const status = error instanceof Error && error.message === "Invalid theme" ? 400 : 500;
            res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply theme" });
        }
    });

    router.get("/node/removal_modals", async (_req: Request, res: Response) => {
        const result = await removalModals();
        res.send(result);
    });

    // ── Debug endpoints ───────────────────────────────────────────────────────

    if (options.debugEnabled) {
        router.use("/debug/assets/skins", express.static(path.join(options.dashboardDir, "skins")));
        router.use("/debug/assets/lib", express.static(path.join(options.dashboardDir, "lib")));
        router.use("/debug/assets/fonts", express.static(path.join(options.dashboardDir, "fonts")));

        router.get("/debug/node", async (req: Request, res: Response) => {
            const url = req.query.url;
            if (typeof url !== "string" || !url) {
                res.status(400).json({ error: "url query param required, e.g. /debug/node?url=/node/up.php" });
                return;
            }
            const result = await resolveWidget(url);
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
