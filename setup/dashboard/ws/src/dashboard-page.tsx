// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import { dashboardConfig } from "./dashboard-config";
import i18n from "./i18n";

export interface DashboardPageProps {
    basePath?: string;
}

function normalizeBasePath(basePath: string | undefined) {
    if (typeof basePath !== "string" || basePath === "") {
        return "";
    }
    return basePath === "/ws" ? "/ws" : "";
}

export function DashboardPage({ basePath }: DashboardPageProps) {
    const config = dashboardConfig();
    const normalizedBasePath = normalizeBasePath(basePath);

    return (
        <html lang="en">
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
                <script src="/lib/jquery/jquery.min.js"></script>
                <script dangerouslySetInnerHTML={{ __html: CLIENT_BOOTSTRAP(normalizedBasePath) }} />
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
                                                    <a href="#" className="label label-warning">{i18n.t("DEV_REPO_TXT", { branch: config.branch })}</a>
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
                                    <li>
                                        <div className="btn-group">
                                            <button type="button" className="btn btn-logged" data-toggle="dropdown">
                                                {config.username}
                                                <span className="caret"></span>
                                            </button>
                                            <ul className="dropdown-menu pull-right">
                                                {config.branch === "master" ? (
                                                    <li><a data-click-handler="boxHandler" data-package="" data-operation="enable-dev" data-toggle="modal" data-target="#sysResponse" style={{ cursor: "pointer" }}>{i18n.t("SWITCH_DEV")}</a></li>
                                                ) : null}
                                                {config.branch === "development" ? (
                                                    <li><a data-click-handler="boxHandler" data-package="" data-operation="disable-dev" data-toggle="modal" data-target="#sysResponse" style={{ cursor: "pointer" }}>{i18n.t("SWITCH_MASTER")}</a></li>
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
                                <li id="node-plugin-tab" className="tooltips" data-toggle="tooltip" title={i18n.t("RPLUGIN_MENU")} data-placement="bottom" style={{ display: "none" }}><a data-toggle="tab" data-target="#plugins"><i className="tooltips fa fa-puzzle-piece"></i></a></li>
                                <li className="tooltips" data-toggle="tooltip" title={i18n.t("HELP_COMMANDS")} data-placement="bottom"><a data-toggle="tab" data-target="#help"><i className="tooltips fa fa-question-circle"></i></a></li>
                            </ul>
                            <div className="tab-content">
                                <div className="tab-pane active" id="mainmenu">
                                    <h5 className="sidebar-title">{i18n.t("MAIN_MENU")}</h5>
                                    <ul className="nav nav-pills nav-stacked nav-quirk">
                                        <li id="node-menu-loading" style={{ padding: "7px" }}>{i18n.t("REFRESH")}...</li>
                                        <li id="node-menu-anchor" style={{ display: "none" }}></li>
                                    </ul>
                                </div>
                                <div className="tab-pane" id="plugins">
                                    <h5 className="sidebar-title">ruTorrent Plugins</h5>
                                    <ul id="node-plugin-list" className="nav nav-pills nav-stacked nav-quirk"></ul>
                                </div>
                                <div className="tab-pane" id="help">
                                    <h5 className="sidebar-title">{i18n.t("HELP_COMMANDS")}</h5>
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
                                                            <tr><td colSpan={3} style={{ fontSize: "11px", padding: "4px 4px 4px 12px" }}>{i18n.t("REFRESH")}...</td></tr>
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
                                            <div className="row" style={{ padding: 0, margin: 0 }}><div id="bw_tables" style={{ padding: 0, margin: 0 }}></div></div>
                                        </div>
                                    </div>
                                    <div id="service_control_widget">
                                        <div className="panel panel-inverse" data-inner-id="panel-server-service-control">
                                            <div className="panel-heading"><h4 className="panel-title">{i18n.t("SERVICE_CONTROL_CENTER")}</h4></div>
                                            <div className="panel-body text-center" style={{ padding: "24px", color: "#999" }}>{i18n.t("REFRESH")}...</div>
                                        </div>
                                    </div>
                                    <div id="pmc_widget">
                                        <div className="panel panel-main panel-inverse" data-inner-id="panel-server-package-management">
                                            <div className="panel-heading"><h4 className="panel-title">{i18n.t("PACKAGE_MANAGEMENT_CENTER")}</h4></div>
                                            <div className="panel-body text-center" style={{ padding: "24px", color: "#999" }}>{i18n.t("REFRESH")}...</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4 dash-right" data-inner-id="right-panel-container">
                                    <div className="panel panel-side panel-inverse-full panel-updates" data-inner-id="panel-server-load">
                                        <div className="panel-heading"><h4 className="panel-title text-success">{i18n.t("SERVER_LOAD")}</h4></div>
                                        <div className="panel-body">
                                            <div className="row">
                                                <div className="col-sm-9">
                                                    <h4><span id="cpuload"></span></h4>
                                                    <p>{i18n.t("SL_TXT")}</p>
                                                </div>
                                                <div className="col-sm-3 text-right"><i className="fa fa-heartbeat text-danger" style={{ fontSize: "70px" }}></i></div>
                                                <div className="row">
                                                    <div className="col-sm-12 mt20 text-center">
                                                        <strong>{i18n.t("UPTIME")}:</strong> <span id="uptime"></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-cpu">
                                        <div className="panel-heading"><h4 className="panel-title">{i18n.t("CPU_STATUS")}</h4></div>
                                        <div className="panel-body" style={{ overflow: "hidden" }}>
                                            <span id="node-cpu-static" className="nomargin" style={{ fontSize: "14px" }}>{i18n.t("REFRESH")}...</span>
                                        </div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-disk">
                                        <div className="panel-heading"><h4 className="panel-title">{i18n.t("YOUR_DISK_STATUS")}</h4></div>
                                        <div className="panel-body"><div id="disk_data"></div></div>
                                    </div>
                                    <div className="panel panel-side panel-inverse" data-inner-id="panel-server-ram">
                                        <div className="panel-heading"><h4 className="panel-title">{i18n.t("SYSTEM_RAM_STATUS")}</h4></div>
                                        <div className="panel-body"><div id="meterram"></div></div>
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
                    <div id="node-removal-modals"></div>
                    <div className="modal animate__bounceIn animate__animated" id="themeSelectdefaultedConfirm" tabIndex={-1} role="dialog" aria-labelledby="ThemeSelectdefaultedConfirm" aria-hidden="true">
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header"><button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 className="modal-title" id="ThemeSelectdefaultedConfirm">Defaulted</h4></div>
                                <div className="modal-body">{i18n.t("THEME_CHANGE_TXT")}</div>
                                <div className="modal-footer"><button type="button" className="btn btn-default" data-dismiss="modal">{i18n.t("CANCEL")}</button><button type="button" data-theme="defaulted" data-click-handler="themeSelect" id="themeSelectdefaultedGo" className="btn btn-primary">{i18n.t("AGREE")}</button></div>
                            </div>
                        </div>
                    </div>
                    <div className="modal animate__bounceIn animate__animated" id="themeSelectsmokedConfirm" tabIndex={-1} role="dialog" aria-labelledby="ThemeSelectsmokedConfirm" aria-hidden="true">
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header"><button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 className="modal-title" id="ThemeSelectsmokedConfirm">Smoked</h4></div>
                                <div className="modal-body">{i18n.t("THEME_CHANGE_TXT")}</div>
                                <div className="modal-footer"><button type="button" className="btn btn-default" data-dismiss="modal">{i18n.t("CANCEL")}</button><button type="button" data-theme="smoked" data-click-handler="themeSelect" id="themeSelectsmokedGo" className="btn btn-primary">{i18n.t("AGREE")}</button></div>
                            </div>
                        </div>
                    </div>
                    <div className="modal animate__bounceIn animate__animated" id="sysResponse" tabIndex={-1} role="dialog" aria-labelledby="sysResponse" aria-hidden="true">
                        <div className="modal-dialog" style={{ width: "600px" }}>
                            <div className="modal-content" style={{ background: "rgba(0, 0, 0, 0.6)", border: "2px solid rgba(0, 0, 0, 0.2)" }}>
                                <div className="modal-header" style={{ background: "rgba(0, 0, 0, 0.4)", border: "0!important" }}>
                                    <h4 className="modal-title" style={{ color: "#fff" }}>{i18n.t("SYSTEM_RESPONSE_TITLE")}</h4>
                                </div>
                                <div className="modal-body ps" style={{ background: "rgba(0, 0, 0, 0.4)", maxHeight: "600px" }} id="sysPre">
                                    <pre style={{ color: "rgb(83, 223, 131)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }} className="sysout"><span id="sshoutput"></span></pre>
                                </div>
                                <div className="modal-footer" style={{ background: "rgba(0, 0, 0, 0.4)", border: "0!important" }}>
                                    <button data-click-handler="boxHandler" data-package="log" data-operation="clean" data-dismiss="modal" className="btn btn-xs btn-danger">{i18n.t("CLOSE_REFRESH")}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <script src="/lib/jquery-ui/jquery-ui.min.js"></script>
                <script src="/lib/jquery-ui-touch-punch/jquery.ui.touch-punch.min.js"></script>
                <script src="/lib/bootstrap/js/bootstrap.min.js"></script>
                <script src="/lib/visibility/visibility.fallback.js"></script>
                <script src="/lib/visibility/visibility.core.js"></script>
                <script src="/lib/visibility/visibility.timers.js"></script>
                <script src="/lib/socket.io/socket.io.min.js"></script>
                <script src="/lib/ansi_up/ansi_up.min.js"></script>
                <script src="/lib/lazysizes/lazysizes.min.js" async></script>
                <script src="/lib/bootbox/bootbox.all.min.js" async></script>
                <script src="/js/quick.js"></script>
                <script dangerouslySetInnerHTML={{ __html: CLIENT_SCRIPT(normalizedBasePath) }} />
                <script src="/lib/lobipanel/js/lobipanel.min.js"></script>
                <script src="/lib/jquery-toggles/toggles.min.js"></script>
                <script src="/lib/datatables/js/jquery.dataTables.min.js"></script>
                <script src="/lib/datatables/js/dataTables.bootstrap.min.js"></script>
            </body>
        </html>
    );
}

const CLIENT_BOOTSTRAP = (basePath: string) => `
(function () {
  var supported = ["da", "de", "en", "es", "fr", "zh"];
  var aliases = { "zh-cn": "zh", "zh-hans-cn": "zh" };
  function normalizeLocale(value) {
    if (typeof value !== "string") { return "en"; }
    var normalized = value.toLowerCase().replace("_", "-").replace(/^lang_/, "");
    normalized = aliases[normalized] || normalized;
    return supported.indexOf(normalized) >= 0 ? normalized : "en";
  }
  window.quickboxApiBase = ${JSON.stringify(basePath)};
  window.quickboxLocale = normalizeLocale(localStorage.getItem("quickbox:locale"));
  window.quickboxSetLocale = function (locale) {
    window.quickboxLocale = normalizeLocale(locale);
    localStorage.setItem("quickbox:locale", window.quickboxLocale);
    if (window.socket && window.socket.connected) {
      window.socket.emit("i18n", window.quickboxLocale);
    }
  };
  window.quickboxWidgetUrl = function (url) {
    var separator = url.indexOf("?") >= 0 ? "&" : "?";
    return window.quickboxApiBase + url + separator + "locale=" + encodeURIComponent(window.quickboxLocale);
  };
})();
`;

const CLIENT_SCRIPT = (basePath: string) => `
(function () {
  var socket = io(location.origin, { path: ${JSON.stringify(basePath + "/socket.io")} });
  window.socket = socket;
  socket.on("connect", function () {
    socket.emit("i18n", window.quickboxLocale || "en");
  });

  function resetPanel() {
    for (var i = localStorage.length - 1; i >= 0; i -= 1) {
      var key = localStorage.key(i);
      if (key && key.indexOf("lobipanel") === 0) {
        localStorage.removeItem(key);
      }
    }
    location.reload();
  }

  function fetchJson(url) {
    return fetch(window.quickboxWidgetUrl(url), { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) { throw new Error("Failed to fetch " + url); }
      return response.json();
    });
  }

  function fetchText(url) {
    return fetch(window.quickboxWidgetUrl(url), { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) { throw new Error("Failed to fetch " + url); }
      return response.text();
    });
  }

  var serviceStatusItems = [
    { service: "resilio-sync", id: "#appstat_resilio-sync" },
    { service: "smbd", id: "#appstat_smbd" },
    { service: "deluged", id: "#appstat_deluged" },
    { service: "deluge-web", id: "#appstat_deluge-web" },
    { service: "denyhosts", id: "#appstat_denyhosts" },
    { service: "emby-server", id: "#appstat_emby-server" },
    { service: "fail2ban", id: "#appstat_fail2ban" },
    { service: "filebrowser", id: "#appstat_filebrowser" },
    { service: "filebrowser-ee", id: "#appstat_filebrowser-ee" },
    { service: "flexget", id: "#appstat_flexget" },
    { service: "flood", id: "#appstat_flood" },
    { service: "jellyfin", id: "#appstat_jellyfin" },
    { service: "irssi", id: "#appstat_irssi" },
    { service: "netdata", id: "#appstat_netdata" },
    { service: "nfs-server", id: "#appstat_nfs-server" },
    { service: "tightvnc", id: "#appstat_tightvnc" },
    { service: "openvpn", id: "#appstat_openvpn" },
    { service: "peerbanhelper", id: "#appstat_peerbanhelper" },
    { service: "plexmediaserver", id: "#appstat_plexmediaserver" },
    { service: "rclone-web", id: "#appstat_rclone-web" },
    { service: "rtorrent", id: "#appstat_rtorrent" },
    { service: "sabnzbd", id: "#appstat_sabnzbd" },
    { service: "syncthing", id: "#appstat_syncthing" },
    { service: "transmission", id: "#appstat_transmission" },
    { service: "qbittorrent", id: "#appstat_qbittorrent" },
    { service: "qbittorrent-clientblocker", id: "#appstat_qbittorrent-clientblocker" },
    { service: "webdav", id: "#appstat_webdav" },
    { service: "vsftpd", id: "#appstat_vsftpd" },
    { service: "ttyd", id: "#appstat_ttyd" },
    { service: "x2go", id: "#appstat_x2go" },
    { service: "znc", id: "#appstat_znc" }
  ];

  function formatNetworkSpeed(length) {
    var suffixList = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
    var numeric = Number(length);
    var idx = 0;
    if (!isFinite(numeric) || numeric <= 0) {
      return "0 B/s";
    }
    while (numeric >= 1024 && idx < suffixList.length - 1) {
      numeric /= 1024;
      idx += 1;
    }
    return numeric.toFixed(idx > 0 ? 2 : 0) + " " + suffixList[idx];
  }

  function updateServiceStatus(response) {
    serviceStatusItems.forEach(function (item) {
      if (response[item.service] !== undefined) {
        window.jQuery(item.id).html(response[item.service]);
      }
    });
  }

  function initializeServiceToggles() {
    window.jQuery(".toggle-en, .toggle-dis").each(function () {
      var $toggle = window.jQuery(this);
      if ($toggle.parent(".toggle-slide").length > 0 || $toggle.parent(".toggle-modern").length > 0) {
        return;
      }
      $toggle.toggles({
        on: $toggle.hasClass("toggle-en"),
        height: 26,
        width: 100,
        text: $toggle.hasClass("toggle-en") ? { on: "Enabled" } : { off: "Disabled" }
      });
    });
    window.jQuery(".tooltips").tooltip();
  }

  function initializePackageTable() {
    var $ = window.jQuery;
    var currentPage = 0;
    if ($.fn.DataTable.isDataTable("#dataTable1")) {
      currentPage = $("#dataTable1").DataTable().page();
      $("#dataTable1").DataTable().destroy();
    }
    var table = $("#dataTable1").DataTable();
    $(table.table().container()).find("input[type='search']").attr({
      id: "dataTable1-search",
      name: "dataTable1-search"
    });
    if (currentPage > 0) {
      table.page(currentPage).draw(false);
    }
    $(".tooltips").tooltip();
  }

  function updateNetworkStatus(dataJSON) {
    if (window.ts === undefined || window.net === undefined) {
      window.net = dataJSON.net;
      window.ts = dataJSON.ts;
      return;
    }
    var duration = dataJSON.ts - window.ts;
    if (duration < 1e-5) {
      return;
    }
    var invalidData = false;
    Object.keys(dataJSON.net).forEach(function (networkInterface) {
      var previous = window.net[networkInterface];
      var current = dataJSON.net[networkInterface];
      if (!previous || !current) {
        invalidData = true;
        return;
      }
      var outSpeed = (current.tx_bytes - previous.tx_bytes) / duration;
      if (isNaN(outSpeed)) {
        invalidData = true;
        console.warn("[NaN DETECTED] " + networkInterface + "/tx", outSpeed, current, previous, duration);
      } else {
        window.jQuery("#net_" + networkInterface + "_tx").html(formatNetworkSpeed(outSpeed));
      }
      var inSpeed = (current.rx_bytes - previous.rx_bytes) / duration;
      if (isNaN(inSpeed)) {
        invalidData = true;
        console.warn("[NaN DETECTED] " + networkInterface + "/rx", inSpeed, current, previous, duration);
      } else {
        window.jQuery("#net_" + networkInterface + "_rx").html(formatNetworkSpeed(inSpeed));
      }
    });
    if (!invalidData) {
      window.net = dataJSON.net;
      window.ts = dataJSON.ts;
    }
  }

  function updateSshOutput(task, response) {
    var el = window.jQuery(task.id);
    if (typeof response === "object" && response !== null && "content" in response) {
      var previousEnd = task._endOffset;
      if (previousEnd < 0 || response.end < previousEnd || response.start > previousEnd) {
        el.text(response.content);
        task._endOffset = response.end;
      } else if (response.end > previousEnd && response.content) {
        var overlap = Math.max(0, previousEnd - response.start);
        var nextContent = overlap > 0 ? response.content.slice(overlap) : response.content;
        if (nextContent) {
          el.append(document.createTextNode(nextContent));
        }
        task._endOffset = response.end;
      }
    } else {
      el.text(response);
      task._endOffset = -1;
    }
    var container = document.getElementById("sysPre");
    if (window.__psSysPre) {
      window.__psSysPre.update();
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function createStatusTasks() {
    return [
      {
        key: "SERVICE_STATUS_ALL",
        url: "/node/service_status_all.php",
        override: updateServiceStatus,
        bootstrap: false,
        time: 5000
      },
      {
        key: "SERVICE_CONTROL",
        url: "/node/service_control.php",
        id: "#service_control_widget",
        after: initializeServiceToggles,
        bootstrap: true,
        time: 15000
      },
      {
        key: "PMC",
        url: "/node/pmc.php",
        id: "#pmc_widget",
        after: initializePackageTable,
        bootstrap: true,
        time: 30000
      },
      {
        key: "NETWORK",
        url: "/node/net_status.php",
        override: updateNetworkStatus,
        bootstrap: true,
        time: 1000
      },
      { key: "UPTIME", url: "/node/up.php", id: "#uptime", bootstrap: true, time: 60000 },
      { key: "TOP", url: "/node/load.php", id: "#cpuload", bootstrap: true, time: 60000 },
      {
        key: "BANDWIDTH",
        url: "/node/bw_tables.php",
        urlTemplate: "/node/bw_tables.php?page={0}",
        id: "#bw_tables",
        before: function (task) {
          var page = localStorage.getItem("bw_tables:page");
          if (page && page.length === 1 && "shdmt".indexOf(page) >= 0) {
            task.url = task.urlTemplate.replace("{0}", page);
          }
          return true;
        },
        bootstrap: true,
        time: 60000
      },
      { key: "DISK_USAGE", url: "/node/disk_data.php", id: "#disk_data", bootstrap: true, time: 15000 },
      { key: "RAM_USAGE", url: "/node/ram_stats.php", id: "#meterram", bootstrap: true, time: 10000 },
      {
        key: "SSH_OUTPUT",
        url: "/db/output.log",
        id: "#sshoutput",
        time: 2000,
        _endOffset: -1,
        _requestLength: 65536,
        before: function (task) {
          if (!window.jQuery("#sysResponse").is(":visible")) {
            return false;
          }
          if (task._endOffset >= 0) {
            task.url = "/db/output.log?offset=" + task._endOffset + "&length=" + task._requestLength;
          } else {
            task.url = "/db/output.log?length=" + task._requestLength;
          }
          return true;
        },
        override: function (response) {
          updateSshOutput(this, response);
        }
      }
    ];
  }

  function groupByTime(tasks) {
    return tasks.reduce(function (mapping, task) {
      var key = String(task.time);
      mapping[key] = mapping[key] || [];
      mapping[key].push(task);
      return mapping;
    }, {});
  }

  function startStatusUpdates() {
    var statusList = createStatusTasks();
    var taskMapping = {};
    var pendingRequests = {};
    var pendingRequestByKey = {};
    var firstRequest = true;
    var errorCount = 0;
    var bootstrapDispatched = false;
    var requestSeq = 0;
    var pendingRequestTimeoutMs = 15000;

    statusList.forEach(function (task) {
      if (task.key in taskMapping) {
        console.warn("[ws] status config key: " + task.key + " duplicated,", task);
        return;
      }
      taskMapping[task.key] = task;
    });

    function clearPendingRequestById(requestId) {
      var pending = pendingRequests[requestId];
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeoutId);
      if (pendingRequestByKey[pending.task.key] === requestId) {
        delete pendingRequestByKey[pending.task.key];
      }
      delete pendingRequests[requestId];
    }

    function clearAllPendingRequests(reason) {
      var requestIds = Object.keys(pendingRequests);
      requestIds.forEach(clearPendingRequestById);
      if (requestIds.length > 0) {
        console.warn("[ws] cleared " + requestIds.length + " pending request(s): " + reason);
      }
    }

    function queueTask(task, delay) {
      setTimeout(function () {
        var request = Object.assign({}, task);
        if (request.before && typeof request.before === "function" && request.before(request) === false) {
          return;
        }
        if (!((request.id && window.jQuery(request.id).length > 0) || request.override)) {
          return;
        }
        var pendingRequestId = pendingRequestByKey[request.key];
        if (pendingRequestId && pendingRequests[pendingRequestId]) {
          return;
        }
        request.requestId = request.key + ":" + (++requestSeq);
        var timeoutId = setTimeout(function () {
          if (pendingRequests[request.requestId]) {
            console.warn("[ws] request timed out: " + request.requestId);
            clearPendingRequestById(request.requestId);
            if (socket.connected) {
              queueTask(task, 0);
            }
          }
        }, pendingRequestTimeoutMs);
        pendingRequests[request.requestId] = {
          request: request,
          task: task,
          timeoutId: timeoutId
        };
        pendingRequestByKey[request.key] = request.requestId;
        socket.send(request);
      }, delay);
    }

    function dispatchBootstrapTasks() {
      if (bootstrapDispatched) {
        return;
      }
      bootstrapDispatched = true;
      var bootstrapTasks = statusList.filter(function (task) { return task.bootstrap; });
      bootstrapTasks.forEach(function (task, index) {
        queueTask(task, index * 50);
      });
      if (taskMapping.SERVICE_STATUS_ALL) {
        queueTask(taskMapping.SERVICE_STATUS_ALL, bootstrapTasks.length * 50 + 100);
      }
    }

    socket.on("message", function (response) {
      var pending = response.requestId ? pendingRequests[response.requestId] : undefined;
      var request = pending ? pending.request : undefined;
      var task = pending ? pending.task : taskMapping[response.key];
      if (response.requestId) {
        clearPendingRequestById(response.requestId);
      }
      if (response.success) {
        if (!task) {
          console.warn("[ws] task config not found,", response);
          return;
        }
        if (task.override && typeof task.override === "function") {
          task.override.call(task, response.response, response, request);
          return;
        }
        if (task.id !== undefined) {
          window.jQuery(task.id).html(response.response);
          if (task.after && typeof task.after === "function") {
            task.after(task);
          }
        } else {
          console.warn("[ws] DOM id not found, status won't update,", response);
        }
      } else {
        errorCount += 1;
        console.error("[ws] request failed,", response);
      }
      if (errorCount > 256) {
        console.warn("[ws] too many errors, stop status update");
        socket.close();
      }
    });

    socket.on("connect", function () {
      clearAllPendingRequests("socket reconnected");
      bootstrapDispatched = false;
      dispatchBootstrapTasks();
    });
    socket.on("disconnect", function () {
      clearAllPendingRequests("socket disconnected");
    });
    socket.on("connect_error", function () {
      clearAllPendingRequests("socket connect error");
    });

    if (socket.connected) {
      dispatchBootstrapTasks();
    }

    var taskInfo = groupByTime(statusList);
    Object.keys(taskInfo).forEach(function (timeString) {
      var timeInterval = parseInt(timeString, 10);
      var taskList = taskInfo[timeString];
      var taskEntity = function () {
        var delay = 0;
        taskList.forEach(function (task) {
          if (firstRequest === true && (task.bootstrap || task.key === "SERVICE_STATUS_ALL")) {
            return;
          }
          queueTask(task, delay);
          if (firstRequest === false) {
            delay += timeInterval / (taskList.length * 2);
          }
        });
      };
      Visibility.every(timeInterval, 10 * timeInterval, taskEntity);
      taskEntity();
    });
    firstRequest = false;
  }

  function showAlert(message) {
    if (window.bootbox && typeof window.bootbox.alert === "function") {
      window.bootbox.alert({
        message: message,
        backdrop: true,
        size: "large"
      });
      return;
    }
    window.alert(message);
  }

  socket.on("exec", function (response) {
    if (response && response.success === false) {
      var message = response.message || "";
      var output = response.stdout || response.stderr || "";
      output = output.replace(/\\u001b[()][B0UK]/g, "");
      if (window.AnsiUp) {
        output = new window.AnsiUp().ansi_to_html(output);
      }
      message = message + "<br><code>" + response.cmd + "</code>";
      if (output) {
        message += "<hr><div class='exec-output' style='display: inline-grid'>" + output + "</div>";
      }
      showAlert(message);
      return;
    }
    if (response && response.cmd && (response.cmd.indexOf("systemctl") === 0 || response.cmd.indexOf("box:lang") === 0)) {
      setTimeout(function () {
        location.reload();
      }, 100);
    }
  });

  function exec(command) {
    if (typeof command !== "string") {
      showAlert("Invalid service parameter: '" + command + "'");
      return;
    }
    socket.emit("exec", command);
  }

  function checkParameters(params) {
    if (!params || typeof params !== "object") {
      return true;
    }
    var missing = "";
    Object.keys(params).forEach(function (key) {
      if (!params[key]) {
        missing += "'" + key + "', ";
      }
    });
    missing = missing.replace(/, $/, "");
    if (missing) {
      showAlert("Parameter: " + missing + " required but not found");
      return false;
    }
    return true;
  }

  function closestDatasetTarget(initialTarget, datasetKey) {
    var target = initialTarget;
    while (target && target.dataset && target.dataset[datasetKey] === undefined) {
      target = target.parentElement;
    }
    return target;
  }

  function packageHandler(template) {
    return function (event) {
      if (!checkParameters({ event: event })) {
        return;
      }
      var target = event.target;
      if (!target || !target.dataset) {
        return;
      }
      exec(template + "::" + target.dataset.package);
    };
  }

  function serviceUpdateHandler(event) {
    if (!checkParameters({ event: event })) {
      return;
    }
    var target = closestDatasetTarget(event.target, "service");
    if (!target || !target.dataset) {
      return;
    }
    var service = target.dataset.service;
    var operations = target.dataset.operation || "";
    operations.split(",").forEach(function (operation) {
      exec("systemctl:" + operation + ":" + service);
    });
  }

  function boxHandler(event) {
    if (!checkParameters({ event: event })) {
      return;
    }
    var target = closestDatasetTarget(event.target, "package");
    if (!target || !target.dataset) {
      return;
    }
    exec("box:" + target.dataset.operation + ":" + target.dataset.package);
  }

  window.packageInstallHandler = packageHandler("installpackage");
  window.packageRemoveHandler = packageHandler("removepackage");
  window.serviceUpdateHandler = serviceUpdateHandler;
  window.boxHandler = boxHandler;

  function appendSmallOption(container, element) {
    if (!container) { return; }
    var wrapper = document.createElement("small");
    wrapper.appendChild(element);
    container.appendChild(wrapper);
  }

  function renderDashboardConfig(payload) {
    var labels = {
      t: "Top 10 days",
      h: "Recent hours",
      d: "Last 30 days",
      m: "Last 12 months"
    };
    var langContainer = document.getElementById("node-language-options");
    var themeContainer = document.getElementById("node-theme-options");
    var bwContainer = document.getElementById("node-bw-page-options");

    if (langContainer && Array.isArray(payload.languages)) {
      langContainer.innerHTML = "";
      payload.languages.forEach(function (lang) {
        var option = document.createElement("div");
        option.style.cursor = "pointer";
        option.dataset.locale = lang.key;
        option.onclick = function () {
          window.quickboxSetLocale(lang.key);
          location.reload();
        };
        var img = document.createElement("img");
        img.className = "lang-flag";
        img.src = "/lang/flag_" + lang.file + ".png";
        img.alt = "";
        img.setAttribute("aria-hidden", "true");
        option.appendChild(img);
        option.appendChild(document.createTextNode(lang.title));
        appendSmallOption(langContainer, option);
      });
    }

    if (themeContainer && Array.isArray(payload.themes)) {
      themeContainer.innerHTML = "";
      payload.themes.forEach(function (theme) {
        var option = document.createElement("div");
        option.style.cursor = "pointer";
        option.setAttribute("data-toggle", "modal");
        option.setAttribute("data-target", "#themeSelect" + theme.file + "Confirm");
        var img = document.createElement("img");
        img.className = "lang-flag";
        img.src = "/img/themes/opt_" + theme.file + ".png";
        img.alt = "";
        img.setAttribute("aria-hidden", "true");
        option.appendChild(img);
        option.appendChild(document.createTextNode(theme.title));
        appendSmallOption(themeContainer, option);
      });
    }

    if (bwContainer && Array.isArray(payload.bwPages)) {
      bwContainer.innerHTML = "";
      payload.bwPages.forEach(function (page) {
        var option = document.createElement("div");
        option.style.cursor = "pointer";
        option.onclick = function () {
          localStorage.setItem("bw_tables:page", page.key);
          location.reload();
        };
        option.textContent = labels[page.key] || page.title;
        appendSmallOption(bwContainer, option);
      });
    }
  }

  function renderNetworkInterfaces(interfaces) {
    var tbody = document.getElementById("node-network-interface-rows");
    if (!tbody) { return; }
    tbody.innerHTML = "";
    if (!Array.isArray(interfaces) || !interfaces.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 3;
      emptyCell.style.fontSize = "11px";
      emptyCell.style.padding = "4px 4px 4px 12px";
      emptyCell.textContent = "N/A";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }
    interfaces.forEach(function (iface) {
      var row = document.createElement("tr");
      row.innerHTML = "<td style='font-size:14px;font-weight:bold;padding:2px 2px 2px 12px'>" + iface + "</td>" +
        "<td style='font-size:11px;padding:2px 2px 2px 12px'><span class='text-success'><span id='net_" + iface + "_tx'>0B/s</span></span></td>" +
        "<td style='font-size:11px;padding:2px 2px 2px 12px'><span class='text-primary'><span id='net_" + iface + "_rx'>0B/s</span></span></td>";
      tbody.appendChild(row);
    });
  }

  function renderSystemStatic(payload) {
    var cpu = document.getElementById("node-cpu-static");
    if (cpu && payload && payload.cpu) {
      cpu.innerHTML = payload.cpu.modelHtml + "<br/>[<span style='color:#999;font-weight:600'>x" + payload.cpu.count + "</span> core]";
    }
    renderNetworkInterfaces(payload ? payload.interfaces : []);
  }

  function applyDashboardTheme(theme) {
    fetch(window.quickboxApiBase + "/node/theme", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: theme })
    }).then(function (response) {
      if (!response.ok) { throw new Error("Failed to apply theme"); }
      location.reload();
    }).catch(function (error) {
      console.warn("[ws] failed to apply theme", error);
    });
  }

  function loadNodeFragments() {
    fetchJson("/node/dashboard_config").then(renderDashboardConfig).catch(function (error) {
      console.warn("[ws] failed to load dashboard config", error);
    });
    fetchJson("/node/menu").then(function (payload) {
      var anchor = document.getElementById("node-menu-anchor");
      var loading = document.getElementById("node-menu-loading");
      var pluginTab = document.getElementById("node-plugin-tab");
      if (anchor) {
        anchor.insertAdjacentHTML("beforebegin", payload.mainMenuHtml || "");
        anchor.style.display = "none";
      }
      if (loading) { loading.remove(); }
      if (pluginTab && payload.showPluginTab) { pluginTab.style.display = ""; }
    }).catch(function (error) {
      console.warn("[ws] failed to load menu", error);
    });
    fetchText("/node/removal_modals").then(function (html) {
      var container = document.getElementById("node-removal-modals");
      if (container) { container.innerHTML = html; }
    }).catch(function (error) {
      console.warn("[ws] failed to load removal modals", error);
    });
    fetchJson("/node/system_static").then(renderSystemStatic).catch(function (error) {
      console.warn("[ws] failed to load static system info", error);
      renderNetworkInterfaces([]);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var reset = document.getElementById("node-panel-reset");
    if (reset) { reset.addEventListener("click", resetPanel); }
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof Element)) { return; }
      var themeButton = target.closest("[data-click-handler='themeSelect']");
      if (themeButton && themeButton instanceof HTMLElement && themeButton.dataset.theme) {
        applyDashboardTheme(themeButton.dataset.theme);
      }
      var packageInstallButton = target.closest("[data-click-handler='packageInstall']");
      if (packageInstallButton) {
        window.packageInstallHandler(event);
        return;
      }
      var packageRemoveButton = target.closest("[data-click-handler='packageRemove']");
      if (packageRemoveButton) {
        window.packageRemoveHandler(event);
        return;
      }
      var serviceUpdateButton = target.closest("[data-click-handler='serviceUpdate']");
      if (serviceUpdateButton) {
        window.serviceUpdateHandler(event);
        return;
      }
      var boxHandlerButton = target.closest("[data-click-handler='boxHandler']");
      if (boxHandlerButton) {
        window.boxHandler(event);
      }
    });
    loadNodeFragments();
    if (window.jQuery) {
      window.jQuery(function ($) {
        $(".tooltips").tooltip({ container: "body" });
      });
    }
    if (window.Visibility) {
      window.Visibility.afterPrerendering(startStatusUpdates);
    } else {
      startStatusUpdates();
    }
  });
})();
`;
