// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { createRoot } from "react-dom/client";
import { Button, ConfigProvider, Result, Spin } from "antd";
import { useTranslation } from "react-i18next";

import type { DashboardBootstrapPayload, DebugMetaPayload } from "../../ws/src/shared/bootstrap-contract";
import type { DashboardTheme } from "../../ws/src/shared/theme";
import { DashboardApp, type BootstrapRetryState } from "./dashboard-app";
import { DebugApp } from "./debug-app";
import { detectInitialLocale, getAntdLocale, setLocale, VALID_LOCALES } from "./i18n";
import { initDashboardRuntime } from "./runtime/dashboard-runtime-client";
import { registerDataIslands } from "./runtime/data-slots";
import { registerServiceControlIsland } from "./runtime/service-control-client";
import { registerSystemResponseIsland } from "./runtime/system-response-client";
import { applyFrontendTheme, getAntdThemeConfig } from "./runtime/theme-store";

function detectBasePath(): string {
    return window.location.pathname === "/ws" || window.location.pathname.startsWith("/ws/") ? "/ws" : "";
}

function isDebugRoute(): boolean {
    const pathname = window.location.pathname.replace(/\/+$/, "");
    return pathname === "/debug" || pathname === "/ws/debug";
}

function detectInitialTheme(): DashboardTheme {
    const match = /(?:^|;\s*)quickbox_theme=(smoked|defaulted)(?:;|$)/.exec(document.cookie);
    return match?.[1] === "smoked" ? "smoked" : "defaulted";
}

function createFallbackBootstrap(basePath: string, theme: DashboardTheme): DashboardBootstrapPayload {
    return {
        basePath,
        locales: VALID_LOCALES,
        serviceKeys: [],
        socketUpgrade: true,
        serviceTheme: theme,
        serviceRows: [],
        systemSummary: {
            uptime: { days: 0, hours: 0, minutes: 0 },
        },
        networkInterfaces: [],
        networkInterfacesLoaded: false,
        runningTask: {
            active: false,
            kind: "package",
            operation: "",
        },
        packageManagement: {
            data: { rows: [], installLockExists: false },
            theme,
        },
        chrome: {
            config: {
                username: "QuickBox",
                version: "",
                branch: "master",
                showDeveloper: false,
                hasExternalAuth: false,
                ssoLogoutUrl: "",
                languages: [
                    { file: "lang_da", key: "da" },
                    { file: "lang_de", key: "de" },
                    { file: "lang_en", key: "en" },
                    { file: "lang_es", key: "es" },
                    { file: "lang_fr", key: "fr" },
                    { file: "lang_zh", key: "zh" },
                ],
                themes: [
                    { file: "defaulted" },
                    { file: "smoked" },
                ],
                bwPages: [
                    { key: "t" },
                    { key: "h" },
                    { key: "d" },
                    { key: "m" },
                ],
            },
            menuState: {
                installedMenuEntries: [],
                installedDownloadEntries: [],
                showPluginTab: false,
                showWebConsole: false,
            },
        },
    };
}

const MAX_BOOTSTRAP_RETRIES = 3;
const BOOTSTRAP_RETRY_DELAY_MS = 3000;

function DashboardRoot({ basePath }: { basePath: string }) {
    const initialLocale = React.useMemo(() => detectInitialLocale(), []);
    const initialTheme = React.useMemo(() => detectInitialTheme(), []);
    const [bootstrap, setBootstrap] = React.useState<DashboardBootstrapPayload>(() =>
        createFallbackBootstrap(basePath, initialTheme),
    );
    const [bootstrapReady, setBootstrapReady] = React.useState(false);
    const [bootstrapRetry, setBootstrapRetry] = React.useState<BootstrapRetryState | null>(null);
    const runtimeStartedRef = React.useRef(false);
    const retryTimerRef = React.useRef<number | null>(null);

    const clearRetryTimer = React.useCallback(() => {
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const loadBootstrap = React.useCallback(async (attempt = 0) => {
        clearRetryTimer();
        try {
            const response = await fetch(`${basePath}/node/bootstrap${window.location.search}`, {
                credentials: "same-origin",
            });
            if (!response.ok) {
                throw new Error(`Bootstrap failed (${response.status})`);
            }
            const payload = (await response.json()) as DashboardBootstrapPayload;
            const resolvedLocale = detectInitialLocale();
            setLocale(resolvedLocale, false);
            window.quickboxLocale = resolvedLocale;
            applyFrontendTheme(payload.serviceTheme);

            window.quickboxRuntime = payload;
            registerDataIslands(payload);
            registerServiceControlIsland(payload);
            registerSystemResponseIsland();

            setBootstrap(payload);
            setBootstrapReady(true);
            setBootstrapRetry(null);

            if (!runtimeStartedRef.current) {
                runtimeStartedRef.current = true;
                initDashboardRuntime();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[quickbox-web] Failed to start dashboard", error);
            setBootstrapReady(false);
            if (attempt < MAX_BOOTSTRAP_RETRIES) {
                const nextAttempt = attempt + 1;
                setBootstrapRetry({
                    error: message,
                    attempt: nextAttempt,
                    maxAttempts: MAX_BOOTSTRAP_RETRIES,
                    exhausted: false,
                });
                retryTimerRef.current = window.setTimeout(() => {
                    void loadBootstrap(nextAttempt);
                }, BOOTSTRAP_RETRY_DELAY_MS);
            } else {
                setBootstrapRetry({
                    error: message,
                    attempt: MAX_BOOTSTRAP_RETRIES,
                    maxAttempts: MAX_BOOTSTRAP_RETRIES,
                    exhausted: true,
                });
            }
        }
    }, [basePath, clearRetryTimer]);

    React.useEffect(() => {
        setLocale(initialLocale, false);
        applyFrontendTheme(initialTheme);
        void loadBootstrap(0);
        return () => clearRetryTimer();
    }, [initialLocale, initialTheme, loadBootstrap, clearRetryTimer]);

    return (
        <DashboardApp
            bootstrap={bootstrap}
            bootstrapReady={bootstrapReady}
            bootstrapRetry={bootstrapRetry}
            onRetryBootstrap={() => void loadBootstrap(0)}
        />
    );
}

function DebugRoot({ basePath }: { basePath: string }) {
    const { t } = useTranslation();
    const initialLocale = React.useMemo(() => detectInitialLocale(), []);
    const initialTheme = React.useMemo(() => detectInitialTheme(), []);
    const [meta, setMeta] = React.useState<DebugMetaPayload | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const loadMeta = React.useCallback(async () => {
        setError(null);
        try {
            const response = await fetch(`${basePath}/debug/meta`, {
                credentials: "same-origin",
            });
            if (!response.ok) {
                throw new Error(`Debug metadata failed (${response.status})`);
            }
            const payload = (await response.json()) as DebugMetaPayload;
            applyFrontendTheme(payload.theme);
            document.title = "QuickBox WS Debug Console";
            setMeta(payload);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[quickbox-web] Failed to load debug console", err);
            setError(message);
        }
    }, [basePath]);

    React.useEffect(() => {
        setLocale(initialLocale, false);
        applyFrontendTheme(initialTheme);
        void loadMeta();
    }, [initialLocale, initialTheme, loadMeta]);

    if (meta) {
        return <DebugApp meta={meta} />;
    }

    return (
        <ConfigProvider locale={getAntdLocale(initialLocale)} theme={getAntdThemeConfig(initialTheme)}>
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                {error ? (
                    <Result
                        status="500"
                        title={t("BACKEND_UNAVAILABLE_TITLE")}
                        subTitle={t("BACKEND_RETRY_EXHAUSTED_DESC", { error, max: 1 })}
                        extra={<Button type="primary" onClick={() => void loadMeta()}>{t("RETRY")}</Button>}
                    />
                ) : (
                    <Spin size="large" />
                )}
            </div>
        </ConfigProvider>
    );
}

function startApp() {
    const mount = document.getElementById("root");
    if (!mount) {
        return;
    }
    setLocale(detectInitialLocale(), false);
    applyFrontendTheme(detectInitialTheme());
    const basePath = detectBasePath();
    createRoot(mount).render(isDebugRoute() ? <DebugRoot basePath={basePath} /> : <DashboardRoot basePath={basePath} />);
}

startApp();
