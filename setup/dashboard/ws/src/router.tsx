// SPDX-License-Identifier: GPL-3.0-or-later
// HTTP route factory — owns all Express GET/POST routes; Socket.IO middleware lives in server.tsx.

import express, { Router, type Request, type Response } from "express";
import * as childProcess from "child_process";
import { existsSync } from "fs";
import path from "path";

import { resolveWidget } from "./handlers/message";
import i18n, { normalizeLocale, resolveRequestLocale, VALID_LOCALES, withLocale } from "./i18n";
import { getDebugMeta } from "./debug-meta";
import { applyDashboardThemeWithExecFile, dashboardConfig } from "./dashboard-config";
import { isTestMode, setActiveProfile } from "./testing";
import { dashboardMenu, resolveDashboardMenuState } from "./widgets/menu";
import { removalModals } from "./widgets/removal-modals";
import {
    getPackageManagementData,
    getPackageManagementLabels,
} from "./widgets/package-management-center";
import { getServiceControlRows } from "./widgets/service-control";
import { getUptimeParts } from "./widgets/up";
import { diskData, diskDataData } from "./widgets/disk-data";
import { ramStats, ramStatsData } from "./widgets/memory-stats";
import { systemLoadData, widgetsLoad } from "./widgets/load";
import { applyRutorrentPluginActionWithExecFile, getRutorrentPlugins, isPluginAction } from "./plugins";
import { systemStaticInfoWithProviders } from "./system-static";
import { readOutputLog } from "./widgets/output-log";
import { runningTaskData } from "./widgets/running-task";
import { shouldUpgradeDashboardSocket } from "./auth";
import { serviceMap } from "./info";
import type {
    DashboardBootstrapPayload,
    DashboardChromeData,
    DashboardPageLabels,
} from "./shared/bootstrap-contract";
import type { ServiceControlLabels } from "./shared/service-control-contract";
import { isDashboardTheme, type DashboardTheme } from "./shared/theme";

export interface AppRouterOptions {
    /** Absolute path to the dashboard root (setup/dashboard). Used by /debug/assets/* static routes. */
    dashboardDir: string;
    /** Optional theme skin directory used by isolated mock servers. */
    skinsDir?: string;
    /** Allows tests to inject command execution without shelling out. */
    execFile?: typeof childProcess.execFile;
}

/**
 * Creates and returns an Express Router with all HTTP routes for the ws service.
 *
 * Route groups:
 *   /            — Node-rendered dashboard shell
 *   /set         — legacy locale normalizer for older clients
 *   /node/*      — React SSR widget endpoints consumed by the dashboard shell
 *   /debug*      — debug/introspection endpoints (gated by NODE_ENV)
 *   /test/*      — test-only endpoints (gated by isTestMode())
 */
export function createAppRouter(options: AppRouterOptions): Router {
    const router = Router();
    const runExecFile = options.execFile ?? childProcess.execFile;
    const skinsDir = options.skinsDir ?? path.join(options.dashboardDir, "skins");
    const debugEnabled = process.env.NODE_ENV !== "production" || process.env.QUICKBOX_WS_DEBUG === "1";
    const webDistDir = path.join(options.dashboardDir, "web", "dist");
    const webIndexHtmlPath = path.join(webDistDir, "index.html");
    const readDashboardTheme = (req?: Request): DashboardTheme => {
        const cookieHeader = req?.headers.cookie;
        if (typeof cookieHeader === "string") {
            const match = /(?:^|;\s*)quickbox_theme=(smoked|defaulted)(?:;|$)/.exec(cookieHeader);
            if (isDashboardTheme(match?.[1])) {
                return match[1];
            }
        }
        return existsSync(path.join(options.dashboardDir, "db", ".smoked.lock")) ? "smoked" : "defaulted";
    };
    const parseThemeBody = (body: unknown): string | undefined => {
        if (body === null || typeof body !== "object" || !("theme" in body)) {
            return undefined;
        }
        const theme = (body as { theme?: unknown }).theme;
        return typeof theme === "string" ? theme : undefined;
    };
    const parsePluginBody = (body: unknown): { plugin?: unknown; action?: unknown } => {
        if (body === null || typeof body !== "object") {
            return {};
        }
        const record = body as { plugin?: unknown; action?: unknown };
        return { plugin: record.plugin, action: record.action };
    };
    const renderWithLocale = async <T,>(req: Request, callback: () => T | Promise<T>): Promise<T> => {
        return await withLocale(resolveRequestLocale(req), callback);
    };

    router.use("/skins", express.static(skinsDir));

    router.use(express.static(webDistDir, { index: false }));

    // ── Root & Bootstrap ────────────────────────────────────────────────────

    const serveDashboardIndex = (_req: Request, res: Response) => {
        if (!existsSync(webIndexHtmlPath)) {
            res.status(503).type("text/plain").send("Dashboard web bundle is unavailable");
            return;
        }
        res.sendFile(webIndexHtmlPath);
    };

    const buildBootstrapPayload = async (req: Request, basePath = ""): Promise<DashboardBootstrapPayload> => {
        const locale = resolveRequestLocale(req);
        return await withLocale(locale, async () => {
            const config = dashboardConfig();
            const menuState = await resolveDashboardMenuState();
            const dashboardTheme = readDashboardTheme(req);
            const packageManagementData = getPackageManagementData();
            const packageManagementLabels = getPackageManagementLabels();
            const serviceControlRows = getServiceControlRows();
            const serviceControlLabels: ServiceControlLabels = {
                title: i18n.t("SERVICE_CONTROL_CENTER"),
                status: i18n.t("SERVICE_STATUS"),
                restart: i18n.t("RESTART_SERVICES"),
                enableDisable: i18n.t("ENABLE_DISABLE_SERVICES"),
                refresh: i18n.t("REFRESH"),
                enabled: i18n.t("ENABLED"),
                disabled: i18n.t("DISABLED"),
                serviceStatusUnconfirmed: i18n.t("SERVICE_STATUS_UNCONFIRMED"),
                serviceStatusStale: i18n.t("SERVICE_STATUS_STALE"),
                serviceStatusLastConfirmedTemplate: i18n.t("SERVICE_STATUS_LAST_CONFIRMED", { time: "__SERVICE_STATUS_TIME__" }),
            };
            const uptimeParts = getUptimeParts();
            const chrome: DashboardChromeData = {
                locale,
                config: {
                    username: config.username,
                    version: config.version,
                    branch: config.branch,
                    branchCommit: config.branchCommit,
                    developerLabel: i18n.t("DEV_REPO_TXT", { branch: config.branch }),
                    showDeveloper: config.showDeveloper,
                    hasExternalAuth: config.hasExternalAuth,
                    ssoLogoutUrl: config.ssoLogoutUrl,
                    languages: config.languages,
                    themes: config.themes,
                    bwPages: config.bwPages,
                },
                menuState,
                labels: {
                    language: i18n.t("LANG_SELECT"),
                    theme: i18n.t("THEME_SELECT"),
                    bandwidth: i18n.t("BW_SELECT"),
                    panelConfig: i18n.t("PANEL_CONFIG"),
                    panelReset: i18n.t("PANEL_RESET"),
                    themeChange: i18n.t("THEME_CHANGE_TXT"),
                    cancel: i18n.t("CANCEL"),
                    agree: i18n.t("AGREE"),
                    mainMenu: i18n.t("MAIN_MENU"),
                    pluginMenu: i18n.t("RPLUGIN_MENU"),
                    helpCommands: i18n.t("HELP_COMMANDS"),
                    downloads: i18n.t("DOWNLOADS"),
                    webConsole: i18n.t("WEB_CONSOLE"),
                    quickSystemTips: i18n.t("QUICK_SYSTEM_TIPS"),
                    seedboxCommands: i18n.t("SEEDBOX_COMMANDS"),
                    essentialUserCommands: i18n.t("ESSENTIAL_USER_COMMANDS"),
                    systemUpgrade: i18n.t("SYS_UPGRADE_TXT"),
                    setLanguage: i18n.t("SET_LANG_TXT"),
                    changeInterface: i18n.t("CHANGEINTERFACE_TXT"),
                    cleanMemory: i18n.t("CLEAN_MEM_TXT"),
                    cleanLog: i18n.t("CLEAN_LOG_TXT"),
                    diskTest: i18n.t("DISKTEST_TXT"),
                    appInstall: i18n.t("APP_INSTALL_TXT"),
                    appUninstall: i18n.t("APP_UNINSTALL_TXT"),
                    appUpgrade: i18n.t("APP_UPGRADE_TXT"),
                    changePassword: i18n.t("CHANGEUSERPASS_TXT"),
                    fixDpkg: i18n.t("FIX_DPKG_TXT"),
                    troubleshoot: i18n.t("TROUBLESHOOT_TXT"),
                    restartRtorrent: i18n.t("SCREEN_RTORRNENT_TXT"),
                    switchDev: i18n.t("SWITCH_DEV"),
                    switchMaster: i18n.t("SWITCH_MASTER"),
                    branchOther: i18n.t("BRANCH_OTHER"),
                    branchSwitch: i18n.t("BRANCH_SWITCH"),
                    branchCurrent: i18n.t("BRANCH_CURRENT"),
                    branchTarget: i18n.t("BRANCH_TARGET"),
                    branchLoading: i18n.t("BRANCH_LOADING"),
                    branchListError: i18n.t("BRANCH_LIST_ERROR"),
                    branchWarning: i18n.t("BRANCH_WARNING"),
                    branchLoadFailed: i18n.t("BRANCH_LOAD_FAILED"),
                    branchSelect: i18n.t("BRANCH_SELECT"),
                    branchRetry: i18n.t("BRANCH_RETRY"),
                    branchUpdate: i18n.t("BRANCH_UPDATE"),
                    branchSwitchAction: i18n.t("BRANCH_SWITCH_ACTION"),
                    ssoLogout: i18n.t("SSO_LOGOUT_TXT"),
                    issueReport: i18n.t("ISSUE_REPORT_TXT"),
                },
            };
            const pageLabels: DashboardPageLabels = {
                bandwidthData: i18n.t("BANDWIDTH_DATA"),
                network: i18n.t("NETWORK"),
                upload: i18n.t("UPLOAD"),
                download: i18n.t("DOWNLOAD"),
                bandwidthDetails: i18n.t("VIEW_ADDITIONAL_BANDWIDTH_DETAILS"),
                serverLoad: i18n.t("SERVER_LOAD"),
                serverLoadText: i18n.t("SL_TXT"),
                uptime: i18n.t("UPTIME"),
                cpuStatus: i18n.t("CPU_STATUS"),
                diskStatus: i18n.t("YOUR_DISK_STATUS"),
                ramStatus: i18n.t("SYSTEM_RAM_STATUS"),
                recentUpdates: i18n.t("RECENT_UPDATES"),
                changelogTitle: i18n.t("CURRENT_VERSIONS_CHANGELOG"),
                update: i18n.t("UPDATE"),
            };
            return {
                basePath: basePath === "/ws" ? "/ws" : "",
                locale,
                locales: VALID_LOCALES,
                serviceKeys: [...serviceMap.keys()],
                messages: {
                    systemResponse: i18n.t("SYSTEM_RESPONSE_TITLE"),
                    closeRefresh: i18n.t("CLOSE_REFRESH"),
                    close: i18n.t("CLOSE"),
                    ...serviceControlLabels,
                },
                socketUpgrade: shouldUpgradeDashboardSocket(req.headers),
                serviceTheme: dashboardTheme,
                serviceRows: serviceControlRows,
                systemSummary: {
                    uptime: uptimeParts,
                    labels: {
                        days: i18n.t("DAYS_L"),
                        hours: i18n.t("HOURS_L"),
                        minutes: i18n.t("MINUTES_L"),
                    },
                },
                networkInterfaces: [],
                networkInterfacesLoaded: false,
                runningTask: runningTaskData(),
                packageManagement: {
                    data: packageManagementData,
                    labels: packageManagementLabels,
                    theme: dashboardTheme,
                },
                chrome,
                pageLabels,
            };
        });
    };

    router.get("/", serveDashboardIndex);
    router.get("/index.html", serveDashboardIndex);
    router.get("/ws", serveDashboardIndex);
    router.get("/ws/", serveDashboardIndex);

    router.get("/node/bootstrap", async (req: Request, res: Response) => {
        res.json(await buildBootstrapPayload(req));
    });

    router.get("/ws/node/bootstrap", async (req: Request, res: Response) => {
        res.json(await buildBootstrapPayload(req, "/ws"));
    });

    // ── Locale ───────────────────────────────────────────────────────────────

    router.get("/set", (req: Request, res: Response) => {
        const remoteAddr = req.ip ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal && !isTestMode()) {
            res.status(403).send("Forbidden");
            return;
        }
        res.send(normalizeLocale(req.query.lang));
    });

    // ── Node widget HTTP endpoints consumed by the dashboard shell ───────────

    router.get("/node/menu", async (req: Request, res: Response) => {
        const result = await renderWithLocale(req, async () => await dashboardMenu());
        res.json(result);
    });

    router.get("/node/dashboard_config", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, () => dashboardConfig()));
    });

    router.get("/node/branches", (_req: Request, res: Response) => {
        if (isTestMode()) {
            res.json({ branches: ["master", "development"] });
            return;
        }
        const repo = path.resolve(process.env.QUICKBOX_REPO_ROOT || "/etc/QuickBox");
        runExecFile("git", ["-c", `safe.directory=${repo}`, "-C", repo, "ls-remote", "--heads", "origin"], { timeout: 15000 }, (error, stdout) => {
            if (error) {
                console.warn("[branch-list] Git failed", { code: error.code, signal: error.signal, killed: error.killed });
                res.status(503).json({ error: "Unable to list remote branches" });
                return;
            }
            const branches = stdout.split("\n").map((line) => line.split("\trefs/heads/")[1]).filter((branch): branch is string => Boolean(branch));
            res.json({ branches });
        });
    });

    router.get("/node/system_static", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await systemStaticInfoWithProviders()));
    });

    router.get("/node/data/system_static", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await systemStaticInfoWithProviders()));
    });

    router.get("/node/load", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await widgetsLoad()));
    });

    router.get("/node/data/system_load", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await systemLoadData()));
    });

    router.get("/node/disk_data", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await diskData()));
    });

    router.get("/node/data/disk_data", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await diskDataData()));
    });

    router.get("/node/ram_stats", async (req: Request, res: Response) => {
        res.send(await renderWithLocale(req, async () => await ramStats()));
    });

    router.get("/node/data/ram_stats", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, async () => await ramStatsData()));
    });

    router.post("/node/theme", express.json(), async (req: Request, res: Response) => {
        const theme = parseThemeBody(req.body);
        if (theme === undefined) {
            res.status(400).json({ error: "theme field required" });
            return;
        }
        try {
            await applyDashboardThemeWithExecFile(theme, runExecFile);
            res.json({ ok: true, theme });
        } catch (error) {
            const status = error instanceof Error && error.message === "Invalid theme" ? 400 : 500;
            res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply theme" });
        }
    });

    router.get("/node/plugins", (_req: Request, res: Response) => {
        res.json({ plugins: getRutorrentPlugins() });
    });

    router.post("/node/plugin", express.json(), async (req: Request, res: Response) => {
        const { plugin, action } = parsePluginBody(req.body);
        if (typeof plugin !== "string" || !isPluginAction(action)) {
            res.status(400).json({ error: "plugin and action fields required" });
            return;
        }
        try {
            await applyRutorrentPluginActionWithExecFile(plugin, action, runExecFile);
            res.json({ ok: true, plugin, action });
        } catch (error) {
            const status = error instanceof Error && error.message.startsWith("Invalid ") ? 400 : 500;
            res.status(status).json({ error: error instanceof Error ? error.message : "Failed to apply plugin action" });
        }
    });

    router.get("/node/removal_modals", async (req: Request, res: Response) => {
        const result = await renderWithLocale(req, async () => await removalModals());
        res.send(result);
    });

    router.get("/node/data/pmc", async (req: Request, res: Response) => {
        res.json(await renderWithLocale(req, () => getPackageManagementData()));
    });

    router.get("/db/output.log", (req: Request, res: Response) => {
        const parseQueryNumber = (value: unknown) => {
            if (typeof value !== "string") {
                return undefined;
            }
            const parsed = parseInt(value, 10);
            return Number.isNaN(parsed) ? undefined : parsed;
        };

        res.json(readOutputLog(
            parseQueryNumber(req.query.offset),
            parseQueryNumber(req.query.length),
            typeof req.query.epoch === "string" ? req.query.epoch : undefined,
        ));
    });

    // ── Debug endpoints ───────────────────────────────────────────────────────

    if (debugEnabled) {
        const handleDebugNode = async (req: Request, res: Response) => {
            const url = req.query.url;
            if (typeof url !== "string" || !url) {
                res.status(400).json({ error: "url query param required, e.g. /debug/node?url=/node/up" });
                return;
            }
            const result = await renderWithLocale(req, async () => await resolveWidget(url));
            res.send(result);
        };

        router.get("/debug", serveDashboardIndex);
        router.get("/ws/debug", serveDashboardIndex);
        router.get("/debug/meta", (req: Request, res: Response) => {
            res.json(getDebugMeta(readDashboardTheme(req)));
        });
        router.get("/ws/debug/meta", (req: Request, res: Response) => {
            res.json(getDebugMeta(readDashboardTheme(req), "/ws"));
        });
        router.get("/debug/node", handleDebugNode);
        router.get("/ws/debug/node", handleDebugNode);
    }

    // ── Test-only endpoints ───────────────────────────────────────────────────

    if (isTestMode()) {
        router.post("/test/profile", express.json(), (req: Request, res: Response) => {
            const { profile } = req.body as { profile?: string };
            if (typeof profile === "string") {
                setActiveProfile(profile);
                res.json({ ok: true, profile });
            } else {
                res.status(400).json({ error: "profile field required" });
            }
        });
    }

    return router;
}
