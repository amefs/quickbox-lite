// SPDX-License-Identifier: GPL-3.0-or-later

import { Router, type Request, type Response } from "express";
import { normalizeLocale } from "../services/config/locale";
import { isMockMode } from "../../mock";

export const setLocale = (req: Request, res: Response) => {
    const remoteAddr = req.ip ?? "";
    const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
    if (!isLocal && !isMockMode()) {
        res.status(403).send("Forbidden");
        return;
    }
    res.send(normalizeLocale(req.query.lang));
};

/**
 * Locale sub-router (mounted at `/set`).
 *
 * Routes:
 *   GET /
 */
export function createLocaleRouter(): Router {
    const router = Router();
    router.get("/", setLocale);
    return router;
}
