// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { DashboardPage } from "../dashboard-page";
import { resolveRequestLocale, withLocale } from "../i18n";
import { resolveDashboardMenuState } from "../widgets/menu";
import { packageManagementCenter } from "../widgets/package-management-center";
import { runningTask } from "../widgets/running-task";
import { serviceControl } from "../widgets/service-control";
import { upTime } from "../widgets/up";

export const renderDashboard = async (req: Request, res: Response) => {
    const locale = resolveRequestLocale(req);
    const html = await withLocale(locale, async () => {
        const [menuState, serviceControlHtml, packageManagementCenterHtml, runningTaskHtml] = await Promise.all([
            resolveDashboardMenuState(),
            serviceControl(),
            packageManagementCenter(),
            runningTask(),
        ]);
        return ReactDOMServer.renderToString(
            <DashboardPage
                locale={locale}
                menuState={menuState}
                ssrFragments={{
                    packageManagementCenterHtml,
                    runningTaskHtml,
                    serviceControlHtml,
                    uptimeHtml: upTime(),
                    diskDataHtml: "",
                    ramStatsHtml: "",
                    loadHtml: "",
                    cpuStaticHtml: "",
                    networkInterfaces: [],
                }}
            />,
        );
    });
    res.send(`<!DOCTYPE html>${html}`);
};
