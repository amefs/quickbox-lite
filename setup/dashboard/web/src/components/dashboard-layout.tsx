// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Trans, useTranslation } from "react-i18next";
import {
    AppstoreOutlined,
    CodeOutlined,
    DownloadOutlined,
    DownOutlined,
    EllipsisOutlined,
    LogoutOutlined,
    MenuOutlined,
    QuestionCircleOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import { Button, ConfigProvider, Modal, Switch, Tooltip } from "antd";

import { BANDWIDTH_PAGE_TITLE_KEYS, normalizeLocale } from "../i18n";
import { selectFrontendTheme, getAntdThemeConfig } from "../runtime/theme-store";
import { switchDashboardBranch, updateRuntimeLocale, useCommandConnection } from "../runtime/dashboard-runtime-client";
import type { DashboardChromeConfig, DashboardChromeMenuState } from "../../../ws/src/shared/bootstrap-contract";
import { isDashboardTheme, type DashboardTheme } from "../../../ws/src/shared/theme";

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

const usernameUrl = (url: string, username: string) => url.replaceAll("$username$", username);

function isBranchName(value: unknown): value is string {
    if (typeof value !== "string" || value === "" || value.startsWith("-") || value.includes(":")) {return false;}
    for (const character of value) {
        const code = character.charCodeAt(0);
        if (code <= 32 || code === 127) {return false;}
    }
    return true;
}

function applyTheme(theme: string) {
    if (!isDashboardTheme(theme)) {
        console.warn("[ws] ignored unknown theme", theme);
        return;
    }
    selectFrontendTheme(theme);
    void fetch(`${window.quickboxApiBase ?? ""}/node/theme`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
    }).catch((error: unknown) => {
        console.warn("[ws] failed to persist theme on server", error);
    });
}

interface RutorrentPlugin {
    name: string;
    label?: string;
    installed: boolean;
}

function parseRutorrentPlugins(value: unknown): RutorrentPlugin[] {
    if (value === null || typeof value !== "object" || !("plugins" in value) || !Array.isArray(value.plugins)) {
        return [];
    }
    return value.plugins.filter((plugin: unknown): plugin is RutorrentPlugin => {
        if (plugin === null || typeof plugin !== "object") {
            return false;
        }
        const record = plugin as Record<string, unknown>;
        return typeof record.name === "string" && typeof record.installed === "boolean" &&
            (record.label === undefined || typeof record.label === "string");
    });
}

function RutorrentPluginList({ visible }: { visible: boolean }) {
    const { t } = useTranslation();
    const [plugins, setPlugins] = React.useState<RutorrentPlugin[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [pendingPlugin, setPendingPlugin] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const loadPlugins = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${window.quickboxApiBase ?? ""}/node/plugins`, { credentials: "same-origin" });
            if (!response.ok) {throw new Error("Plugin list request failed");}
            setPlugins(parseRutorrentPlugins(await response.json()));
        } catch {
            setError(t("PLUGIN_LOAD_FAILED"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    React.useEffect(() => {
        if (visible) {void loadPlugins();}
    }, [loadPlugins, visible]);

    const togglePlugin = async (plugin: RutorrentPlugin) => {
        setPendingPlugin(plugin.name);
        setError(null);
        try {
            const response = await fetch(`${window.quickboxApiBase ?? ""}/node/plugin`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plugin: plugin.name, action: plugin.installed ? "remove" : "install" }),
            });
            if (!response.ok) {throw new Error("Plugin action failed");}
            await loadPlugins();
        } catch {
            setError(t("PLUGIN_ACTION_FAILED"));
        } finally {
            setPendingPlugin(null);
        }
    };

    return (
        <>
            {loading && plugins.length === 0 ? <li className="qb-plugin-status" role="status" style={{ padding: "8px 15px" }}>{t("PLUGIN_LOADING")}</li> : null}
            {error ? <li className="qb-plugin-status text-danger" role="alert" style={{ padding: "8px 15px" }}>{error}</li> : null}
            {plugins.map((plugin) => {
                const isPending = pendingPlugin === plugin.name;
                return (
                    <li key={plugin.name} className="qb-plugin-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 15px" }}>
                        <a href="#" onClick={(event) => { event.preventDefault(); }} style={{ padding: 0 }}>{plugin.label ?? plugin.name}</a>
                        <Switch
                            size="small"
                            checked={plugin.installed}
                            loading={isPending}
                            disabled={loading || pendingPlugin !== null}
                            checkedChildren={t("INSTALLED")}
                            unCheckedChildren={t("INSTALL")}
                            aria-label={plugin.label ?? plugin.name}
                            onChange={() => { void togglePlugin(plugin); }}
                        />
                    </li>
                );
            })}
        </>
    );
}

function resetPanels() {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith("lobipanel")) {localStorage.removeItem(key);}
    }
    window.location.reload();
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
    React.useEffect(() => {
        if (!open) {return;}
        const onPointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !ref.current?.contains(event.target)) {close();}
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {close();}
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [close, open, ref]);
}

interface BranchSwitchDialogProps {
    open: boolean;
    mode: string;
    branch: string;
    branchCommit?: string;
    onCancel: () => void;
    onSwitch: (branch: string) => void;
}

function BranchSwitchDialog({ open, mode, branch, branchCommit, onCancel, onSwitch }: BranchSwitchDialogProps) {
    const { t, i18n } = useTranslation();
    const locale = normalizeLocale(i18n.language);
    const commandsConnected = useCommandConnection();
    const [branches, setBranches] = React.useState<string[]>([]);
    const [selectedBranch, setSelectedBranch] = React.useState("");
    const [branchesLoading, setBranchesLoading] = React.useState(false);
    const [branchError, setBranchError] = React.useState(false);
    const branchRequest = React.useRef(0);
    const fixedTarget = mode === "master" || mode === "development";

    const loadBranches = React.useCallback(async () => {
        const request = ++branchRequest.current;
        setBranchesLoading(true);
        setBranchError(false);
        setBranches([]);
        setSelectedBranch("");
        try {
            const response = await fetch(`${window.quickboxApiBase || ""}/node/branches?locale=${encodeURIComponent(locale)}`, { credentials: "same-origin" });
            if (!response.ok) {throw new Error("Failed to load branches");}
            const payload: unknown = await response.json();
            const remoteBranches = payload !== null && typeof payload === "object" && "branches" in payload && Array.isArray(payload.branches)
                ? payload.branches.filter(isBranchName)
                : [];
            if (remoteBranches.length === 0) {throw new Error("No branches available");}
            if (request !== branchRequest.current) {return;}
            const availableBranches = [...new Set(remoteBranches)];
            setBranches(availableBranches);
            setSelectedBranch(availableBranches.includes(branch) ? branch : "");
        } catch {
            if (request === branchRequest.current) {setBranchError(true);}
        } finally {
            if (request === branchRequest.current) {setBranchesLoading(false);}
        }
    }, [branch, locale]);

    React.useEffect(() => {
        if (!open || fixedTarget) {
            branchRequest.current += 1;
            return;
        }
        void loadBranches();
        return () => { branchRequest.current += 1; };
    }, [fixedTarget, loadBranches, open]);

    const targetBranch = fixedTarget ? mode : selectedBranch;

    return (
        <Modal
            open={open}
            title={t("BRANCH_SWITCH")}
            width={500}
            centered
            zIndex={2200}
            wrapProps={{ id: "branchSwitch" }}
            classNames={{ wrapper: "qb-branch-switch-wrap" }}
            onCancel={onCancel}
            footer={(
                <>
                    <Button data-dismiss="modal" onClick={onCancel}>{t("CANCEL")}</Button>
                    <Button
                        id="branchSwitchGo"
                        type="primary"
                        disabled={!commandsConnected || !isBranchName(targetBranch) || branchesLoading || branchError}
                        data-update={t("BRANCH_UPDATE")}
                        data-switch={t("BRANCH_SWITCH_ACTION")}
                        onClick={() => { if (isBranchName(targetBranch)) {onSwitch(targetBranch);} }}
                    >
                        {t(!fixedTarget && selectedBranch === branch ? "BRANCH_UPDATE" : "BRANCH_SWITCH_ACTION")}
                    </Button>
                </>
            )}
        >
            <div className="branch-current"><div className="branch-label">{t("BRANCH_CURRENT")}</div><div className="branch-value">{branch}{branchCommit ? <span className="branch-commit">{" "}{branchCommit.slice(0, 12)}</span> : null}</div></div>
            <div className="branch-label" id="branchTargetLabel">{t("BRANCH_TARGET")}</div>
            <div id="branchFixedTarget" className="branch-value" hidden={!fixedTarget}>{fixedTarget ? mode : ""}</div>
            <div id="branchSelectContainer" className="branch-select" hidden={fixedTarget}>
                <select id="branchTarget" aria-labelledby="branchTargetLabel" data-current={branch} className="form-control input-sm" disabled={fixedTarget || branchesLoading || branchError} value={selectedBranch} onChange={(event) => { setSelectedBranch(event.target.value); }}>
                    {branchesLoading ? <option value="">{t("BRANCH_LOADING")}</option> : null}
                    {branchError ? <option value="">{t("BRANCH_LOAD_FAILED")}</option> : null}
                    {!branchesLoading && !branchError ? <option value="">{t("BRANCH_SELECT")}</option> : null}
                    {branches.map((remoteBranch) => <option key={remoteBranch} value={remoteBranch}>{remoteBranch}</option>)}
                </select>
            </div>
            <p id="branchError" className="text-danger" role="alert" hidden={!branchError}>{t("BRANCH_LIST_ERROR")} <button type="button" id="branchRetry" className="btn btn-link" onClick={() => {void loadBranches();}}>{t("BRANCH_RETRY")}</button></p>
            <p className="branch-warning">{t("BRANCH_WARNING")}</p>
        </Modal>
    );
}

export function DashboardHeader({ config, theme = "defaulted" }: { config: DashboardChromeConfig; theme?: DashboardTheme }) {
    const { t } = useTranslation();
    const [noticeOpen, setNoticeOpen] = React.useState(false);
    const [accountOpen, setAccountOpen] = React.useState(false);
    const [activeNoticeTab, setActiveNoticeTab] = React.useState("quickplus");
    const [branchModalOpen, setBranchModalOpen] = React.useState(false);
    const [branchMode, setBranchMode] = React.useState("");
    const noticeRef = React.useRef<HTMLDivElement>(null);
    const accountRef = React.useRef<HTMLDivElement>(null);
    const closeNotice = React.useCallback(() => { setNoticeOpen(false); }, []);
    const closeAccount = React.useCallback(() => { setAccountOpen(false); }, []);
    useOutsideClose(noticeRef, noticeOpen, closeNotice);
    useOutsideClose(accountRef, accountOpen, closeAccount);

    const openBranchSwitch = React.useCallback((mode: string) => {
        setBranchMode(mode === "master" || mode === "development" ? mode : "");
        setBranchModalOpen(true);
        setAccountOpen(false);
    }, []);

    const closeBranchSwitch = React.useCallback(() => {
        setBranchModalOpen(false);
    }, []);
    const confirmBranchSwitch = (targetBranch: string) => {
        closeBranchSwitch();
        switchDashboardBranch(targetBranch);
    };

    React.useEffect(() => {
        const wideViewport = window.matchMedia("(min-width: 1280px)");
        const activeAnimations = new WeakMap<HTMLElement, Animation>();
        const resetOffsets = () => {
            document.querySelectorAll<HTMLElement>(".mainpanel, .logopanel, .leftpanel, .headerbar").forEach((element) => {
                activeAnimations.get(element)?.cancel();
                activeAnimations.delete(element);
                element.style.removeProperty("left");
                element.style.removeProperty("margin-left");
            });
            document.body.style.removeProperty("overflow");
        };
        const animateOffset = (element: HTMLElement, property: "left" | "marginLeft", target: number) => {
            const current = getComputedStyle(element).getPropertyValue(property === "marginLeft" ? "margin-left" : property);
            activeAnimations.get(element)?.cancel();
            const animation = element.animate(
                [{ [property]: current }, { [property]: `${target}px` }],
                { duration: 200, easing: "ease", fill: "both" },
            );
            activeAnimations.set(element, animation);
            animation.onfinish = () => {
                if (activeAnimations.get(element) !== animation) {return;}
                if (property === "left") {element.style.left = `${target}px`;}
                else {element.style.marginLeft = `${target}px`;}
                activeAnimations.delete(element);
                animation.cancel();
            };
        };
        const onMenuToggle = (event: Event) => {
            event.preventDefault();
            const main = document.querySelector<HTMLElement>(".mainpanel");
            const logo = document.querySelector<HTMLElement>(".logopanel");
            const side = document.querySelector<HTMLElement>(".leftpanel");
            const bar = document.querySelector<HTMLElement>(".headerbar");
            if (!main || !logo || !side || !bar) {return;}
            const mobile = getComputedStyle(main).position === "relative";
            const activeOffset = mobile ? getComputedStyle(main).left : getComputedStyle(main).marginLeft;
            const opening = Number.parseFloat(activeOffset) !== 280;
            const sideOffset = opening ? 0 : -280;
            const mainOffset = opening ? 280 : 0;
            const property = mobile ? "left" : "marginLeft";
            if (mobile) {document.body.style.overflow = opening ? "hidden" : "";}
            animateOffset(logo, property, sideOffset);
            animateOffset(side, property, sideOffset);
            animateOffset(bar, property, mainOffset);
            animateOffset(main, property, mainOffset);
        };
        document.getElementById("menuToggle")?.addEventListener("click", onMenuToggle);
        wideViewport.addEventListener("change", resetOffsets);
        return () => {
            document.getElementById("menuToggle")?.removeEventListener("click", onMenuToggle);
            wideViewport.removeEventListener("change", resetOffsets);
            resetOffsets();
        };
    }, []);

    const configTabs = [
        { key: "quickplus", title: "QuickBox+" },
        { key: "dashadjust", title: "Dashboard" },
        { key: "configure", title: "Config" },
    ];

    return (
        <ConfigProvider theme={getAntdThemeConfig(theme)}>
            <div className="headerpanel">
                <div className="logopanel">
                    <h2><a href="#"><img src="/img/logo-light.png" alt="QuickBox Seedbox" className="logo-image" width="222" height="50" /></a></h2>
                </div>
                <div className="headerbar">
                    <a id="menuToggle" className="menutoggle" href="#" aria-label="Toggle sidebar"><MenuOutlined aria-hidden="true" /></a>
                    <div className="header-right">
                        <ul className="headermenu">
                            {config.showDeveloper ? <li className="header-branch"><div className="btn-group"><span className="label label-warning" title={config.branch}><span className="header-branch-description">{t("DEV_REPO_TXT", { branch: config.branch })}</span><span className="header-branch-name">{config.branch}</span></span></div></li> : null}
                            <li>
                                <div id="noticePanel" className={`btn-group${noticeOpen ? " open" : ""}`} ref={noticeRef}>
                                    <button className="btn" type="button" aria-expanded={noticeOpen} aria-controls="noticeDropdown" onClick={() => { setNoticeOpen((open) => !open); }}>
                                        <span className="header-menu-full">QuickBox Lite Menu</span><span className="header-menu-short">Menu</span> <span className="caret"></span>
                                    </button>
                                    <div id="noticeDropdown" className="dropdown-menu dm-notice pull-right" role="menu">
                                        <div role="tabpanel">
                                            <ul className="nav nav-tabs nav-justified" role="tablist">
                                                {configTabs.map((tab) => <li key={tab.key} className={activeNoticeTab === tab.key ? "active" : ""} role="presentation"><a href={`#${tab.key}`} role="tab" aria-selected={activeNoticeTab === tab.key} data-target={`#${tab.key}`} onClick={(event) => { event.preventDefault(); setActiveNoticeTab(tab.key); }}>{tab.title}</a></li>)}
                                            </ul>
                                            <div className="tab-content">
                                                <div role="tabpanel" className={`tab-pane${activeNoticeTab === "quickplus" ? " active" : ""}`} id="quickplus">
                                                    <ul className="list-group"><li className="list-group-item"><h5>QuickBox :: <span style={{ color: "#fff", textShadow: "0px 0px 6px #fff" }}>{config.version}</span></h5><small><a href="https://github.com/amefs/quickbox-lite/blob/master/README.md" target="_blank" rel="noopener noreferrer">README.md</a></small><small><a href={`https://github.com/amefs/quickbox-lite/blob/master/CHANGELOG.md#changelog-${config.version}`} target="_blank" rel="noopener noreferrer">CHANGELOG</a></small></li></ul>
                                                </div>
                                                <div role="tabpanel" className={`tab-pane${activeNoticeTab === "dashadjust" ? " active" : ""}`} id="dashadjust">
                                                    <ul className="list-group"><li className="list-group-item"><div className="row"><div className="col-xs-12">
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{t("LANG_SELECT")}</h5><div id="node-language-options">{config.languages.map((language) => <small key={language.key}><div className="qb-chrome-option" role="button" tabIndex={0} data-locale={language.key} onClick={() => { updateRuntimeLocale(language.key); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); updateRuntimeLocale(language.key); } }}><img className="lang-flag" src={`/lang/flag_${language.file}.png`} alt="" aria-hidden="true" />{LANGUAGE_TITLES[language.key] ?? language.key}</div></small>)}</div></div>
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{t("THEME_SELECT")}</h5><div id="node-theme-options">{config.themes.map((theme) => <small key={theme.file}><div className="qb-chrome-option" role="button" tabIndex={0} onClick={() => { setNoticeOpen(false); applyTheme(theme.file); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setNoticeOpen(false); applyTheme(theme.file); } }}><img className="lang-flag" src={`/img/themes/opt_${theme.file}.png`} alt="" aria-hidden="true" />{THEME_TITLES[theme.file] ?? theme.file}</div></small>)}</div></div>
                                                    </div></div></li></ul>
                                                </div>
                                                <div role="tabpanel" className={`tab-pane${activeNoticeTab === "configure" ? " active" : ""}`} id="configure">
                                                    <ul className="list-group"><li className="list-group-item"><div className="row"><div className="col-xs-12">
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{t("BW_SELECT")}</h5><div id="node-bw-page-options">{config.bwPages.map((page) => <small key={page.key}><div className="qb-chrome-option" role="button" tabIndex={0} onClick={() => { localStorage.setItem("bw_tables:page", page.key); window.dispatchEvent(new Event("quickbox:bandwidth-page-change")); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); localStorage.setItem("bw_tables:page", page.key); window.dispatchEvent(new Event("quickbox:bandwidth-page-change")); } }}>{t(BANDWIDTH_PAGE_TITLE_KEYS[page.key])}</div></small>)}</div></div>
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{t("PANEL_CONFIG")}</h5><small><div id="node-panel-reset" className="qb-chrome-option" role="button" tabIndex={0} onClick={resetPanels} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); resetPanels(); } }}>{t("PANEL_RESET")}</div></small></div>
                                                    </div></div></li></ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className={`header-account btn-group${accountOpen ? " open" : ""}`} ref={accountRef}>
                                    <button type="button" className="btn btn-logged" aria-expanded={accountOpen} aria-controls="quickboxAccountDropdown" onClick={() => { setAccountOpen((open) => !open); }}><span className="header-username">{config.username.trim() || "QuickBox"}</span><span className="caret"></span></button>
                                    <ul id="quickboxAccountDropdown" className="dropdown-menu pull-right">
                                        {config.branch !== "development" ? <li><a href="#branchSwitch" data-branch-mode="development" onClick={(event) => { event.preventDefault(); openBranchSwitch("development"); }}><Trans i18nKey="SWITCH_DEV" /></a></li> : null}
                                        {config.branch !== "master" ? <li><a href="#branchSwitch" data-branch-mode="master" onClick={(event) => { event.preventDefault(); openBranchSwitch("master"); }}><Trans i18nKey="SWITCH_MASTER" /></a></li> : null}
                                        <li><a href="#branchSwitch" data-branch-mode="other" onClick={(event) => { event.preventDefault(); openBranchSwitch("other"); }}>{t("BRANCH_OTHER")}</a></li>
                                        {config.hasExternalAuth ? <li><a href={`/logout?url=${encodeURIComponent(config.ssoLogoutUrl || "/")}`}><LogoutOutlined className="text-warning" aria-hidden="true" /> {t("SSO_LOGOUT_TXT")}</a></li> : null}
                                        <li style={{ borderTop: "1px solid #444" }}><a href="https://github.com/amefs/quickbox-lite/issues/new" target="_blank" rel="noopener noreferrer"><WarningOutlined className="text-warning" aria-hidden="true" /> {t("ISSUE_REPORT_TXT")}</a></li>
                                    </ul>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <BranchSwitchDialog
                    open={branchModalOpen}
                    mode={branchMode}
                    branch={config.branch}
                    branchCommit={config.branchCommit}
                    onCancel={closeBranchSwitch}
                    onSwitch={confirmBranchSwitch}
                />
            </div>
        </ConfigProvider>
    );
}

const helpSections = [
    {
        titleKey: "QUICK_SYSTEM_TIPS",
        rows: [
            ["box update quickbox", "SYS_UPGRADE_TXT"],
            ["box lang COUNTRYCODE", "SET_LANG_TXT"],
            ["box set interface", "CHANGEINTERFACE_TXT"],
            ["box clean mem", "CLEAN_MEM_TXT"],
            ["box clean log", "CLEAN_LOG_TXT"],
            ["box iotest", "DISKTEST_TXT"],
        ],
    },
    {
        titleKey: "SEEDBOX_COMMANDS",
        rows: [
            ["box install APPNAME", "APP_INSTALL_TXT"],
            ["box remove APPNAME", "APP_UNINSTALL_TXT"],
            ["box update APPNAME", "APP_UPGRADE_TXT"],
            ["box set password", "CHANGEUSERPASS_TXT"],
            ["box fix dpkg", "FIX_DPKG_TXT"],
            ["box troubleshoot", "TROUBLESHOOT_TXT"],
        ],
    },
] as const;

export function DashboardSidebar({ username, menuState, theme = "defaulted" }: { username: string; menuState: DashboardChromeMenuState; theme?: DashboardTheme }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState("mainmenu");
    const [downloadsOpen, setDownloadsOpen] = React.useState(false);
    const [hoveredLink, setHoveredLink] = React.useState<string | null>(null);
    const [downloadsHeight, setDownloadsHeight] = React.useState(0);
    const downloadsMenuRef = React.useRef<HTMLUListElement>(null);
    const href = (url: string) => usernameUrl(url, username);
    React.useLayoutEffect(() => {
        const submenu = downloadsMenuRef.current;
        if (!downloadsOpen || !submenu) {
            setDownloadsHeight(0);
            return;
        }
        const targetHeight = submenu.scrollHeight;
        submenu.style.maxHeight = "0px";
        let secondFrame: number | undefined;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                setDownloadsHeight(targetHeight);
            });
        });
        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (secondFrame !== undefined) {
                window.cancelAnimationFrame(secondFrame);
            }
        };
    }, [downloadsOpen, menuState.installedDownloadEntries.length]);
    return (
        <ConfigProvider theme={getAntdThemeConfig(theme)}>
            <div className="leftpanelinner">
                <ul className="nav nav-tabs nav-justified nav-sidebar">
                    <li className={`tooltips${activeTab === "mainmenu" ? " active" : ""}`}><Tooltip title={t("MAIN_MENU")} placement="bottom" color="#222"><a href="#mainmenu" aria-label={t("MAIN_MENU")} aria-current={activeTab === "mainmenu" ? "location" : undefined} data-target="#mainmenu" onClick={(event) => { event.preventDefault(); setActiveTab("mainmenu"); }}><EllipsisOutlined className="tooltips" aria-hidden="true" /></a></Tooltip></li>
                    <li id="node-plugin-tab" className={`tooltips${activeTab === "plugins" ? " active" : ""}`} style={menuState.showPluginTab ? undefined : { display: "none" }}><Tooltip title={t("RPLUGIN_MENU")} placement="bottom" color="#222"><a href="#plugins" aria-label={t("RPLUGIN_MENU")} aria-current={activeTab === "plugins" ? "location" : undefined} data-target="#plugins" onClick={(event) => { event.preventDefault(); setActiveTab("plugins"); }}><AppstoreOutlined className="tooltips" aria-hidden="true" /></a></Tooltip></li>
                    <li className={`tooltips${activeTab === "help" ? " active" : ""}`}><Tooltip title={t("HELP_COMMANDS")} placement="bottom" color="#222"><a href="#help" aria-label={t("HELP_COMMANDS")} aria-current={activeTab === "help" ? "location" : undefined} data-target="#help" onClick={(event) => { event.preventDefault(); setActiveTab("help"); }}><QuestionCircleOutlined className="tooltips" aria-hidden="true" /></a></Tooltip></li>
                </ul>
                <div className="tab-content">
                    <div className={`tab-pane${activeTab === "mainmenu" ? " active" : ""}`} id="mainmenu">
                        <h2 className="sidebar-title">{t("MAIN_MENU")}</h2>
                        <ul className="nav nav-pills nav-stacked nav-quirk">
                            {menuState.installedMenuEntries.map((entry) => <li key={`menu-${entry.name}`} className={hoveredLink === entry.name ? "nav-hover" : ""} onMouseEnter={() => { setHoveredLink(entry.name); }} onMouseLeave={() => { setHoveredLink(null); }}><a className="grayscale" href={href(entry.url)} target="_blank" rel="noopener noreferrer">{entry.logo ? <img src={entry.logo} className="brand-ico" width={18} height={18} alt="" aria-hidden="true" /> : null}<span>{entry.name}</span></a></li>)}
                            {menuState.installedDownloadEntries.length ? <li className={`nav-parent${downloadsOpen ? " nav-active" : ""}`}><a href="#" aria-expanded={downloadsOpen} onClick={(event) => { event.preventDefault(); setDownloadsOpen((open) => !open); }}><DownloadOutlined aria-hidden="true" /> <span>{t("DOWNLOADS")}</span><DownOutlined className="qb-sidebar-expand-icon" aria-hidden="true" /></a><ul ref={downloadsMenuRef} className="children" aria-hidden={!downloadsOpen} style={{ maxHeight: `${downloadsHeight}px` }}>{menuState.installedDownloadEntries.map((entry) => <li key={`download-${entry.name}`}><a href={href(entry.url)} tabIndex={downloadsOpen ? undefined : -1} target="_blank" rel="noopener noreferrer">{entry.name}</a></li>)}</ul></li> : null}
                            {menuState.showWebConsole ? <li><a href={`/${username}.console`} target="_blank" rel="noopener noreferrer"><CodeOutlined aria-hidden="true" /> <span>{t("WEB_CONSOLE")}</span></a></li> : null}
                        </ul>
                    </div>
                    <div className={`tab-pane${activeTab === "plugins" ? " active" : ""}`} id="plugins"><h2 className="sidebar-title">{t("RPLUGIN_MENU")}</h2><ul id="node-plugin-list" className="nav nav-pills nav-stacked nav-quirk"><RutorrentPluginList visible={activeTab === "plugins" && menuState.showPluginTab} /></ul></div>
                    <div className={`tab-pane${activeTab === "help" ? " active" : ""}`} id="help">
                        {helpSections.map((section) => (
                            <React.Fragment key={section.titleKey}>
                                <h2 className="sidebar-title">{t(section.titleKey)}</h2>
                                <ul className="nav nav-pills nav-stacked nav-quirk nav-mail">
                                    {section.rows.map(([command, translationKey]) => (
                                        <li key={command} style={{ padding: "7px" }}>
                                            <span style={{ fontSize: "12px", color: "#eee" }}>{command}</span>
                                            <br />
                                            <small>{t(translationKey)}</small>
                                        </li>
                                    ))}
                                </ul>
                            </React.Fragment>
                        ))}
                        <h2 className="sidebar-title">{t("ESSENTIAL_USER_COMMANDS")}</h2><ul className="nav nav-pills nav-stacked nav-quirk nav-mail"><li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>systemctl restart rtorrent@{username}.service</span><br /><small>{t("SCREEN_RTORRNENT_TXT")}</small></li></ul>
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
}
