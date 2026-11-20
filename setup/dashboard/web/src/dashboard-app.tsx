// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { BellOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, ConfigProvider, Layout, Row } from "antd";
import { useTranslation } from "react-i18next";

import type { DashboardBootstrapPayload } from "../../ws/src/shared/bootstrap-contract";
import { DashboardHeader, DashboardSidebar, type DashboardChromeProps } from "./components/dashboard-layout";
import {
    BandwidthTablesSlot,
    CpuStatusSlot,
    DiskDataSlot,
    MemoryStatsSlot,
    NetworkInterfaceRowsSlot,
    PackageManagementSlot,
    RunningTaskSlot,
    SystemLoadSlot,
    UptimeSlot,
} from "./runtime/data-slots";
import { ServiceControlSlot } from "./runtime/service-control-client";
import { executeBoxAction, useCommandConnection, type BackendRetryState } from "./runtime/dashboard-runtime-client";
import { SystemResponseSlot } from "./runtime/system-response-client";
import { getAntdThemeConfig, useDashboardTheme } from "./runtime/theme-store";
import { getAntdLocale, normalizeLocale } from "./i18n";

const LANGUAGE_TITLES: Record<string, string> = {
    da: "Dansk",
    de: "Deutsch",
    en: "English",
    es: "Español",
    fr: "Français",
    zh: "中文 (简体)",
};

const THEME_TITLES: Record<string, string> = {
    defaulted: "Defaulted",
    smoked: "Smoked",
};

const BW_PAGE_TITLE_KEYS: Record<"t" | "h" | "d" | "m", string> = {
    t: "Top 10 days",
    h: "Recent hours",
    d: "Last 30 days",
    m: "Last 12 months",
};

export interface DashboardAppProps {
    bootstrap: DashboardBootstrapPayload;
    bootstrapReady?: boolean;
    backendRetry?: BackendRetryState | null;
    onRetryBackend?: () => void;
}

export function DashboardApp({ bootstrap, bootstrapReady = true, backendRetry = null, onRetryBackend }: DashboardAppProps) {
    const activeTheme = useDashboardTheme(bootstrap.serviceTheme);
    const commandsConnected = useCommandConnection();
    const { t, i18n } = useTranslation();
    let retryDescription: string | undefined;
    if (backendRetry) {
        const { error, attempt, maxAttempts, exhausted } = backendRetry;
        retryDescription = exhausted
            ? attempt === 0
                ? t("BACKEND_DISCONNECTED_DESC", { error })
                : t("BACKEND_RETRY_EXHAUSTED_DESC", { error, max: attempt })
            : t("BACKEND_RETRYING_DESC", { error, attempt, max: maxAttempts });
    }
    const locale = normalizeLocale(i18n.language);
    const { config } = bootstrap.chrome;
    const chromeProps: DashboardChromeProps = {
        locale,
        config: {
            ...config,
            developerLabel: t("DEV_REPO_TXT", { branch: config.branch }),
            languages: config.languages.map((language) => ({
                ...language,
                title: LANGUAGE_TITLES[language.key] ?? language.key,
            })),
            themes: config.themes.map((theme) => ({
                ...theme,
                title: THEME_TITLES[theme.file] ?? theme.file,
            })),
            bwPages: config.bwPages.map((page) => ({
                ...page,
                title: t(BW_PAGE_TITLE_KEYS[page.key]),
            })),
        },
        menuState: bootstrap.chrome.menuState,
        labels: {
            language: t("LANG_SELECT"),
            theme: t("THEME_SELECT"),
            bandwidth: t("BW_SELECT"),
            panelConfig: t("PANEL_CONFIG"),
            panelReset: t("PANEL_RESET"),
            themeChange: t("THEME_CHANGE_TXT"),
            cancel: t("CANCEL"),
            agree: t("AGREE"),
            mainMenu: t("MAIN_MENU"),
            pluginMenu: t("RPLUGIN_MENU"),
            helpCommands: t("HELP_COMMANDS"),
            downloads: t("DOWNLOADS"),
            webConsole: t("WEB_CONSOLE"),
            quickSystemTips: t("QUICK_SYSTEM_TIPS"),
            seedboxCommands: t("SEEDBOX_COMMANDS"),
            essentialUserCommands: t("ESSENTIAL_USER_COMMANDS"),
            systemUpgrade: t("SYS_UPGRADE_TXT"),
            setLanguage: t("SET_LANG_TXT"),
            changeInterface: t("CHANGEINTERFACE_TXT"),
            cleanMemory: t("CLEAN_MEM_TXT"),
            cleanLog: t("CLEAN_LOG_TXT"),
            diskTest: t("DISKTEST_TXT"),
            appInstall: t("APP_INSTALL_TXT"),
            appUninstall: t("APP_UNINSTALL_TXT"),
            appUpgrade: t("APP_UPGRADE_TXT"),
            changePassword: t("CHANGEUSERPASS_TXT"),
            fixDpkg: t("FIX_DPKG_TXT"),
            troubleshoot: t("TROUBLESHOOT_TXT"),
            restartRtorrent: t("SCREEN_RTORRNENT_TXT"),
            switchDev: t("SWITCH_DEV"),
            switchMaster: t("SWITCH_MASTER"),
            branchOther: t("BRANCH_OTHER"),
            branchSwitch: t("BRANCH_SWITCH"),
            branchCurrent: t("BRANCH_CURRENT"),
            branchTarget: t("BRANCH_TARGET"),
            branchLoading: t("BRANCH_LOADING"),
            branchListError: t("BRANCH_LIST_ERROR"),
            branchWarning: t("BRANCH_WARNING"),
            branchLoadFailed: t("BRANCH_LOAD_FAILED"),
            branchSelect: t("BRANCH_SELECT"),
            branchRetry: t("BRANCH_RETRY"),
            branchUpdate: t("BRANCH_UPDATE"),
            branchSwitchAction: t("BRANCH_SWITCH_ACTION"),
            ssoLogout: t("SSO_LOGOUT_TXT"),
            issueReport: t("ISSUE_REPORT_TXT"),
        },
    };
    const pageLabels = {
        bandwidthData: t("BANDWIDTH_DATA"),
        network: t("NETWORK"),
        upload: t("UPLOAD"),
        download: t("DOWNLOAD"),
        bandwidthDetails: t("VIEW_ADDITIONAL_BANDWIDTH_DETAILS"),
        serverLoad: t("SERVER_LOAD"),
        serverLoadText: t("SL_TXT"),
        uptime: t("UPTIME"),
        cpuStatus: t("CPU_STATUS"),
        diskStatus: t("YOUR_DISK_STATUS"),
        ramStatus: t("SYSTEM_RAM_STATUS"),
        recentUpdates: t("RECENT_UPDATES"),
        changelogTitle: t("CURRENT_VERSIONS_CHANGELOG"),
        update: t("UPDATE"),
    };

    return (
        <ConfigProvider locale={getAntdLocale(locale)} theme={getAntdThemeConfig(activeTheme)}>
            <Layout className="dashboard-layout" style={{ background: "transparent" }}>
                <header id="quickbox-header-root">
                    <h1 className="sr-only">QuickBox Dashboard</h1>
                    <DashboardHeader props={chromeProps} theme={activeTheme} />
                </header>
                <Layout style={{ background: "transparent" }}>
                    <div id="quickbox-sidebar-root" className="leftpanel ps">
                        <DashboardSidebar props={chromeProps} theme={activeTheme} />
                    </div>
                    <Layout.Content className="mainpanel" style={{ background: "transparent" }}>
                        <div className="contentpanel">
                            {backendRetry ? (
                                <Alert
                                    type={backendRetry.exhausted ? "error" : "warning"}
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                    title={t("BACKEND_UNAVAILABLE_TITLE")}
                                    description={retryDescription}
                                    action={onRetryBackend ? (
                                        <Button size="small" type="primary" danger={backendRetry.exhausted} onClick={onRetryBackend}>
                                            {t(bootstrapReady ? "BACKEND_RECONNECT" : "RETRY")}
                                        </Button>
                                    ) : undefined}
                                />
                            ) : null}
                            <div id="running_task_widget">
                                <RunningTaskSlot />
                            </div>
                            <Row gutter={20}>
                                <Col xs={24} lg={16} data-inner-id="left-panel-container">
                                    <Card
                                        variant="borderless"
                                        className="panel panel-main panel-inverse"
                                        data-inner-id="panel-server-bandwidth-interface"
                                        classNames={{ header: "panel-heading", body: "panel-footer panel-statistics" }}
                                        styles={{ body: { padding: 0 } }}
                                        title={<h2 className="panel-title">{pageLabels.bandwidthData}</h2>}
                                    >
                                        <Row>
                                            <Col span={24}>
                                                <div className="table-responsive">
                                                    <table className="table table-hover table-bordered nomargin">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{pageLabels.network}</th>
                                                                <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{pageLabels.upload}</th>
                                                                <th style={{ width: "33%", padding: "4px 4px 4px 12px" }}>{pageLabels.download}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody id="node-network-interface-rows">
                                                            <NetworkInterfaceRowsSlot />
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card>
                                    <Card
                                        variant="borderless"
                                        className="panel panel-inverse"
                                        data-inner-id="panel-server-bandwidth-details"
                                        classNames={{ header: "panel-heading", body: "panel-body" }}
                                        styles={{ body: { padding: 0 } }}
                                        title={<h2 className="panel-title">{pageLabels.bandwidthDetails}</h2>}
                                    >
                                        <div id="bw_tables" style={{ padding: 0, margin: 0 }}>
                                            <BandwidthTablesSlot />
                                        </div>
                                    </Card>
                                    <div id="service_control_widget">
                                        <ServiceControlSlot bootstrap={bootstrap} ready={bootstrapReady} />
                                    </div>
                                    <div id="pmc_widget">
                                        <PackageManagementSlot bootstrap={bootstrap} ready={bootstrapReady} />
                                    </div>
                                </Col>
                                <Col xs={24} lg={8} className="dash-right" data-inner-id="right-panel-container">
                                    <Card
                                        variant="borderless"
                                        className="panel panel-side panel-inverse-full panel-updates"
                                        data-inner-id="panel-server-load"
                                        classNames={{ header: "panel-heading", body: "panel-body" }}
                                        title={<h2 className="panel-title text-success">{pageLabels.serverLoad}</h2>}
                                    >
                                        <Row className="qb-panel-split">
                                            <Col xs={24} md={18} className="qb-panel-main">
                                                <div className="qb-stat-heading"><span id="cpuload"><SystemLoadSlot /></span></div>
                                                <p>{pageLabels.serverLoadText}</p>
                                            </Col>
                                            <Col xs={24} md={6} className="text-right qb-panel-icon">
                                                <span role="img" aria-hidden="true" className="anticon text-danger">
                                                    <svg viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" focusable="false">
                                                        {/* Font Awesome Free 6.7.2 heart-pulse, CC BY 4.0: https://fontawesome.com/license/free */}
                                                        <path d="M228.3 469.1L47.6 300.4c-4.2-3.9-8.2-8.1-11.9-12.4l87 0c22.6 0 43-13.6 51.7-34.5l10.5-25.2 49.3 109.5c3.8 8.5 12.1 14 21.4 14.1s17.8-5 22-13.3L320 253.7l1.7 3.4c9.5 19 28.9 31 50.1 31l104.5 0c-3.7 4.3-7.7 8.5-11.9 12.4L283.7 469.1c-7.5 7-17.4 10.9-27.7 10.9s-20.2-3.9-27.7-10.9zM503.7 240l-132 0c-3 0-5.8-1.7-7.2-4.4l-23.2-46.3c-4.1-8.1-12.4-13.3-21.5-13.3s-17.4 5.1-21.5 13.3l-41.4 82.8L205.9 158.2c-3.9-8.7-12.7-14.3-22.2-14.1s-18.1 5.9-21.8 14.8l-31.8 76.3c-1.2 3-4.2 4.9-7.4 4.9L16 240c-2.6 0-5 .4-7.3 1.1C3 225.2 0 208.2 0 190.9l0-5.8c0-69.9 50.5-129.5 119.4-141C165 36.5 211.4 51.4 244 84l12 12 12-12c32.6-32.6 79-47.5 124.6-39.9C461.5 55.6 512 115.2 512 185.1l0 5.8c0 16.9-2.8 33.5-8.3 49.1z" />
                                                    </svg>
                                                </span>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={24} className="mt20 text-center qb-uptime">
                                                <strong>{pageLabels.uptime}:</strong> <span id="uptime"><UptimeSlot /></span>
                                            </Col>
                                        </Row>
                                    </Card>
                                    <Card
                                        variant="borderless"
                                        className="panel panel-side panel-inverse"
                                        data-inner-id="panel-server-cpu"
                                        classNames={{ header: "panel-heading", body: "panel-body" }}
                                        styles={{ body: { overflow: "hidden" } }}
                                        title={<h2 className="panel-title">{pageLabels.cpuStatus}</h2>}
                                    >
                                        <span id="node-cpu-static" className="nomargin" style={{ fontSize: "14px" }}>
                                            <CpuStatusSlot />
                                        </span>
                                    </Card>
                                    <Card
                                        variant="borderless"
                                        className="panel panel-side panel-inverse"
                                        data-inner-id="panel-server-disk"
                                        classNames={{ header: "panel-heading", body: "panel-body" }}
                                        title={<h2 className="panel-title">{pageLabels.diskStatus}</h2>}
                                    >
                                        <div id="disk_data">
                                            <DiskDataSlot />
                                        </div>
                                    </Card>
                                    <Card
                                        variant="borderless"
                                        className="panel panel-side panel-inverse"
                                        data-inner-id="panel-server-ram"
                                        classNames={{ header: "panel-heading", body: "panel-body" }}
                                        title={<h2 className="panel-title">{pageLabels.ramStatus}</h2>}
                                    >
                                        <div id="meterram">
                                            <MemoryStatsSlot />
                                        </div>
                                    </Card>
                                    <Card
                                        variant="borderless"
                                        className="panel panel-inverse"
                                        id="project-commits"
                                        data-inner-id="panel-server-update"
                                        classNames={{ header: "panel-heading", body: "panel-footer" }}
                                        title={(
                                            <h2 className="panel-title text-success">
                                                {pageLabels.recentUpdates}{" "}
                                                <a
                                                    href={`https://github.com/amefs/quickbox-lite/blob/${config.branch}/CHANGELOG.md#changelog-${config.version.replaceAll(".", "")}`}
                                                    title={pageLabels.changelogTitle}
                                                    data-placement="top"
                                                    className="label label-primary tooltips"
                                                    style={{ fontSize: "10px", paddingTop: 0, paddingBottom: "0px", top: "-2px", position: "relative" }}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    QuickBox :: {config.version}
                                                </a>
                                            </h2>
                                        )}
                                    >
                                        <button
                                            type="button"
                                            className="btn btn-success btn-quirk btn-block"
                                            disabled={!commandsConnected}
                                            onClick={() => { executeBoxAction("update", "quickbox --only-core", true); }}
                                        >
                                            <BellOutlined className="text-success" aria-hidden="true" /> {pageLabels.update}
                                        </button>
                                    </Card>
                                </Col>
                            </Row>
                        </div>
                    </Layout.Content>
                    <div id="quickbox-system-response-root">
                        <SystemResponseSlot bootstrap={bootstrap} />
                    </div>
                </Layout>
            </Layout>
        </ConfigProvider>
    );
}
