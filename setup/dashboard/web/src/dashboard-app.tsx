// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { BellOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, ConfigProvider, Layout, Row } from "antd";
import { useTranslation } from "react-i18next";

import type { DashboardBootstrapPayload } from "../../ws/src/shared/bootstrap-contract";
import { DashboardHeader, DashboardSidebar, type DashboardChromeProps } from "./components/dashboard-chrome";
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
import { SystemResponseSlot } from "./runtime/system-response-client";
import { getAntdThemeConfig, useDashboardTheme } from "./runtime/theme-store";
import { getAntdLocale, normalizeLocale } from "./i18n";

const BW_PAGE_TITLE_KEYS: Record<"t" | "h" | "d" | "m", string> = {
    t: "Top 10 days",
    h: "Recent hours",
    d: "Last 30 days",
    m: "Last 12 months",
};

export interface BootstrapRetryState {
    error: string;
    attempt: number;
    maxAttempts: number;
    exhausted: boolean;
}

export interface DashboardAppProps {
    bootstrap: DashboardBootstrapPayload;
    bootstrapReady?: boolean;
    bootstrapRetry?: BootstrapRetryState | null;
    onRetryBootstrap?: () => void;
}

export function DashboardApp({ bootstrap, bootstrapReady = true, bootstrapRetry = null, onRetryBootstrap }: DashboardAppProps) {
    const activeTheme = useDashboardTheme(bootstrap.serviceTheme);
    const { t, i18n } = useTranslation();
    const locale = normalizeLocale(i18n.language);
    const { config } = bootstrap.chrome;
    const chromeProps: DashboardChromeProps = {
        locale,
        config: {
            ...config,
            developerLabel: t("DEV_REPO_TXT", { branch: config.branch }),
            bwPages: config.bwPages.map((page) => ({
                ...page,
                title: t(BW_PAGE_TITLE_KEYS[page.key] ?? page.title),
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
                    <DashboardHeader props={chromeProps} theme={activeTheme} />
                </header>
                <Layout style={{ background: "transparent" }}>
                    <div id="quickbox-sidebar-root" className="leftpanel ps">
                        <DashboardSidebar props={chromeProps} theme={activeTheme} />
                    </div>
                    <Layout.Content className="mainpanel" style={{ background: "transparent" }}>
                        <div className="contentpanel">
                            {bootstrapRetry ? (
                                <Alert
                                    type={bootstrapRetry.exhausted ? "error" : "warning"}
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                    message={t("BACKEND_UNAVAILABLE_TITLE")}
                                    description={bootstrapRetry.exhausted
                                        ? t("BACKEND_RETRY_EXHAUSTED_DESC", { error: bootstrapRetry.error, max: bootstrapRetry.maxAttempts })
                                        : t("BACKEND_RETRYING_DESC", { error: bootstrapRetry.error, attempt: bootstrapRetry.attempt, max: bootstrapRetry.maxAttempts })}
                                    action={onRetryBootstrap ? (
                                        <Button size="small" type="primary" danger={bootstrapRetry.exhausted} onClick={onRetryBootstrap}>
                                            {t("RETRY")}
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
                                        title={<h4 className="panel-title">{pageLabels.bandwidthData}</h4>}
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
                                        title={<h4 className="panel-title">{pageLabels.bandwidthDetails}</h4>}
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
                                        title={<h4 className="panel-title text-success">{pageLabels.serverLoad}</h4>}
                                    >
                                        <Row className="qb-panel-split">
                                            <Col xs={24} md={18} className="qb-panel-main">
                                                <h4><span id="cpuload"><SystemLoadSlot /></span></h4>
                                                <p>{pageLabels.serverLoadText}</p>
                                            </Col>
                                            <Col xs={24} md={6} className="text-right qb-panel-icon">
                                                <span role="img" aria-hidden="true" className="anticon text-danger">
                                                    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" focusable="false">
                                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35zm-7.4-9.85h3.2l1.4-2.8 2.1 5.6 1.7-3.4 1.2 1.6h4.2v-1.5h-3.4l-2-2.6-1.7 3.4-2.1-5.6-2 4.1H4.6v1.2z" />
                                                    </svg>
                                                </span>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={24} className="mt20 text-center qb-uptime">
                                                <strong>{pageLabels.uptime}:</strong> <span id="uptime"><UptimeSlot bootstrap={bootstrap} /></span>
                                            </Col>
                                        </Row>
                                    </Card>
                                    <Card
                                        variant="borderless"
                                        className="panel panel-side panel-inverse"
                                        data-inner-id="panel-server-cpu"
                                        classNames={{ header: "panel-heading", body: "panel-body" }}
                                        styles={{ body: { overflow: "hidden" } }}
                                        title={<h4 className="panel-title">{pageLabels.cpuStatus}</h4>}
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
                                        title={<h4 className="panel-title">{pageLabels.diskStatus}</h4>}
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
                                        title={<h4 className="panel-title">{pageLabels.ramStatus}</h4>}
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
                                            <h4 className="panel-title text-success">
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
                                                    QuickBox :: <span style={{ color: "#fff", textShadow: "0px 0px 6px #fff" }}>{config.version}</span>
                                                </a>
                                            </h4>
                                        )}
                                    >
                                        <button
                                            data-click-handler="boxHandler"
                                            data-package="quickbox --only-core"
                                            data-operation="update"
                                            data-toggle="modal"
                                            data-target="#sysResponse"
                                            className="btn btn-success btn-quirk btn-block"
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
