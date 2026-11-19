// SPDX-License-Identifier: GPL-3.0-or-later

import express, { Router, type Request, type Response } from "express";
import { invalidateInstalledPackagesCache } from "../services/packages/panels";
import { invalidateServiceState } from "../services/service/state";
import { resetPushSamplers } from "../socket/push";
import { setActiveProfile } from "../testing";

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
 * Test profile sub-router (mounted at `/test` when test mode is enabled).
 *
 * Routes:
 *   POST /profile
 */
export function createTestRouter(): Router {
    const router = Router();
    router.post("/profile", express.json(), setProfile);
    return router;
}
