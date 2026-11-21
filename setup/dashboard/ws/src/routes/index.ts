// SPDX-License-Identifier: GPL-3.0-or-later

import express, { Router, type RequestHandler } from "express";
import * as childProcess from "child_process";
import path from "path";
import type { Server } from "socket.io";

import { isMockMode } from "../../mock";
import { createBootstrapRouter } from "./bootstrap";
import { createDebugRouter } from "./debug";
import { createLocaleRouter } from "./locale";
import { createMetricsHandler } from "./metrics";
import { createNodeRouter } from "./node";
import { createOutputLogRouter } from "./output-log";
import { createTestRouter } from "./test";
import { serveDashboardIndex } from "./utils";

export interface AppRouterOptions {
    /** Absolute path to the dashboard root (setup/dashboard). */
    dashboardDir: string;
    /** Optional theme skin directory used by isolated mock servers. */
    skinsDir?: string;
    /** Allows tests to inject command execution without shelling out. */
    execFile?: typeof childProcess.execFile;
    /** Optional gateway auth middleware applied to all routes after /metrics. */
    authMiddleware?: RequestHandler;
    /** Socket.IO servers observed by the /metrics endpoint. */
    socketServers?: Server[];
    /** Process health callback reported by the /metrics endpoint. */
    isHealthy?: () => boolean;
}

/**
 * Central HTTP router for the QuickBox WS service.
 *
 * Mount topology:
 *   /metrics                 -> direct loopback Prometheus scrape (no gateway auth)
 *   [authMiddleware]         -> authenticates all subsequent dashboard & API routes
 *   /skins                   -> static theme skin assets
 *   / & /ws                  -> static SPA bundle assets (web/dist)
 *   /, /index.html, /ws, /ws/-> SPA index.html entry
 *   /node & /ws/node         -> dashboard API & bootstrap sub-routers
 *   /set                     -> locale normalization sub-router
 *   /db                      -> incremental output log sub-router (/db/output.log)
 *   /debug & /ws/debug       -> development debug console sub-router
 *   /test                    -> mock profile control sub-router (mock mode only)
 */
export function createAppRouter(options: AppRouterOptions): Router {
    const router = Router();
    const runExecFile = options.execFile ?? childProcess.execFile;
    const skinsDir = options.skinsDir ?? path.join(options.dashboardDir, "skins");
    const debugEnabled = process.env.NODE_ENV !== "production" || process.env.QUICKBOX_WS_DEBUG === "1";
    const webDistDir = path.join(options.dashboardDir, "web", "dist");
    const webIndexHtmlPath = path.join(webDistDir, "index.html");
    const serveIndex = serveDashboardIndex(webIndexHtmlPath);

    // 0. Loopback-only Prometheus metrics (rejects proxied requests)
    router.get("/metrics", createMetricsHandler(options.socketServers ?? [], options.isHealthy ?? (() => true)));
    if (options.authMiddleware) {
        router.use(options.authMiddleware);
    }

    // 1. Static assets
    router.use("/skins", express.static(skinsDir));
    router.use("/", express.static(webDistDir, { index: false }));
    router.use("/ws", express.static(webDistDir, { index: false }));

    // 2. SPA HTML shell entry points
    router.get(["/", "/index.html", "/ws", "/ws/"], serveIndex);

    // 3. Dashboard Node API (/node/* and /ws/node/*)
    const nodeRouter = createNodeRouter(runExecFile);
    router.use("/node", createBootstrapRouter(options.dashboardDir, ""), nodeRouter);
    router.use("/ws/node", createBootstrapRouter(options.dashboardDir, "/ws"), nodeRouter);

    // 4. Utility & log endpoints (/set, /db/output.log)
    router.use("/set", createLocaleRouter());
    router.use("/db", createOutputLogRouter());

    // 5. Debug console (/debug/* and /ws/debug/*)
    if (debugEnabled) {
        router.use("/debug", createDebugRouter(options.dashboardDir, webIndexHtmlPath, ""));
        router.use("/ws/debug", createDebugRouter(options.dashboardDir, webIndexHtmlPath, "/ws"));
    }

    // 6. Test profile switcher (/test/profile)
    if (isMockMode()) {
        router.use("/test", createTestRouter());
    }

    return router;
}
