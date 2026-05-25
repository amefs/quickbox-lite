// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";

import { setActiveProfile } from "../testing";

export const setTestProfile = (req: Request, res: Response) => {
    const { profile } = req.body as { profile?: string };
    if (typeof profile === "string") {
        setActiveProfile(profile);
        res.json({ ok: true, profile });
    } else {
        res.status(400).json({ error: "profile field required" });
    }
};
