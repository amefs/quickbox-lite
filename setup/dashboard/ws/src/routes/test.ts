// SPDX-License-Identifier: GPL-3.0-or-later

import express, { Router, type Request, type Response } from "express";
import { invalidateInstalledPackagesCache } from "../services/packages/panels";
import { invalidateServiceState } from "../services/service/state";
import { resetPushSamplers } from "../socket/push";
import { setActiveProfile } from "../../mock";

export const setProfile = (req: Request, res: Response) => {
    const { profile } = req.body as { profile?: string };
    if (typeof profile === "string") {
        setActiveProfile(profile);
        invalidateInstalledPackagesCache();
        invalidateServiceState();
        resetPushSamplers();
        res.json({ ok: true, profile });
    } else {
        res.status(400).json({ error: "profile field required" });
    }
};

/**
 * Fixture profile sub-router (mounted at `/test` in mock mode only).
 *
 * Routes:
 *   POST /profile
 */
export function createTestRouter(): Router {
    const router = Router();
    router.post("/profile", express.json(), setProfile);
    return router;
}
