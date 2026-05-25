// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";

import { normalizeLocale } from "../i18n";
import { isTestMode } from "../testing";

export const setLocale = (req: Request, res: Response) => {
    const remoteAddr = req.ip ?? "";
    const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
    if (!isLocal && !isTestMode()) {
        res.status(403).send("Forbidden");
        return;
    }
    res.send(normalizeLocale(req.query.lang));
};
