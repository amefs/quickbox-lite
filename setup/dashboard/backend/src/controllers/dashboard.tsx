// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { DashboardPage } from "@quickbox-dashboard/frontend";

import { createDashboardPageData } from "../dashboard-page-data";
import { resolveRequestLocale, withLocale } from "../i18n";

export const renderDashboard = async (req: Request, res: Response) => {
    const locale = resolveRequestLocale(req);
    const html = await withLocale(locale, async () => {
        const pageData = await createDashboardPageData(locale);
        return ReactDOMServer.renderToString(
            <DashboardPage pageData={pageData} />,
        );
    });
    res.send(`<!DOCTYPE html>${html}`);
};
