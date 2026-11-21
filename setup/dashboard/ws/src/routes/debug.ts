// SPDX-License-Identifier: GPL-3.0-or-later

import { Router, type Request, type Response } from "express";
import { getDebugMeta } from "../services/config/debug-meta";
import { resolveWidget } from "../socket/message";
import { readDashboardTheme, serveDashboardIndex } from "./utils";

function parseLogPosition(value?: string): number | undefined {
    const position = Number.parseInt(value ?? "", 10);
    return Number.isSafeInteger(position) ? position : undefined;
}

/**
 * Debug console sub-router (mounted at `/debug` and `/ws/debug`).
 *
 * Routes:
 *   GET /
 *   GET /meta
 *   GET /node
 */
export function createDebugRouter(dashboardDir: string, webIndexHtmlPath: string, basePath: "" | "/ws" = ""): Router {
    const router = Router();
    const serveIndex = serveDashboardIndex(webIndexHtmlPath);

    router.get("/", (req, res) => {
        const queryIndex = req.originalUrl.indexOf("?");
        const pathname = queryIndex < 0 ? req.originalUrl : req.originalUrl.slice(0, queryIndex);
        if (pathname.endsWith("/")) {
            const query = queryIndex < 0 ? "" : req.originalUrl.slice(queryIndex);
            res.redirect(308, `../debug${query}`);
            return;
        }
        serveIndex(req, res);
    });

    router.get("/meta", (req: Request, res: Response) => {
        res.json(getDebugMeta(readDashboardTheme(dashboardDir, req), basePath));
    });

    router.get("/node", async (req: Request, res: Response) => {
        const url = req.query.url;
        if (typeof url !== "string" || !url) {
            res.status(400).json({ error: "url query param required, e.g. /debug/node?url=/node/up" });
            return;
        }
        const { pathname, searchParams } = new URL(url, "http://localhost");
        const { page, offset, length, epoch } = Object.fromEntries(searchParams);
        res.send(await resolveWidget(pathname, {
            page,
            offset: parseLogPosition(offset),
            length: parseLogPosition(length),
            epoch,
        }));
    });

    return router;
}
