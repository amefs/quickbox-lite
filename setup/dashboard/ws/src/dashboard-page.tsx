// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import { dashboardConfig } from "./dashboard-config";
import i18n, { VALID_LOCALES } from "./i18n";
import { serviceMap } from "./info";
import { serializeJsonForScript } from "./utils/html";
import { DashboardMenu, type DashboardMenuState } from "./widgets/menu";
import { RemovalModals } from "./widgets/removal-modals";
import {
    NetworkInterfacePlaceholder,
    BandwidthTablePlaceholder,
    ServiceControlPlaceholder,
    PackageManagementPlaceholder,
    SystemLoadPlaceholder,
    CpuStatusPlaceholder,
    DiskStatusPlaceholder,
    MemoryStatusPlaceholder,
    UptimePlaceholder,
} from "./widgets/placeholder";

export interface DashboardSsrFragments {
    packageManagementCenterHtml: string;
    serviceControlHtml: string;
    uptimeHtml: string;
    diskDataHtml: string;
    ramStatsHtml: string;
    loadHtml: string;
    cpuStaticHtml: string;
    networkInterfaces: string[];
}

export interface DashboardPageProps {
    basePath?: string;
    socketUpgrade?: boolean;
    locale: string;
    menuState: DashboardMenuState;
    ssrFragments: DashboardSsrFragments;
}

function normalizeBasePath(basePath: string | undefined) {
    if (typeof basePath !== "string" || basePath === "") {
        return "";
    }
    return basePath === "/ws" ? "/ws" : "";
}

function NetworkInterfaceRows({ interfaces }: { interfaces: string[] }) {
    if (interfaces.length === 0) {
        return <NetworkInterfacePlaceholder />;
    }
    return (
        <>
            {interfaces.map((iface) => (
                <tr key={iface}>
                    <td style={{ fontSize: "14px", fontWeight: "bold", padding: "2px 2px 2px 12px" }}>{iface}</td>
                    <td style={{ fontSize: "11px", padding: "2px 2px 2px 12px" }}>
                        <span className="text-success"><span>0 B/s</span></span>
                    </td>
                    <td style={{ fontSize: "11px", padding: "2px 2px 2px 12px" }}>
                        <span className="text-primary"><span>0 B/s</span></span>
                    </td>
                </tr>
            ))}
        </>
    );
}

export function DashboardPage({ basePath, socketUpgrade = true, locale, menuState, ssrFragments }: DashboardPageProps) {
    const config = dashboardConfig();
    const normalizedBasePath = normalizeBasePath(basePath);
    const runtimeConfig = {
        basePath: normalizedBasePath,
        socketUpgrade,
        locale,
        locales: VALID_LOCALES,
        serviceKeys: [...serviceMap.keys()],
        messages: {
            enabled: i18n.t("ENABLED"),
            disabled: i18n.t("DISABLED"),
            refresh: i18n.t("REFRESH"),
            systemResponse: i18n.t("SYSTEM_RESPONSE_TITLE"),
        },
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
                <link rel="stylesheet" href="/lib/jquery-ui/jquery-ui.min.css" />
                <link rel="stylesheet" href="/lib/jquery-toggles/toggles-full.css" />
                <link rel="stylesheet" href="/lib/jquery-gritter/css/jquery.gritter.css" />
                <link rel="stylesheet" href="/lib/datatables/css/dataTables.bootstrap.min.css" />
                <link rel="stylesheet" href="/lib/perfect-scrollbar/css/perfect-scrollbar.min.css" />
                <link rel="stylesheet" href="/lib/animate.css/animate.min.css" />
                <link rel="stylesheet" href="/lib/font-awesome/css/font-awesome.min.css" />
                <link rel="stylesheet" href="/lib/select2/select2.min.css" />
                <link rel="stylesheet" href="/lib/lobipanel/css/lobipanel.min.css" />
                <link rel="stylesheet" href="/skins/quick.css" />
                <style dangerouslySetInnerHTML={{ __html: `
.headerbar .header-right {
    float: none;
    min-width: 0;
}
.headerbar .headermenu {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    height: 64px;
}
.headerbar .headermenu > li {
    float: none;
    flex: 0 0 auto;
    min-width: 0;
}
.headerbar .headermenu > .header-branch {
    flex: 0 1 auto;
    padding: 0 12px;
}
.header-branch .label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.5;
}
.header-branch-name, .header-menu-short {
    display: none;
}
.headermenu .header-account .btn-logged {
    display: flex;
    align-items: center;
    max-width: min(200px, 28vw);
}
.header-username {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.header-account .caret {
    flex-shrink: 0;
}
@media (max-width: 640px) {
    .headerbar {
        padding-left: 44px;
    }
    .headerbar .menutoggle {
        width: 44px;
    }
    .headerbar .header-right {
        padding-right: 8px;
    }
    .headerbar .headermenu > .header-branch {
        padding: 0 4px;
    }
    .header-branch-description, .header-menu-full {
        display: none;
    }
    .header-branch-name, .header-menu-short {
        display: inline;
    }
    .headermenu #noticeDropdown {
        position: fixed;
        top: 64px;
        left: 8px;
        right: 8px;
        min-width: 0;
        margin-right: 0;
    }
}
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
            <body className="body">
                <header>
                    <div className="headerpanel">
                        <div className="logopanel">
                            <h2>
                                <a href="#"><img src="/img/logo-light.png" alt="QuickBox Seedbox" className="logo-image" width="222" height="50" /></a>
                            </h2>
                        </div>
                        <div className="headerbar">
                            <a id="menuToggle" className="menutoggle"><i className="fa fa-bars"></i></a>
                            <div className="header-right">
                                <ul className="headermenu">
                                    {config.showDeveloper ? (
                                        <li className="header-branch">
                                            <span className="label label-warning" title={i18n.t("DEV_REPO_TXT", { branch: config.branch })}>
                                                <span className="header-branch-description">{i18n.t("DEV_REPO_TXT", { branch: config.branch })}</span>
                                                <span className="header-branch-name">{config.branch}</span>
                                            </span>
                                        </li>
                                    ) : null}
                                    <li>
                                        <div id="noticePanel" className="btn-group">
                                            <button className="btn" data-toggle="dropdown" aria-label="QuickBox Lite Menu">
                                                <i className="fa fa-menu"></i> <span className="header-menu-full">QuickBox Lite Menu</span><span className="header-menu-short">QuickBox</span> <span className="caret"></span>
                                            </button>
                                            <div id="noticeDropdown" className="dropdown-menu dm-notice pull-right">
                                                <div role="tabpanel">
                                                    <ul className="nav nav-tabs nav-justified" role="tablist">
                                                        <li className="active"><a data-target="#quickplus" data-toggle="tab">QuickBox+</a></li>
                                                        <li><a data-target="#dashadjust" data-toggle="tab">Dashboard</a></li>
                                                        <li><a data-target="#configure" data-toggle="tab">Config</a></li>
                                                    </ul>
                                                    <div className="tab-content">
                                                        <div role="tabpanel" className="tab-pane active" id="quickplus">
                                                            <ul className="list-group">
                                                                <li className="list-group-item">
                                                                    <h5>QuickBox :: <span style={{ color: "#fff", textShadow: "0px 0px 6px #fff" }}>{config.version}</span></h5>
                                                                    <small><a href="https://github.com/amefs/quickbox-lite/blob/master/README.md" target="_blank" rel="noopener noreferrer">README.md</a></small>
                                                                    <small><a href={`https://github.com/amefs/quickbox-lite/blob/master/CHANGELOG.md#changelog-${config.version}`} target="_blank" rel="noopener noreferrer">CHANGELOG</a></small>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                        <div role="tabpanel" className="tab-pane" id="dashadjust">
                                                            <ul className="list-group">
                                                                <li className="list-group-item">
                                                                    <div className="row">
                                                                        <div className="col-xs-12">
                                                                            <div className="col-xs-12 col-md-6" style={{ padding: 0 }}>
                                                                                <h5>{i18n.t("LANG_SELECT")}</h5>
                                                                                <div id="node-language-options"></div>
                                                                            </div>
                                                                            <div className="col-xs-12 col-md-6" style={{ padding: 0 }}>
                                                                                <h5>{i18n.t("THEME_SELECT")}</h5>
                                                                                <div id="node-theme-options"></div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                        <div role="tabpanel" className="tab-pane" id="configure">
                                                            <ul className="list-group">
                                                                <li className="list-group-item">
                                                                    <div className="row">
                                                                        <div className="col-xs-12">
                                                                            <div className="col-xs-12 col-md-6" style={{ padding: 0 }}>
                                                                                <h5>{i18n.t("BW_SELECT")}</h5>
                                                                                <div id="node-bw-page-options"></div>
                                                                            </div>
                                                                            <div className="col-xs-12 col-md-6" style={{ padding: 0 }}>
                                                                                <h5>{i18n.t("PANEL_CONFIG")}</h5>
                                                                                <small><div id="node-panel-reset" style={{ cursor: "pointer" }}>{i18n.t("PANEL_RESET")}</div></small>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                    <li className="header-account">
                                        <div className="btn-group">
                                            <button type="button" className="btn btn-logged" data-toggle="dropdown">
                                                <span className="header-username" title={config.username}>{config.username}</span>
                                                <span className="caret"></span>
                                            </button>
                                            <ul className="dropdown-menu pull-right">
                                                {config.branch === "master" ? (
                                                    <li><a data-click-handler="boxHandler" data-package="" data-operation="enable-dev" data-toggle="modal" data-target="#sysResponse" style={{ cursor: "pointer" }} dangerouslySetInnerHTML={{ __html: i18n.t("SWITCH_DEV") }}></a></li>
                                                ) : null}
                                                {config.branch === "development" ? (
                                                    <li><a data-click-handler="boxHandler" data-package="" data-operation="disable-dev" data-toggle="modal" data-target="#sysResponse" style={{ cursor: "pointer" }} dangerouslySetInnerHTML={{ __html: i18n.t("SWITCH_MASTER") }}></a></li>
                                                ) : null}
                                                {config.hasExternalAuth ? (
                                                    <li>
                                                        <a href={`/logout?url=${encodeURIComponent(config.ssoLogoutUrl || "/")}`}>
                                                            <i className="fa fa-sign-out text-warning"></i>{i18n.t("SSO_LOGOUT_TXT")}
                                                        </a>
                                                    </li>
                                                ) : null}
                                                <li style={{ borderTop: "1px solid #444" }}>
                                                    <a href="https://github.com/amefs/quickbox-lite/issues/new" target="_blank" rel="noopener noreferrer"><i className="fa fa-warning text-warning"></i>{i18n.t("ISSUE_REPORT_TXT")}</a>
                                                </li>
                                            </ul>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </header>
                <section>
                    <div className="leftpanel ps">
                        <div className="leftpanelinner">
                            <ul className="nav nav-tabs nav-justified nav-sidebar">
                                <li className="tooltips active" data-toggle="tooltip" title={i18n.t("MAIN_MENU")} data-placement="bottom"><a data-toggle="tab" data-target="#mainmenu"><i className="tooltips fa fa-ellipsis-h"></i></a></li>
                                <li id="node-plugin-tab" className="tooltips" data-toggle="tooltip" title={i18n.t("RPLUGIN_MENU")} data-placement="bottom" style={menuState.showPluginTab ? undefined : { display: "none" }}><a data-toggle="tab" data-target="#plugins"><i className="tooltips fa fa-puzzle-piece"></i></a></li>
                                <li className="tooltips" data-toggle="tooltip" title={i18n.t("HELP_COMMANDS")} data-placement="bottom"><a data-toggle="tab" data-target="#help"><i className="tooltips fa fa-question-circle"></i></a></li>
                            </ul>
                            <div className="tab-content">
                                <div className="tab-pane active" id="mainmenu">
                                    <h5 className="sidebar-title">{i18n.t("MAIN_MENU")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk">
                                        <DashboardMenu menuState={menuState} />
                                    </ul>
                                </div>
                                <div className="tab-pane" id="plugins">
                                    <h5 className="sidebar-title">ruTorrent Plugins</h5>
                                    <ul id="node-plugin-list" className="nav nav-pills nav-stacked nav-quirk"></ul>
                                </div>
                                <div className="tab-pane" id="help">
                                    <h5 className="sidebar-title">{i18n.t("QUICK_SYSTEM_TIPS")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk nav-mail">
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box update quickbox</span><br /><small>{i18n.t("SYS_UPGRADE_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box lang COUNTRYCODE</span><br /><small>{i18n.t("SET_LANG_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box set interface</span><br /><small>{i18n.t("CHANGEINTERFACE_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box clean mem</span><br /><small>{i18n.t("CLEAN_MEM_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box clean log</span><br /><small>{i18n.t("CLEAN_LOG_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box iotest</span><br /><small>{i18n.t("DISKTEST_TXT")}</small></li>
                                    </ul>
                                    <h5 className="sidebar-title">{i18n.t("SEEDBOX_COMMANDS")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk nav-mail">
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box install APPNAME</span><br /><small>{i18n.t("APP_INSTALL_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box remove APPNAME</span><br /><small>{i18n.t("APP_UNINSTALL_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box update APPNAME</span><br /><small>{i18n.t("APP_UPGRADE_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box set password</span><br /><small>{i18n.t("CHANGEUSERPASS_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box fix dpkg</span><br /><small>{i18n.t("FIX_DPKG_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box troubleshoot</span><br /><small>{i18n.t("TROUBLESHOOT_TXT")}</small></li>
                                    </ul>
                                    <h5 className="sidebar-title">{i18n.t("ESSENTIAL_USER_COMMANDS")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk nav-mail">
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>systemctl restart rtorrent@{config.username}.service</span><br /><small>{i18n.t("SCREEN_RTORRNENT_TXT")}</small></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mainpanel">
                        <div className="contentpanel">
                            <div className="row">
                                <div className="col-sm-8" data-inner-id="left-panel-container">
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
                                                            <NetworkInterfaceRows interfaces={ssrFragments.networkInterfaces} />
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
                                                    <div id="bw_tables_loading"><BandwidthTablePlaceholder /></div>
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
                                <div className="col-sm-4 dash-right" data-inner-id="right-panel-container">
                                    <div className="panel panel-side panel-inverse-full panel-updates" data-inner-id="panel-server-load">
                                        <div className="panel-heading"><h4 className="panel-title text-success">{i18n.t("SERVER_LOAD")}</h4></div>
                                        <div className="panel-body">
                                            <div className="row">
                                                <div className="col-sm-9">
                                                    <h4><span id="cpuload" dangerouslySetInnerHTML={ssrFragments.loadHtml ? { __html: ssrFragments.loadHtml } : undefined}>{ssrFragments.loadHtml ? undefined : <SystemLoadPlaceholder />}</span></h4>
                                                    <p>{i18n.t("SL_TXT")}</p>
                                                </div>
                                                <div className="col-sm-3 text-right"><i className="fa fa-heartbeat text-danger" style={{ fontSize: "70px" }}></i></div>
                                                <div className="row">
                                                    <div className="col-sm-12 mt20 text-center">
                                                        <strong>{i18n.t("UPTIME")}:</strong> <span id="uptime" dangerouslySetInnerHTML={ssrFragments.uptimeHtml ? { __html: ssrFragments.uptimeHtml } : undefined}>{ssrFragments.uptimeHtml ? undefined : <UptimePlaceholder />}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-cpu">
                                        <div className="panel-heading"><h4 className="panel-title">{i18n.t("CPU_STATUS")}</h4></div>
                                        <div className="panel-body" style={{ overflow: "hidden" }}>
                                            <span id="node-cpu-static" className="nomargin" style={{ fontSize: "14px" }} dangerouslySetInnerHTML={ssrFragments.cpuStaticHtml ? { __html: ssrFragments.cpuStaticHtml } : undefined}>{ssrFragments.cpuStaticHtml ? undefined : <CpuStatusPlaceholder />}</span>
                                        </div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-disk">
                                        <div className="panel-heading"><h4 className="panel-title">{i18n.t("YOUR_DISK_STATUS")}</h4></div>
                                        <div className="panel-body"><div id="disk_data" dangerouslySetInnerHTML={ssrFragments.diskDataHtml ? { __html: ssrFragments.diskDataHtml } : undefined}>{ssrFragments.diskDataHtml ? undefined : <DiskStatusPlaceholder />}</div></div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-ram">
                                        <div className="panel-heading"><h4 className="panel-title">{i18n.t("SYSTEM_RAM_STATUS")}</h4></div>
                                        <div className="panel-body"><div id="meterram" dangerouslySetInnerHTML={ssrFragments.ramStatsHtml ? { __html: ssrFragments.ramStatsHtml } : undefined}>{ssrFragments.ramStatsHtml ? undefined : <MemoryStatusPlaceholder />}</div></div>
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
                    <RemovalModals />
                    <div className="modal animate__bounceIn animate__animated" id="themeSelectdefaultedConfirm" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ThemeSelectdefaultedConfirm">
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header"><button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button><h4 className="modal-title" id="ThemeSelectdefaultedConfirm">Defaulted</h4></div>
                                <div className="modal-body">{i18n.t("THEME_CHANGE_TXT")}</div>
                                <div className="modal-footer"><button type="button" className="btn btn-default" data-dismiss="modal">{i18n.t("CANCEL")}</button><button type="button" data-theme="defaulted" data-click-handler="themeSelect" id="themeSelectdefaultedGo" className="btn btn-primary">{i18n.t("AGREE")}</button></div>
                            </div>
                        </div>
                    </div>
                    <div className="modal animate__bounceIn animate__animated" id="themeSelectsmokedConfirm" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ThemeSelectsmokedConfirm">
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header"><button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button><h4 className="modal-title" id="ThemeSelectsmokedConfirm">Smoked</h4></div>
                                <div className="modal-body">{i18n.t("THEME_CHANGE_TXT")}</div>
                                <div className="modal-footer"><button type="button" className="btn btn-default" data-dismiss="modal">{i18n.t("CANCEL")}</button><button type="button" data-theme="smoked" data-click-handler="themeSelect" id="themeSelectsmokedGo" className="btn btn-primary">{i18n.t("AGREE")}</button></div>
                            </div>
                        </div>
                    </div>
                    <div className="modal animate__bounceIn animate__animated" id="sysResponse" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sysResponse">
                        <div className="modal-dialog" style={{ width: "600px" }}>
                            <div className="modal-content" style={{ background: "rgba(0, 0, 0, 0.6)", border: "2px solid rgba(0, 0, 0, 0.2)" }}>
                                <div className="modal-header" style={{ background: "rgba(0, 0, 0, 0.4)", border: "0!important" }}>
                                    <h4 className="modal-title" style={{ color: "#fff" }}>{i18n.t("SYSTEM_RESPONSE_TITLE")}</h4>
                                </div>
                                <div className="modal-body ps" style={{ background: "rgba(0, 0, 0, 0.4)", maxHeight: "600px" }} id="sysPre">
                                    <pre style={{ color: "rgb(83, 223, 131)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }} className="sysout"><span id="sshoutput"></span></pre>
                                </div>
                                <div className="modal-footer" style={{ background: "rgba(0, 0, 0, 0.4)", border: "0!important" }}>
                                    <button
                                        id="sysResponseCloseAction"
                                        data-default-refresh-after-close="true"
                                        data-label-default={i18n.t("CLOSE_REFRESH")}
                                        data-label-log-view={i18n.t("CANCEL")}
                                        data-refresh-after-close="true"
                                        data-dismiss="modal"
                                        className="btn btn-xs btn-danger"
                                    >
                                        {i18n.t("CLOSE_REFRESH")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <script src="/lib/jquery-ui/jquery-ui.min.js"></script>
                <script src="/lib/jquery-ui-touch-punch/jquery.ui.touch-punch.min.js"></script>
                <script src="/lib/bootstrap/js/bootstrap.min.js"></script>
                <script src="/lib/perfect-scrollbar/js/perfect-scrollbar.min.js"></script>
                <script src="/lib/visibility/visibility.fallback.js"></script>
                <script src="/lib/visibility/visibility.core.js"></script>
                <script src="/lib/visibility/visibility.timers.js"></script>
                <script src="/lib/socket.io/socket.io.min.js"></script>
                <script src="/lib/ansi_up/ansi_up.min.js"></script>
                <script src="/lib/lazysizes/lazysizes.min.js" async></script>
                <script src="/js/quick.js"></script>
                <script src="/js/dashboard.js"></script>
                <script src="/lib/lobipanel/js/lobipanel.min.js"></script>
                <script src="/lib/jquery-toggles/toggles.min.js"></script>
                <script src="/lib/datatables/js/jquery.dataTables.min.js"></script>
                <script src="/lib/datatables/js/dataTables.bootstrap.min.js"></script>
            </body>
        </html>
    );
}

