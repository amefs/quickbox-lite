// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import { dashboardConfig } from "./dashboard-config";
import i18n, { VALID_LOCALES } from "./i18n";
import { serviceMap } from "./info";
import { serializeJsonForScript } from "./utils/html";
import type { ServiceRow } from "./shared/service-control-contract";
import type { PackageManagementRuntime } from "./shared/package-management-contract";
import type { UptimeParts } from "./shared/system-summary-contract";
import type { ServiceControlLabels, ServiceControlTheme } from "./widgets/service-control-island";
import { SystemLoadValue, UptimeValue } from "./widgets/system-summary-island";
import { NetworkInterfaceRows } from "./widgets/network-status-island";
import { BandwidthTablesRoot } from "./widgets/bandwidth-tables-view";
import { CpuStatusValue } from "./widgets/cpu-status-island";
import { MemoryStatsRoot } from "./widgets/memory-stats-island";
import { DiskDataRoot } from "./widgets/disk-data-island";
import type { DashboardMenuState } from "./widgets/menu";
import { DashboardHeader, DashboardSidebar, type DashboardChromeProps } from "./widgets/dashboard-chrome";
import {
    ServiceControlPlaceholder,
    PackageManagementPlaceholder,
    UptimePlaceholder,
} from "./widgets/placeholder";

export interface DashboardSsrFragments {
    packageManagementCenterHtml: string;
    runningTaskHtml: string;
    serviceControlHtml: string;
    serviceControlRows?: ServiceRow[];
    serviceControlLabels?: ServiceControlLabels;
    serviceControlTheme?: ServiceControlTheme;
    uptimeParts?: UptimeParts;
    uptimeHtml: string;
    diskDataHtml: string;
    ramStatsHtml: string;
    loadHtml: string;
    cpuStaticHtml: string;
    networkInterfaces: string[];
    networkInterfacesLoaded?: boolean;
    packageManagementRuntime?: PackageManagementRuntime;
}

export interface DashboardPageProps {
    basePath?: string;
    socketUpgrade?: boolean;
    locale: string;
    menuState: DashboardMenuState;
    ssrFragments: DashboardSsrFragments;
    reactClientBundlePath: string;
    theme: ServiceControlTheme;
    assetVersions?: { css: string; js: string };
}

function normalizeBasePath(basePath: string | undefined) {
    if (typeof basePath !== "string" || basePath === "") {
        return "";
    }
    return basePath === "/ws" ? "/ws" : "";
}

function dashboardAssetUrl(asset: string, version: string): string {
    return version ? `${asset}?v=${version}` : asset;
}

// The page composes the server-rendered shell and React islands.
// eslint-disable-next-line complexity
export function DashboardPage({ basePath, socketUpgrade = true, locale, menuState, ssrFragments, reactClientBundlePath, theme, assetVersions = { css: "", js: "" } }: DashboardPageProps) {
    const config = dashboardConfig();
    const normalizedBasePath = normalizeBasePath(basePath);
    const serviceControlLabels = ssrFragments.serviceControlLabels ?? {
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
    const systemSummaryLabels = {
        days: i18n.t("DAYS_L"),
        hours: i18n.t("HOURS_L"),
        minutes: i18n.t("MINUTES_L"),
    };
    const networkInterfacesLoaded = ssrFragments.networkInterfacesLoaded ?? ssrFragments.networkInterfaces.length > 0;
    const chromeProps: DashboardChromeProps = {
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
    const runtimeConfig = {
        basePath: normalizedBasePath,
        locale,
        locales: VALID_LOCALES,
        serviceKeys: [...serviceMap.keys()],
        messages: {
            systemResponse: i18n.t("SYSTEM_RESPONSE_TITLE"),
            closeRefresh: i18n.t("CLOSE_REFRESH"),
            close: i18n.t("CLOSE"),
            ...serviceControlLabels,
        },
        socketUpgrade,
        serviceTheme: ssrFragments.serviceControlTheme ?? "defaulted",
        serviceRows: ssrFragments.serviceControlRows ?? [],
        systemSummary: ssrFragments.uptimeParts
            ? { uptime: ssrFragments.uptimeParts, labels: systemSummaryLabels }
            : undefined,
        networkInterfaces: ssrFragments.networkInterfaces,
        networkInterfacesLoaded,
        chrome: chromeProps,
        ...(ssrFragments.packageManagementRuntime ? { packageManagement: ssrFragments.packageManagementRuntime } : {}),
    };

    return (
        <html lang={locale}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
                <meta name="description" content="QuickBox Lite dashboard" />
                <meta name="author" content="quickbox-lite" />
                <title>Quickbox Dashboard</title>
                <meta name="robots" content="noindex, nofollow" />
                <meta name="theme-color" content="#ffffff" />
                <link rel="apple-touch-icon" sizes="180x180" href="/img/favicon/apple-touch-icon.png" />
                <link rel="shortcut icon" href="/img/favicon/favicon.ico" type="image/ico" />
                <link rel="icon" type="image/png" href="/img/favicon/favicon-32x32.png" sizes="32x32" />
                <link rel="icon" type="image/png" href="/img/favicon/favicon-16x16.png" sizes="16x16" />
                <link rel="manifest" href="/img/favicon/manifest.json" />
                <link rel="mask-icon" href="/img/favicon/safari-pinned-tab.svg" color="#5bbad5" />
                <link rel="stylesheet" href="/lib/jquery-gritter/css/jquery.gritter.css" />
                <link rel="stylesheet" href={dashboardAssetUrl("/css/dashboard.css", assetVersions.css)} />
                <link rel="stylesheet" href="/lib/animate.css/animate.min.css" />
                <link rel="stylesheet" href="/lib/font-awesome/css/font-awesome.min.css" />
                <link rel="stylesheet" href="/css/dashboard-foundation.css" />
                <link rel="stylesheet" href={`/css/dashboard-theme-${theme}.css`} />
                <link rel="stylesheet" href="/css/react-service-control.css" />
                <link rel="stylesheet" href="/css/react-package-management.css" />
                <link rel="stylesheet" href="/css/react-system-response.css" />
                <link rel="stylesheet" href="/css/react-dashboard-chrome.css" />
                <style dangerouslySetInnerHTML={{ __html: `
@keyframes qb-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
}
.qb-skeleton {
    background: linear-gradient(90deg, rgba(128,128,128,0.12) 25%, rgba(128,128,128,0.24) 50%, rgba(128,128,128,0.12) 75%);
    background-size: 800px 100%;
    animation: qb-shimmer 1.5s ease-in-out infinite;
    border-radius: 3px;
}
.qb-skeleton-progress {
    height: 18px;
    border-radius: 9px;
}
.qb-skeleton-btn {
    height: 26px;
    border-radius: 4px;
    flex-shrink: 0;
}
.qb-skeleton-circle {
    border-radius: 50%;
    flex-shrink: 0;
}
#quickbox-alert-modal .modal-dialog {
    width: 600px;
    max-width: calc(100vw - 30px);
}
#quickbox-alert-modal .modal-header {
    align-items: center;
    display: flex;
    min-height: 48px;
    padding: 8px 12px 8px 20px;
}
#quickbox-alert-modal .modal-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 32px;
}
#quickbox-alert-modal .quickbox-modal-close {
    background: transparent;
    border: 0;
    border-radius: 4px;
    color: #69707a;
    flex: 0 0 32px;
    font-size: 22px;
    height: 32px;
    line-height: 30px;
    margin-left: auto;
    opacity: .65;
    padding: 0;
    text-align: center;
    width: 32px;
}
#quickbox-alert-modal .quickbox-modal-close:hover,
#quickbox-alert-modal .quickbox-modal-close:focus {
    background: rgba(0, 0, 0, .08);
    color: #111;
    opacity: 1;
    outline: 0;
}
#quickbox-alert-modal .modal-footer {
    padding: 12px 20px;
}
#quickbox-alert-modal .modal-footer .btn {
    min-width: 88px;
}
` }} />
                <script src="/lib/jquery/jquery.min.js"></script>
                <script dangerouslySetInnerHTML={{ __html: `window.quickboxRuntime = ${serializeJsonForScript(runtimeConfig)};` }} />
            </head>
            <body className="body" data-theme={theme}>
                <div className="dashboard-layout">
                    <header id="quickbox-header-root"><DashboardHeader props={chromeProps} /></header>
                    <section>
                        <div id="quickbox-sidebar-root" className="leftpanel ps"><DashboardSidebar props={chromeProps} /></div>
                        <div className="mainpanel">
                            <div className="contentpanel">
                                <div id="running_task_widget" dangerouslySetInnerHTML={{ __html: ssrFragments.runningTaskHtml }}></div>
                                <div className="row">
                                    <div className="col-md-8" data-inner-id="left-panel-container">
                                        <div className="panel panel-main panel-inverse" data-inner-id="panel-server-bandwidth-interface">
                                            <div className="panel-heading">
                                                <h4 className="panel-title">{i18n.t("BANDWIDTH_DATA")}</h4>
                                            </div>
                                            <div className="row panel-footer panel-statistics" style={{ padding: 0 }}>
                                                <div className="col-md-12">
                                                    <div className="table-responsive">
                                                        <table className="table table-hover table-bordered nomargin">
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{i18n.t("NETWORK")}</th>
                                                                    <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{i18n.t("UPLOAD")}</th>
                                                                    <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{i18n.t("DOWNLOAD")}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody id="node-network-interface-rows">
                                                                <NetworkInterfaceRows
                                                                    interfaces={ssrFragments.networkInterfaces}
                                                                    loaded={networkInterfacesLoaded}
                                                                    rates={Object.fromEntries(ssrFragments.networkInterfaces.map((iface) => [iface, { tx: "0 B/s", rx: "0 B/s" }]))}
                                                                />
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="panel panel-inverse" data-inner-id="panel-server-bandwidth-details">
                                            <div className="panel-heading">
                                                <h4 className="panel-title">{i18n.t("VIEW_ADDITIONAL_BANDWIDTH_DETAILS")}</h4>
                                            </div>
                                            <div className="panel-body" style={{ padding: 0 }}>
                                                <div className="row" style={{ padding: 0, margin: 0 }}>
                                                    <div id="bw_tables" style={{ padding: 0, margin: 0 }}>
                                                        <BandwidthTablesRoot data={null} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {ssrFragments.serviceControlHtml === "" ? (
                                            <div id="service_control_widget"><ServiceControlPlaceholder /></div>
                                        ) : (
                                            <div id="service_control_widget" dangerouslySetInnerHTML={{ __html: ssrFragments.serviceControlHtml }}></div>
                                        )}
                                        {ssrFragments.packageManagementCenterHtml === "" ? (
                                            <div id="pmc_widget"><PackageManagementPlaceholder /></div>
                                        ) : (
                                            <div id="pmc_widget" dangerouslySetInnerHTML={{ __html: ssrFragments.packageManagementCenterHtml }}></div>
                                        )}
                                    </div>
                                    <div className="col-md-4 dash-right" data-inner-id="right-panel-container">
                                        <div className="panel panel-side panel-inverse-full panel-updates" data-inner-id="panel-server-load">
                                            <div className="panel-heading"><h4 className="panel-title text-success">{i18n.t("SERVER_LOAD")}</h4></div>
                                            <div className="panel-body">
                                                <div className="row qb-panel-split">
                                                    <div className="col-sm-9 qb-panel-main">
                                                        <h4><span id="cpuload" dangerouslySetInnerHTML={ssrFragments.loadHtml ? { __html: ssrFragments.loadHtml } : undefined}>{ssrFragments.loadHtml ? undefined : <SystemLoadValue text={null} />}</span></h4>
                                                        <p>{i18n.t("SL_TXT")}</p>
                                                    </div>
                                                    <div className="col-sm-3 text-right qb-panel-icon"><i className="fa fa-heartbeat text-danger"></i></div>
                                                </div>
                                                <div className="row">
                                                    <div className="col-sm-12 mt20 text-center qb-uptime">
                                                        <strong>{i18n.t("UPTIME")}:</strong> <span id="uptime" dangerouslySetInnerHTML={ssrFragments.uptimeHtml ? { __html: ssrFragments.uptimeHtml } : undefined}>{ssrFragments.uptimeHtml ? undefined : ssrFragments.uptimeParts ? <UptimeValue parts={ssrFragments.uptimeParts} labels={systemSummaryLabels} /> : <UptimePlaceholder />}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="panel panel-side panel-inverse" data-inner-id="panel-server-cpu">
                                            <div className="panel-heading"><h4 className="panel-title">{i18n.t("CPU_STATUS")}</h4></div>
                                            <div className="panel-body" style={{ overflow: "hidden" }}>
                                                <span id="node-cpu-static" className="nomargin" style={{ fontSize: "14px" }} dangerouslySetInnerHTML={ssrFragments.cpuStaticHtml ? { __html: ssrFragments.cpuStaticHtml } : undefined}>{ssrFragments.cpuStaticHtml ? undefined : <CpuStatusValue data={null} />}</span>
                                            </div>
                                        </div>
                                        <div className="panel panel-side panel-inverse" data-inner-id="panel-server-disk">
                                            <div className="panel-heading"><h4 className="panel-title">{i18n.t("YOUR_DISK_STATUS")}</h4></div>
                                            <div className="panel-body"><div id="disk_data" dangerouslySetInnerHTML={ssrFragments.diskDataHtml ? { __html: ssrFragments.diskDataHtml } : undefined}>{ssrFragments.diskDataHtml ? undefined : <DiskDataRoot data={null} />}</div></div>
                                        </div>
                                        <div className="panel panel-side panel-inverse" data-inner-id="panel-server-ram">
                                            <div className="panel-heading"><h4 className="panel-title">{i18n.t("SYSTEM_RAM_STATUS")}</h4></div>
                                            <div className="panel-body"><div id="meterram" dangerouslySetInnerHTML={ssrFragments.ramStatsHtml ? { __html: ssrFragments.ramStatsHtml } : undefined}>{ssrFragments.ramStatsHtml ? undefined : <MemoryStatsRoot data={null} />}</div></div>
                                        </div>
                                        <div className="panel panel-inverse" id="project-commits" data-inner-id="panel-server-update">
                                            <div className="panel-heading">
                                                <h4 className="panel-title text-success">
                                                    {i18n.t("RECENT_UPDATES")}{" "}
                                                    <a href={`https://github.com/amefs/quickbox-lite/blob/${config.branch}/CHANGELOG.md#changelog-${config.version.replaceAll(".", "")}`} title={i18n.t("CURRENT_VERSIONS_CHANGELOG")} data-placement="top" className="label label-primary tooltips" style={{ fontSize: "10px", paddingTop: 0, paddingBottom: "0px", top: "-2px", position: "relative" }} target="_blank" rel="noopener noreferrer">
                                                        QuickBox :: <span style={{ color: "#fff", textShadow: "0px 0px 6px #fff" }}>{config.version}</span>
                                                    </a>
                                                </h4>
                                            </div>
                                            <div className="panel-body ps" style={{ maxHeight: "350px", padding: 0 }}>
                                                <div id="activityfeed"></div>
                                            </div>
                                            <div className="panel-footer">
                                                <button data-click-handler="boxHandler" data-package="quickbox --only-core" data-operation="update" data-toggle="modal" data-target="#sysResponse" className="btn btn-success btn-quirk btn-block">
                                                    <i className="fa fa-bell text-success"></i> {i18n.t("UPDATE")}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="quickbox-system-response-root" />
                    </section>
                </div>
                <script src="/lib/visibility/visibility.fallback.js"></script>
                <script src="/lib/visibility/visibility.core.js"></script>
                <script src="/lib/visibility/visibility.timers.js"></script>
                <script src="/lib/socket.io/socket.io.min.js"></script>
                <script src="/lib/ansi_up/ansi_up.min.js"></script>
                <script src="/lib/lazysizes/lazysizes.min.js" async></script>
                <script type="module" src={reactClientBundlePath}></script>
                <script type="module" src={dashboardAssetUrl("/js/dashboard.js", assetVersions.js)}></script>
            </body>
        </html>
    );
}

