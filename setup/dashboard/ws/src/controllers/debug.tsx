// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { DebugPage } from "../debug";
import { resolveWidget } from "../handlers/message";
import { renderWithRequestLocale } from "./utils";

export const getDebugNode = async (req: Request, res: Response) => {
    const url = req.query.url;
    if (typeof url !== "string" || !url) {
        res.status(400).json({ error: "url query param required, e.g. /debug/node?url=/node/up.php" });
        return;
    }
    const result = await renderWithRequestLocale(req, async () => await resolveWidget(url));
    res.send(result);
};

export const getDebugPage = (_req: Request, res: Response) => {
    res.send(ReactDOMServer.renderToString(<DebugPage />));
};
