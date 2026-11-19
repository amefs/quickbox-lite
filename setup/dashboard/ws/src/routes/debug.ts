// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response, Router } from "express";
import { getDebugMeta } from "../services/config/debug-meta";
import { resolveWidget } from "../socket/message";
import { readDashboardTheme, serveDashboardIndex } from "./utils";

export function mountDebugRoutes(router: Router, dashboardDir: string, webIndexHtmlPath: string): void {
    const serveIndex = serveDashboardIndex(webIndexHtmlPath);

    const handleDebugNode = async (req: Request, res: Response) => {
        const url = req.query.url;
        if (typeof url !== "string" || !url) {
            res.status(400).json({ error: "url query param required, e.g. /debug/node?url=/node/up" });
            return;
        }
        res.send(await resolveWidget(url));
    };

    router.get("/debug", serveIndex);
    router.get("/ws/debug", serveIndex);
    router.get("/debug/meta", (req: Request, res: Response) => {
        res.json(getDebugMeta(readDashboardTheme(dashboardDir, req)));
    });
    router.get("/ws/debug/meta", (req: Request, res: Response) => {
        res.json(getDebugMeta(readDashboardTheme(dashboardDir, req), "/ws"));
    });
    router.get("/debug/node", handleDebugNode);
    router.get("/ws/debug/node", handleDebugNode);
}
