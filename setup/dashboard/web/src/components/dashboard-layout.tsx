// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Trans, useTranslation } from "react-i18next";
import {
    AppstoreOutlined,
    CodeOutlined,
    DownloadOutlined,
    EllipsisOutlined,
    LogoutOutlined,
    MenuOutlined,
    QuestionCircleOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import { Button, ConfigProvider, Modal, Switch, Tooltip } from "antd";

import { selectFrontendTheme, getAntdThemeConfig } from "../runtime/theme-store";
import { switchDashboardBranch, updateRuntimeLocale, useCommandConnection } from "../runtime/dashboard-runtime-client";
import { isDashboardTheme, type DashboardTheme } from "../../../ws/src/shared/theme";

export interface ChromeMenuEntry {
    name: string;
    url: string;
    logo?: string;
}

export interface DashboardChromeProps {
    locale: string;
    config: {
        username: string;
        version: string;
        branch: string;
        branchCommit?: string;
        developerLabel: string;
        showDeveloper: boolean;
        hasExternalAuth: boolean;
        ssoLogoutUrl: string;
        languages: { file: string; key: string; title: string }[];
        themes: { file: string; title: string }[];
        bwPages: { key: string; title: string }[];
    };
    menuState: {
        installedMenuEntries: ChromeMenuEntry[];
        installedDownloadEntries: ChromeMenuEntry[];
        showPluginTab: boolean;
        showWebConsole: boolean;
    };
    labels: {
        language: string;
        theme: string;
        bandwidth: string;
        panelConfig: string;
        panelReset: string;
        themeChange: string;
        cancel: string;
        agree: string;
        mainMenu: string;
        pluginMenu: string;
        helpCommands: string;
        downloads: string;
        webConsole: string;
        quickSystemTips: string;
        seedboxCommands: string;
        essentialUserCommands: string;
        systemUpgrade: string;
        setLanguage: string;
        changeInterface: string;
        cleanMemory: string;
        cleanLog: string;
        diskTest: string;
        appInstall: string;
        appUninstall: string;
        appUpgrade: string;
        changePassword: string;
        fixDpkg: string;
        troubleshoot: string;
        restartRtorrent: string;
        switchDev: string;
        switchMaster: string;
        branchOther: string;
        branchSwitch: string;
        branchCurrent: string;
        branchTarget: string;
        branchLoading: string;
        branchListError: string;
        branchWarning: string;
        branchLoadFailed: string;
        branchSelect: string;
        branchRetry: string;
        branchUpdate: string;
        branchSwitchAction: string;
        ssoLogout: string;
        issueReport: string;
    };
}

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
    locale: string;
    labels: DashboardChromeProps["labels"];
    onCancel: () => void;
    onSwitch: (branch: string) => void;
}

function BranchSwitchDialog({ open, mode, branch, branchCommit, locale, labels, onCancel, onSwitch }: BranchSwitchDialogProps) {
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
    const buttonLabel = !fixedTarget && selectedBranch === branch ? labels.branchUpdate : labels.branchSwitchAction;

    return (
        <Modal
            open={open}
            title={labels.branchSwitch}
            width={500}
            centered
            zIndex={2200}
            wrapProps={{ id: "branchSwitch" }}
            classNames={{ wrapper: "qb-branch-switch-wrap" }}
            onCancel={onCancel}
            footer={<><Button data-dismiss="modal" onClick={onCancel}>{labels.cancel}</Button><Button id="branchSwitchGo" type="primary" disabled={!commandsConnected || !isBranchName(targetBranch) || branchesLoading || branchError} data-update={labels.branchUpdate} data-switch={labels.branchSwitchAction} onClick={() => { if (isBranchName(targetBranch)) {onSwitch(targetBranch);} }}>{buttonLabel}</Button></>}
        >
            <div className="branch-current"><div className="branch-label">{labels.branchCurrent}</div><div className="branch-value">{branch}{branchCommit ? <span className="branch-commit">{" "}{branchCommit.slice(0, 12)}</span> : null}</div></div>
            <div className="branch-label" id="branchTargetLabel">{labels.branchTarget}</div>
            <div id="branchFixedTarget" className="branch-value" hidden={!fixedTarget}>{fixedTarget ? mode : ""}</div>
            <div id="branchSelectContainer" className="branch-select" hidden={fixedTarget}>
                <select id="branchTarget" aria-labelledby="branchTargetLabel" data-current={branch} className="form-control input-sm" disabled={fixedTarget || branchesLoading || branchError} value={selectedBranch} onChange={(event) => { setSelectedBranch(event.target.value); }}>
                    {branchesLoading ? <option value="">{labels.branchLoading}</option> : null}
                    {branchError ? <option value="">{labels.branchLoadFailed}</option> : null}
                    {!branchesLoading && !branchError ? <option value="">{labels.branchSelect}</option> : null}
                    {branches.map((remoteBranch) => <option key={remoteBranch} value={remoteBranch}>{remoteBranch}</option>)}
                </select>
            </div>
            <p id="branchError" className="text-danger" role="alert" hidden={!branchError}>{labels.branchListError} <button type="button" id="branchRetry" className="btn btn-link" onClick={() => {void loadBranches();}}>{labels.branchRetry}</button></p>
            <p className="branch-warning">{labels.branchWarning}</p>
        </Modal>
    );
}

export function DashboardHeader({ props, theme = "defaulted" }: { props: DashboardChromeProps; theme?: DashboardTheme }) {
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
                            {props.config.showDeveloper ? <li className="header-branch"><div className="btn-group"><span className="label label-warning" title={props.config.branch}><span className="header-branch-description">{props.config.developerLabel}</span><span className="header-branch-name">{props.config.branch}</span></span></div></li> : null}
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
                                                    <ul className="list-group"><li className="list-group-item"><h5>QuickBox :: <span style={{ color: "#fff", textShadow: "0px 0px 6px #fff" }}>{props.config.version}</span></h5><small><a href="https://github.com/amefs/quickbox-lite/blob/master/README.md" target="_blank" rel="noopener noreferrer">README.md</a></small><small><a href={`https://github.com/amefs/quickbox-lite/blob/master/CHANGELOG.md#changelog-${props.config.version}`} target="_blank" rel="noopener noreferrer">CHANGELOG</a></small></li></ul>
                                                </div>
                                                <div role="tabpanel" className={`tab-pane${activeNoticeTab === "dashadjust" ? " active" : ""}`} id="dashadjust">
                                                    <ul className="list-group"><li className="list-group-item"><div className="row"><div className="col-xs-12">
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{props.labels.language}</h5><div id="node-language-options">{props.config.languages.map((language) => <small key={language.key}><div className="qb-chrome-option" role="button" tabIndex={0} data-locale={language.key} onClick={() => { updateRuntimeLocale(language.key); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); updateRuntimeLocale(language.key); } }}><img className="lang-flag" src={`/lang/flag_${language.file}.png`} alt="" aria-hidden="true" />{language.title}</div></small>)}</div></div>
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{props.labels.theme}</h5><div id="node-theme-options">{props.config.themes.map((theme) => <small key={theme.file}><div className="qb-chrome-option" role="button" tabIndex={0} onClick={() => { setNoticeOpen(false); applyTheme(theme.file); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setNoticeOpen(false); applyTheme(theme.file); } }}><img className="lang-flag" src={`/img/themes/opt_${theme.file}.png`} alt="" aria-hidden="true" />{theme.title}</div></small>)}</div></div>
                                                    </div></div></li></ul>
                                                </div>
                                                <div role="tabpanel" className={`tab-pane${activeNoticeTab === "configure" ? " active" : ""}`} id="configure">
                                                    <ul className="list-group"><li className="list-group-item"><div className="row"><div className="col-xs-12">
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{props.labels.bandwidth}</h5><div id="node-bw-page-options">{props.config.bwPages.map((page) => <small key={page.key}><div className="qb-chrome-option" role="button" tabIndex={0} onClick={() => { localStorage.setItem("bw_tables:page", page.key); window.dispatchEvent(new Event("quickbox:bandwidth-page-change")); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); localStorage.setItem("bw_tables:page", page.key); window.dispatchEvent(new Event("quickbox:bandwidth-page-change")); } }}>{page.title}</div></small>)}</div></div>
                                                        <div className="col-xs-12 col-md-6 qb-chrome-config-col"><h5>{props.labels.panelConfig}</h5><small><div id="node-panel-reset" className="qb-chrome-option" role="button" tabIndex={0} onClick={resetPanels} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); resetPanels(); } }}>{props.labels.panelReset}</div></small></div>
                                                    </div></div></li></ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className={`header-account btn-group${accountOpen ? " open" : ""}`} ref={accountRef}>
                                    <button type="button" className="btn btn-logged" aria-expanded={accountOpen} aria-controls="quickboxAccountDropdown" onClick={() => { setAccountOpen((open) => !open); }}>{props.config.username}<span className="caret"></span></button>
                                    <ul id="quickboxAccountDropdown" className="dropdown-menu pull-right">
                                        {props.config.branch !== "development" ? <li><a href="#branchSwitch" data-branch-mode="development" onClick={(event) => { event.preventDefault(); openBranchSwitch("development"); }}><Trans i18nKey="SWITCH_DEV" defaults={props.labels.switchDev} /></a></li> : null}
                                        {props.config.branch !== "master" ? <li><a href="#branchSwitch" data-branch-mode="master" onClick={(event) => { event.preventDefault(); openBranchSwitch("master"); }}><Trans i18nKey="SWITCH_MASTER" defaults={props.labels.switchMaster} /></a></li> : null}
                                        <li><a href="#branchSwitch" data-branch-mode="other" onClick={(event) => { event.preventDefault(); openBranchSwitch("other"); }}>{props.labels.branchOther}</a></li>
                                        {props.config.hasExternalAuth ? <li><a href={`/logout?url=${encodeURIComponent(props.config.ssoLogoutUrl || "/")}`}><LogoutOutlined className="text-warning" aria-hidden="true" /> {props.labels.ssoLogout}</a></li> : null}
                                        <li style={{ borderTop: "1px solid #444" }}><a href="https://github.com/amefs/quickbox-lite/issues/new" target="_blank" rel="noopener noreferrer"><WarningOutlined className="text-warning" aria-hidden="true" /> {props.labels.issueReport}</a></li>
                                    </ul>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <BranchSwitchDialog
                    open={branchModalOpen}
                    mode={branchMode}
                    branch={props.config.branch}
                    branchCommit={props.config.branchCommit}
                    locale={props.locale}
                    labels={props.labels}
                    onCancel={closeBranchSwitch}
                    onSwitch={confirmBranchSwitch}
                />
            </div>
        </ConfigProvider>
    );
}

const helpSections = [
    { titleKey: "quickSystemTips", rows: [["box update quickbox", "systemUpgrade"], ["box lang COUNTRYCODE", "setLanguage"], ["box set interface", "changeInterface"], ["box clean mem", "cleanMemory"], ["box clean log", "cleanLog"], ["box iotest", "diskTest"]] },
    { titleKey: "seedboxCommands", rows: [["box install APPNAME", "appInstall"], ["box remove APPNAME", "appUninstall"], ["box update APPNAME", "appUpgrade"], ["box set password", "changePassword"], ["box fix dpkg", "fixDpkg"], ["box troubleshoot", "troubleshoot"]] },
];

export function DashboardSidebar({ props, theme = "defaulted" }: { props: DashboardChromeProps; theme?: DashboardTheme }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState("mainmenu");
    const [downloadsOpen, setDownloadsOpen] = React.useState(false);
    const [hoveredLink, setHoveredLink] = React.useState<string | null>(null);
    const [downloadsHeight, setDownloadsHeight] = React.useState(0);
    const downloadsMenuRef = React.useRef<HTMLUListElement>(null);
    const label = (key: keyof DashboardChromeProps["labels"]) => props.labels[key];
    const href = (url: string) => usernameUrl(url, props.config.username);
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
    }, [downloadsOpen, props.menuState.installedDownloadEntries.length]);
    return (
        <ConfigProvider theme={getAntdThemeConfig(theme)}>
            <div className="leftpanelinner">
                <ul className="nav nav-tabs nav-justified nav-sidebar">
                    <li className={`tooltips${activeTab === "mainmenu" ? " active" : ""}`}><Tooltip title={label("mainMenu")} placement="bottom" color="#222"><a href="#mainmenu" aria-label={label("mainMenu")} aria-selected={activeTab === "mainmenu"} data-target="#mainmenu" onClick={(event) => { event.preventDefault(); setActiveTab("mainmenu"); }}><EllipsisOutlined className="tooltips" aria-hidden="true" /></a></Tooltip></li>
                    <li id="node-plugin-tab" className={`tooltips${activeTab === "plugins" ? " active" : ""}`} style={props.menuState.showPluginTab ? undefined : { display: "none" }}><Tooltip title={label("pluginMenu")} placement="bottom" color="#222"><a href="#plugins" aria-label={label("pluginMenu")} aria-selected={activeTab === "plugins"} data-target="#plugins" onClick={(event) => { event.preventDefault(); setActiveTab("plugins"); }}><AppstoreOutlined className="tooltips" aria-hidden="true" /></a></Tooltip></li>
                    <li className={`tooltips${activeTab === "help" ? " active" : ""}`}><Tooltip title={label("helpCommands")} placement="bottom" color="#222"><a href="#help" aria-label={label("helpCommands")} aria-selected={activeTab === "help"} data-target="#help" onClick={(event) => { event.preventDefault(); setActiveTab("help"); }}><QuestionCircleOutlined className="tooltips" aria-hidden="true" /></a></Tooltip></li>
                </ul>
                <div className="tab-content">
                    <div className={`tab-pane${activeTab === "mainmenu" ? " active" : ""}`} id="mainmenu">
                        <h5 className="sidebar-title">{label("mainMenu")}</h5>
                        <ul className="nav nav-pills nav-stacked nav-quirk">
                            {props.menuState.installedMenuEntries.map((entry) => <li key={`menu-${entry.name}`} className={hoveredLink === entry.name ? "nav-hover" : ""} onMouseEnter={() => { setHoveredLink(entry.name); }} onMouseLeave={() => { setHoveredLink(null); }}><a className="grayscale" href={href(entry.url)} target="_blank" rel="noopener noreferrer">{entry.logo ? <img src={entry.logo} className="brand-ico" width={18} height={18} alt="" aria-hidden="true" /> : null}<span>{entry.name}</span></a></li>)}
                            {props.menuState.installedDownloadEntries.length ? <li className={`nav-parent${downloadsOpen ? " nav-active" : ""}`}><a href="#" aria-expanded={downloadsOpen} onClick={(event) => { event.preventDefault(); setDownloadsOpen((open) => !open); }}><DownloadOutlined aria-hidden="true" /> <span>{label("downloads")}</span></a><ul ref={downloadsMenuRef} className="children" aria-hidden={!downloadsOpen} style={{ maxHeight: `${downloadsHeight}px` }}>{props.menuState.installedDownloadEntries.map((entry) => <li key={`download-${entry.name}`}><a href={href(entry.url)} tabIndex={downloadsOpen ? undefined : -1} target="_blank" rel="noopener noreferrer">{entry.name}</a></li>)}</ul></li> : null}
                            {props.menuState.showWebConsole ? <li><a href={`/${props.config.username}.console`} target="_blank" rel="noopener noreferrer"><CodeOutlined aria-hidden="true" /> <span>{label("webConsole")}</span></a></li> : null}
                        </ul>
                    </div>
                    <div className={`tab-pane${activeTab === "plugins" ? " active" : ""}`} id="plugins"><h5 className="sidebar-title">{t("RPLUGIN_MENU")}</h5><ul id="node-plugin-list" className="nav nav-pills nav-stacked nav-quirk"><RutorrentPluginList visible={activeTab === "plugins" && props.menuState.showPluginTab} /></ul></div>
                    <div className={`tab-pane${activeTab === "help" ? " active" : ""}`} id="help">
                        {helpSections.map((section) => <React.Fragment key={section.titleKey}><h5 className="sidebar-title">{label(section.titleKey as keyof DashboardChromeProps["labels"])}</h5><ul className="nav nav-pills nav-stacked nav-quirk nav-mail">{section.rows.map(([command, translation]) => <li key={command} style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>{command}</span><br /><small>{label(translation as keyof DashboardChromeProps["labels"])}</small></li>)}</ul></React.Fragment>)}
                        <h5 className="sidebar-title">{label("essentialUserCommands")}</h5><ul className="nav nav-pills nav-stacked nav-quirk nav-mail"><li style={{ padding: "7px" }}><span style={{ fontSize: "12px", color: "#eee" }}>systemctl restart rtorrent@{props.config.username}.service</span><br /><small>{label("restartRtorrent")}</small></li></ul>
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
}
