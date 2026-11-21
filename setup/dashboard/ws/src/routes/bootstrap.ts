// SPDX-License-Identifier: GPL-3.0-or-later

import { Router, type Request, type Response } from "express";
import { shouldUpgradeDashboardSocket } from "../auth";
import { dashboardConfig } from "../services/config/dashboard";
import { readDefaultLocale, VALID_LOCALES } from "../services/config/locale";
import { serviceMap } from "../services/packages/info";
import { resolveDashboardMenuState } from "../services/packages/menu";
import { getPackageManagementData } from "../services/packages/pmc";
import { runningTaskData } from "../services/packages/running-task";
import { getServiceControlRows } from "../services/service/control";
import { getUptimeParts } from "../services/system/uptime";
import type { DashboardBootstrapPayload, DashboardChromeData, WsPushMode } from "../shared/bootstrap-contract";
import { readDashboardTheme } from "./utils";

function resolveWsPushMode(): WsPushMode {
    return process.env.QUICKBOX_WS_PUSH_MODE === "poll" ? "poll" : "push";
}

export async function buildBootstrapPayload(
    dashboardDir: string,
    req: Request,
    basePath = "",
): Promise<DashboardBootstrapPayload> {
    const config = dashboardConfig();
    const menuState = await resolveDashboardMenuState();
    const dashboardTheme = readDashboardTheme(dashboardDir, req);
    const packageManagementData = getPackageManagementData();
    const serviceControlRows = getServiceControlRows();
    const uptimeParts = getUptimeParts();
    const chrome: DashboardChromeData = {
        config: {
            username: config.username,
            version: config.version,
            branch: config.branch,
            branchCommit: config.branchCommit,
            showDeveloper: config.showDeveloper,
            hasExternalAuth: config.hasExternalAuth,
            ssoLogoutUrl: config.ssoLogoutUrl,
            languages: config.languages,
            themes: config.themes,
            bwPages: config.bwPages,
        },
        menuState,
    };
    return {
        basePath: basePath === "/ws" ? "/ws" : "",
        locales: VALID_LOCALES,
        defaultLocale: readDefaultLocale(),
        serviceKeys: [...serviceMap.keys()],
        socketUpgrade: shouldUpgradeDashboardSocket(req.headers),
        wsPushMode: resolveWsPushMode(),
        serviceTheme: dashboardTheme,
        serviceRows: serviceControlRows,
        systemSummary: {
            uptime: uptimeParts,
        },
        networkInterfaces: [],
        networkInterfacesLoaded: false,
        runningTask: await runningTaskData(),
        packageManagement: {
            data: packageManagementData,
            theme: dashboardTheme,
        },
        chrome,
    };
}

/**
 * Bootstrap sub-router (mounted at `/node` and `/ws/node`).
 *
 * Routes:
 *   GET /bootstrap
 */
export function createBootstrapRouter(dashboardDir: string, basePath: "" | "/ws" = ""): Router {
    const router = Router();

    router.get("/bootstrap", async (req: Request, res: Response) => {
        res.json(await buildBootstrapPayload(dashboardDir, req, basePath));
    });

    return router;
}
