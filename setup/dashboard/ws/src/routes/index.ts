// SPDX-License-Identifier: GPL-3.0-or-later

import express, { Router } from "express";
import * as childProcess from "child_process";
import path from "path";

import { isTestMode } from "../testing";
import { mountBootstrapRoutes } from "./bootstrap";
import { mountDebugRoutes } from "./debug";
import { setLocale } from "./locale";
import { mountNodeRoutes } from "./node";
import { getOutputLog } from "./output-log";
import { setProfile } from "./test";

export interface AppRouterOptions {
    /** Absolute path to the dashboard root (setup/dashboard). */
    dashboardDir: string;
    /** Optional theme skin directory used by isolated mock servers. */
    skinsDir?: string;
    /** Allows tests to inject command execution without shelling out. */
    execFile?: typeof childProcess.execFile;
}

/**
 * Creates and returns an Express Router with all HTTP routes for the ws service.
 */
export function createAppRouter(options: AppRouterOptions): Router {
    const router = Router();
    const runExecFile = options.execFile ?? childProcess.execFile;
    const skinsDir = options.skinsDir ?? path.join(options.dashboardDir, "skins");
    const debugEnabled = process.env.NODE_ENV !== "production" || process.env.QUICKBOX_WS_DEBUG === "1";
    const webDistDir = path.join(options.dashboardDir, "web", "dist");
    const webIndexHtmlPath = path.join(webDistDir, "index.html");

    router.use("/skins", express.static(skinsDir));
    router.use(express.static(webDistDir, { index: false }));

    mountBootstrapRoutes(router, options.dashboardDir, webIndexHtmlPath);
    router.get("/set", setLocale);
    mountNodeRoutes(router, runExecFile);
    router.get("/db/output.log", getOutputLog);

    if (debugEnabled) {
        mountDebugRoutes(router, options.dashboardDir, webIndexHtmlPath);
    }

    if (isTestMode()) {
        router.post("/test/profile", express.json(), setProfile);
    }

    return router;
}
