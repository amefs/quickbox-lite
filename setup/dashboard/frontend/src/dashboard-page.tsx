// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import type { DashboardMenuState, DashboardPageData, DashboardShellLabels } from "@quickbox-dashboard/shared";

import {
    NetworkInterfacePlaceholder,
    BandwidthTablePlaceholder,
    ServiceControlPlaceholder,
    PackageManagementPlaceholder,
    SystemLoadPlaceholder,
    CpuStatusPlaceholder,
    DiskStatusPlaceholder,
    MemoryStatusPlaceholder,
} from "./placeholder.js";

export interface DashboardPageProps {
    pageData: DashboardPageData;
}

function t(labels: DashboardShellLabels, key: string) {
    return labels[key] ?? key;
}

function resolveUsernameTemplate(value: string, username: string) {
    return value.replaceAll("$username$", username);
}

function DashboardMenu({
    labels,
    menuState,
    username,
}: {
    labels: DashboardShellLabels;
    menuState: DashboardMenuState;
    username: string;
}) {
    const { installedMenuEntries, installedDownloadEntries, showWebConsole } = menuState;

    return (
        <>
            {installedMenuEntries.map((entry) => (
                <li key={`menu-${entry.name}`}>
                    <a className="grayscale" href={resolveUsernameTemplate(entry.url, username)} target="_blank" rel="noopener noreferrer">
                        {entry.logo ? (
                            <img src={entry.logo} className="brand-ico" alt="" aria-hidden="true" />
                        ) : null}
                        <span>{entry.name}</span>
                    </a>
                </li>
            ))}

            {installedDownloadEntries.length ? (
                <li className="nav-parent">
                    <a href="#"><i className="fa fa-download"></i> <span>{t(labels, "DOWNLOADS")}</span></a>
                    <ul className="children">
                        {installedDownloadEntries.map((entry) => (
                            <li key={`download-${entry.name}`}>
                                <a href={resolveUsernameTemplate(entry.url, username)} target="_blank" rel="noopener noreferrer">
                                    {entry.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </li>
            ) : null}

            {showWebConsole ? (
                <li>
                    <a href={`/${username}.console`} target="_blank" rel="noopener noreferrer">
                        <i className="fa fa-keyboard-o"></i> <span>{t(labels, "WEB_CONSOLE")}</span>
                    </a>
                </li>
            ) : null}
        </>
    );
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

export function DashboardPage({ pageData }: DashboardPageProps) {
    const { config, labels, menuState, runtimeConfig, ssrFragments } = pageData;
    const { locale } = runtimeConfig;

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
                <link rel="stylesheet" href="/vendor-jquery.css" />
                <link rel="stylesheet" href="/vendor-ui.css" />
                <link rel="stylesheet" href="/vendor-misc.css" />
                <link rel="stylesheet" href="/skins/quick.css" />
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
` }} />
                <script dangerouslySetInnerHTML={{ __html: `window.quickboxRuntime = ${JSON.stringify(runtimeConfig)};` }} />
            </head>
            <body className="body">
                <header>
                    <div className="headerpanel">
                        <div className="logopanel">
                            <h2>
                                <a href="#"><img src="/img/logo-light.png" alt="QuickBox Seedbox" className="logo-image" height="50" /></a>
                            </h2>
                        </div>
                        <div className="headerbar">
                            <a id="menuToggle" className="menutoggle"><i className="fa fa-bars"></i></a>
                            <div className="header-right">
                                <ul className="headermenu">
                                    {config.showDeveloper ? (
                                        <li>
                                            <div className="btn-group">
                                                <button type="button" className="btn btn-logged">
                                                    <a href="#" className="label label-warning">{t(labels, "DEV_REPO_TXT")}</a>
                                                </button>
                                            </div>
                                        </li>
                                    ) : null}
                                    <li>
                                        <div id="noticePanel" className="btn-group">
                                            <button className="btn" data-toggle="dropdown">
                                                <i className="fa fa-menu"></i> QuickBox Lite Menu <span className="caret"></span>
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
                                                                                <h5>{t(labels, "LANG_SELECT")}</h5>
                                                                                <div id="node-language-options"></div>
                                                                            </div>
                                                                            <div className="col-xs-12 col-md-6" style={{ padding: 0 }}>
                                                                                <h5>{t(labels, "THEME_SELECT")}</h5>
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
                                                                                <h5>{t(labels, "BW_SELECT")}</h5>
                                                                                <div id="node-bw-page-options"></div>
                                                                            </div>
                                                                            <div className="col-xs-12 col-md-6" style={{ padding: 0 }}>
                                                                                <h5>{t(labels, "PANEL_CONFIG")}</h5>
                                                                                <small><div id="node-panel-reset" style={{ cursor: "pointer" }}>{t(labels, "PANEL_RESET")}</div></small>
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
                                    <li>
                                        <div className="btn-group">
                                            <button type="button" className="btn btn-logged" data-toggle="dropdown">
                                                {config.username}
                                                <span className="caret"></span>
                                            </button>
                                            <ul className="dropdown-menu pull-right">
                                                {config.branch === "master" ? (
                                                    <li><a data-click-handler="boxHandler" data-package="" data-operation="enable-dev" data-toggle="modal" data-target="#sysResponse" style={{ cursor: "pointer" }} dangerouslySetInnerHTML={{ __html: t(labels, "SWITCH_DEV") }}></a></li>
                                                ) : null}
                                                {config.branch === "development" ? (
                                                    <li><a data-click-handler="boxHandler" data-package="" data-operation="disable-dev" data-toggle="modal" data-target="#sysResponse" style={{ cursor: "pointer" }} dangerouslySetInnerHTML={{ __html: t(labels, "SWITCH_MASTER") }}></a></li>
                                                ) : null}
                                                <li style={{ borderTop: "1px solid #444" }}>
                                                    <a href="https://github.com/amefs/quickbox-lite/issues/new" target="_blank" rel="noopener noreferrer"><i className="fa fa-warning text-warning"></i>{t(labels, "ISSUE_REPORT_TXT")}</a>
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
                                <li className="tooltips active" data-toggle="tooltip" title={t(labels, "MAIN_MENU")} data-placement="bottom"><a data-toggle="tab" data-target="#mainmenu"><i className="tooltips fa fa-ellipsis-h"></i></a></li>
                                <li id="node-plugin-tab" className="tooltips" data-toggle="tooltip" title={t(labels, "RPLUGIN_MENU")} data-placement="bottom" style={menuState.showPluginTab ? undefined : { display: "none" }}><a data-toggle="tab" data-target="#plugins"><i className="tooltips fa fa-puzzle-piece"></i></a></li>
                                <li className="tooltips" data-toggle="tooltip" title={t(labels, "HELP_COMMANDS")} data-placement="bottom"><a data-toggle="tab" data-target="#help"><i className="tooltips fa fa-question-circle"></i></a></li>
                            </ul>
                            <div className="tab-content">
                                <div className="tab-pane active" id="mainmenu">
                                    <h5 className="sidebar-title">{t(labels, "MAIN_MENU")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk">
                                        <DashboardMenu labels={labels} menuState={menuState} username={config.username} />
                                    </ul>
                                </div>
                                <div className="tab-pane" id="plugins">
                                    <h5 className="sidebar-title">ruTorrent Plugins</h5>
                                    <ul id="node-plugin-list" className="nav nav-pills nav-stacked nav-quirk"></ul>
                                </div>
                                <div className="tab-pane" id="help">
                                    <h5 className="sidebar-title">{t(labels, "QUICK_SYSTEM_TIPS")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk nav-mail">
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box update quickbox</span><br /><small>{t(labels, "SYS_UPGRADE_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box lang COUNTRYCODE</span><br /><small>{t(labels, "SET_LANG_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box set interface</span><br /><small>{t(labels, "CHANGEINTERFACE_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box clean mem</span><br /><small>{t(labels, "CLEAN_MEM_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box clean log</span><br /><small>{t(labels, "CLEAN_LOG_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box iotest</span><br /><small>{t(labels, "DISKTEST_TXT")}</small></li>
                                    </ul>
                                    <h5 className="sidebar-title">{t(labels, "SEEDBOX_COMMANDS")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk nav-mail">
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box install APPNAME</span><br /><small>{t(labels, "APP_INSTALL_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box remove APPNAME</span><br /><small>{t(labels, "APP_UNINSTALL_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box update APPNAME</span><br /><small>{t(labels, "APP_UPGRADE_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box set password</span><br /><small>{t(labels, "CHANGEUSERPASS_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box fix dpkg</span><br /><small>{t(labels, "FIX_DPKG_TXT")}</small></li>
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>box troubleshoot</span><br /><small>{t(labels, "TROUBLESHOOT_TXT")}</small></li>
                                    </ul>
                                    <h5 className="sidebar-title">{t(labels, "ESSENTIAL_USER_COMMANDS")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk nav-mail">
                                        <li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>systemctl restart rtorrent@{config.username}.service</span><br /><small>{t(labels, "SCREEN_RTORRNENT_TXT")}</small></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mainpanel">
                        <div className="contentpanel">
                            <div className="row">
                                <div className="col-md-8" data-inner-id="left-panel-container">
                                    <div className="panel panel-main panel-inverse" data-inner-id="panel-server-bandwidth-interface">
                                        <div className="panel-heading">
                                            <h4 className="panel-title">{t(labels, "BANDWIDTH_DATA")}</h4>
                                        </div>
                                        <div className="row panel-footer panel-statistics" style={{ padding: 0 }}>
                                            <div className="col-md-12">
                                                <div className="table-responsive">
                                                    <table className="table table-hover table-bordered nomargin">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{t(labels, "NETWORK")}</th>
                                                                <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{t(labels, "UPLOAD")}</th>
                                                                <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{t(labels, "DOWNLOAD")}</th>
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
                                            <h4 className="panel-title">{t(labels, "VIEW_ADDITIONAL_BANDWIDTH_DETAILS")}</h4>
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
                                <div className="col-md-4 dash-right" data-inner-id="right-panel-container">
                                    <div className="panel panel-side panel-inverse-full panel-updates" data-inner-id="panel-server-load">
                                        <div className="panel-heading"><h4 className="panel-title text-success">{t(labels, "SERVER_LOAD")}</h4></div>
                                        <div className="panel-body">
                                            <div className="row">
                                                <div className="col-sm-9">
                                                    <h4><span id="cpuload" dangerouslySetInnerHTML={ssrFragments.loadHtml ? { __html: ssrFragments.loadHtml } : undefined}>{ssrFragments.loadHtml ? undefined : <SystemLoadPlaceholder />}</span></h4>
                                                    <p>{t(labels, "SL_TXT")}</p>
                                                </div>
                                                <div className="col-sm-3 text-right"><i className="fa fa-heartbeat text-danger" style={{ fontSize: "70px" }}></i></div>
                                                <div className="row">
                                                    <div className="col-sm-12 mt20 text-center">
                                                        <strong>{t(labels, "UPTIME")}:</strong> <span id="uptime" dangerouslySetInnerHTML={{ __html: ssrFragments.uptimeHtml }}></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-cpu">
                                        <div className="panel-heading"><h4 className="panel-title">{t(labels, "CPU_STATUS")}</h4></div>
                                        <div className="panel-body" style={{ overflow: "hidden" }}>
                                            <span id="node-cpu-static" className="nomargin" style={{ fontSize: "14px" }} dangerouslySetInnerHTML={ssrFragments.cpuStaticHtml ? { __html: ssrFragments.cpuStaticHtml } : undefined}>{ssrFragments.cpuStaticHtml ? undefined : <CpuStatusPlaceholder />}</span>
                                        </div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-disk">
                                        <div className="panel-heading"><h4 className="panel-title">{t(labels, "YOUR_DISK_STATUS")}</h4></div>
                                        <div className="panel-body"><div id="disk_data" dangerouslySetInnerHTML={ssrFragments.diskDataHtml ? { __html: ssrFragments.diskDataHtml } : undefined}>{ssrFragments.diskDataHtml ? undefined : <DiskStatusPlaceholder />}</div></div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-ram">
                                        <div className="panel-heading"><h4 className="panel-title">{t(labels, "SYSTEM_RAM_STATUS")}</h4></div>
                                        <div className="panel-body"><div id="meterram" dangerouslySetInnerHTML={ssrFragments.ramStatsHtml ? { __html: ssrFragments.ramStatsHtml } : undefined}>{ssrFragments.ramStatsHtml ? undefined : <MemoryStatusPlaceholder />}</div></div>
                                    </div>
                                    <div className="panel panel-inverse" id="project-commits" data-inner-id="panel-server-update">
                                        <div className="panel-heading">
                                            <h4 className="panel-title text-success">
                                                {t(labels, "RECENT_UPDATES")}{" "}
                                                <a href={`https://github.com/amefs/quickbox-lite/blob/${config.branch}/CHANGELOG.md#changelog-${config.version.replaceAll(".", "")}`} title={t(labels, "CURRENT_VERSIONS_CHANGELOG")} data-placement="top" className="label label-primary tooltips" style={{ fontSize: "10px", paddingTop: 0, paddingBottom: "0px", top: "-2px", position: "relative" }} target="_blank" rel="noopener noreferrer">
                                                    QuickBox :: <span style={{ color: "#fff", textShadow: "0px 0px 6px #fff" }}>{config.version}</span>
                                                </a>
                                            </h4>
                                        </div>
                                        <div className="panel-body ps" style={{ maxHeight: "350px", padding: 0 }}>
                                            <div id="activityfeed"></div>
                                        </div>
                                        <div className="panel-footer">
                                            <button data-click-handler="boxHandler" data-package="quickbox --only-core" data-operation="update" data-toggle="modal" data-target="#sysResponse" className="btn btn-success btn-quirk btn-block">
                                                <i className="fa fa-bell text-success"></i> {t(labels, "UPDATE")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: ssrFragments.removalModalsHtml }} />
                    <div className="modal animate__bounceIn animate__animated" id="themeSelectdefaultedConfirm" tabIndex={-1} role="dialog" aria-labelledby="ThemeSelectdefaultedConfirm" aria-hidden="true">
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header"><button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 className="modal-title" id="ThemeSelectdefaultedConfirm">Defaulted</h4></div>
                                <div className="modal-body">{t(labels, "THEME_CHANGE_TXT")}</div>
                                <div className="modal-footer"><button type="button" className="btn btn-default" data-dismiss="modal">{t(labels, "CANCEL")}</button><button type="button" data-theme="defaulted" data-click-handler="themeSelect" id="themeSelectdefaultedGo" className="btn btn-primary">{t(labels, "AGREE")}</button></div>
                            </div>
                        </div>
                    </div>
                    <div className="modal animate__bounceIn animate__animated" id="themeSelectsmokedConfirm" tabIndex={-1} role="dialog" aria-labelledby="ThemeSelectsmokedConfirm" aria-hidden="true">
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header"><button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 className="modal-title" id="ThemeSelectsmokedConfirm">Smoked</h4></div>
                                <div className="modal-body">{t(labels, "THEME_CHANGE_TXT")}</div>
                                <div className="modal-footer"><button type="button" className="btn btn-default" data-dismiss="modal">{t(labels, "CANCEL")}</button><button type="button" data-theme="smoked" data-click-handler="themeSelect" id="themeSelectsmokedGo" className="btn btn-primary">{t(labels, "AGREE")}</button></div>
                            </div>
                        </div>
                    </div>
                    <div className="modal animate__bounceIn animate__animated" id="sysResponse" tabIndex={-1} role="dialog" aria-labelledby="sysResponse" aria-hidden="true">
                        <div className="modal-dialog" style={{ width: "600px" }}>
                            <div className="modal-content" style={{ background: "rgba(0, 0, 0, 0.6)", border: "2px solid rgba(0, 0, 0, 0.2)" }}>
                                <div className="modal-header" style={{ background: "rgba(0, 0, 0, 0.4)", border: "0!important" }}>
                                    <h4 className="modal-title" style={{ color: "#fff" }}>{t(labels, "SYSTEM_RESPONSE_TITLE")}</h4>
                                </div>
                                <div className="modal-body ps" style={{ background: "rgba(0, 0, 0, 0.4)", maxHeight: "600px" }} id="sysPre">
                                    <pre style={{ color: "rgb(83, 223, 131)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }} className="sysout"><span id="sshoutput"></span></pre>
                                </div>
                                <div className="modal-footer" style={{ background: "rgba(0, 0, 0, 0.4)", border: "0!important" }}>
                                    <button
                                        id="sysResponseCloseAction"
                                        data-default-click-handler="boxHandler"
                                        data-default-refresh-after-close="true"
                                        data-default-package="log"
                                        data-default-operation="clean"
                                        data-label-default={t(labels, "CLOSE_REFRESH")}
                                        data-label-log-view={t(labels, "CANCEL")}
                                        data-click-handler="boxHandler"
                                        data-refresh-after-close="true"
                                        data-package="log"
                                        data-operation="clean"
                                        data-dismiss="modal"
                                        className="btn btn-xs btn-danger"
                                    >
                                        {t(labels, "CLOSE_REFRESH")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <script
                    type="module"
                    dangerouslySetInnerHTML={{
                        __html: `await import("/dashboard-client.js");`,
                    }}
                />
            </body>
        </html>
    );
}

