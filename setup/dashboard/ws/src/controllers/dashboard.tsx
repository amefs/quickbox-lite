// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { DashboardPage } from "../dashboard-page";
import { resolveRequestLocale, withLocale } from "../i18n";
import { resolveDashboardMenuState } from "../widgets/menu";

export const renderDashboard = async (req: Request, res: Response) => {
    const locale = resolveRequestLocale(req);
    const html = await withLocale(locale, async () => {
        const menuState = await resolveDashboardMenuState();
        return ReactDOMServer.renderToString(<DashboardPage locale={locale} menuState={menuState} />);
    });
    res.send(`<!DOCTYPE html>${html}`);
};
