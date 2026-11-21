// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { createRoot } from "react-dom/client";

import type { DashboardBootstrapPayload } from "../../ws/src/shared/bootstrap-contract";
import type { DashboardTheme } from "../../ws/src/shared/theme";
import { DashboardApp } from "./dashboard-app";
import i18n, { detectInitialLocale, setLocale, VALID_LOCALES } from "./i18n";
import { initDashboardRuntime, type BackendRetryState } from "./runtime/dashboard-runtime-client";
import { registerDataIslands } from "./runtime/data-slots";
import { registerServiceControlIsland } from "./runtime/service-control-client";
import { registerSystemResponseIsland } from "./runtime/system-response-client";
import { applyFrontendTheme, getSelectedDashboardTheme } from "./runtime/theme-store";

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
        defaultLocale: null,
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
const BOOTSTRAP_TIMEOUT_MS = 10000;

function DashboardRoot({ basePath }: { basePath: string }) {
    const initialLocale = React.useMemo(() => detectInitialLocale(), []);
    const initialTheme = React.useMemo(() => detectInitialTheme(), []);
    const [bootstrap, setBootstrap] = React.useState<DashboardBootstrapPayload>(() =>
        createFallbackBootstrap(basePath, initialTheme),
    );
    const [bootstrapReady, setBootstrapReady] = React.useState(false);
    const [bootstrapRetry, setBootstrapRetry] = React.useState<BackendRetryState | null>(null);
    const [connectionRetry, setConnectionRetry] = React.useState<BackendRetryState | null>(null);
    const runtimeStartedRef = React.useRef(false);
    const reconnectRef = React.useRef<(() => void) | undefined>(undefined);
    const retryTimerRef = React.useRef<number | null>(null);
    const bootstrapRequestRef = React.useRef<AbortController | null>(null);

    const clearRetryTimer = React.useCallback(() => {
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const loadBootstrap = React.useCallback(async (attempt = 0) => {
        clearRetryTimer();
        bootstrapRequestRef.current?.abort();
        const controller = new AbortController();
        bootstrapRequestRef.current = controller;
        const timeout = window.setTimeout(() => {
            controller.abort(new DOMException("Bootstrap request timed out", "TimeoutError"));
        }, BOOTSTRAP_TIMEOUT_MS);
        try {
            const response = await fetch(`${basePath}/node/bootstrap${window.location.search}`, {
                credentials: "same-origin",
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`Bootstrap failed (${response.status})`);
            }
            const payload = (await response.json()) as DashboardBootstrapPayload;
            if (bootstrapRequestRef.current !== controller) {return;}
            controller.signal.throwIfAborted();
            const resolvedLocale = detectInitialLocale(payload.defaultLocale);
            setLocale(resolvedLocale);
            window.quickboxLocale = resolvedLocale;
            applyFrontendTheme(getSelectedDashboardTheme() ?? payload.serviceTheme);

            window.quickboxRuntime = payload;
            registerDataIslands(payload);
            registerServiceControlIsland(payload);
            registerSystemResponseIsland();

            setBootstrap(payload);
            setBootstrapReady(true);
            setBootstrapRetry(null);

            if (!runtimeStartedRef.current) {
                runtimeStartedRef.current = true;
                reconnectRef.current = initDashboardRuntime(setConnectionRetry);
            }
        } catch (error) {
            if (bootstrapRequestRef.current !== controller) {return;}
            const message = controller.signal.aborted
                ? i18n.t("BACKEND_REQUEST_TIMEOUT")
                : error instanceof Error ? error.message : String(error);
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
        } finally {
            window.clearTimeout(timeout);
            if (bootstrapRequestRef.current === controller) {
                bootstrapRequestRef.current = null;
            }
        }
    }, [basePath, clearRetryTimer]);

    React.useEffect(() => {
        setLocale(initialLocale);
        applyFrontendTheme(initialTheme);
        void loadBootstrap(0);
        return () => {
            clearRetryTimer();
            bootstrapRequestRef.current?.abort();
            bootstrapRequestRef.current = null;
        };
    }, [initialLocale, initialTheme, loadBootstrap, clearRetryTimer]);

    return (
        <DashboardApp
            bootstrap={bootstrap}
            bootstrapReady={bootstrapReady}
            backendRetry={bootstrapRetry ?? connectionRetry}
            onRetryBackend={bootstrapReady ? reconnectRef.current : () => void loadBootstrap(0)}
        />
    );
}

const DebugRoot = React.lazy(() => import("./debug-app"));

function startApp() {
    const mount = document.getElementById("root");
    if (!mount) {
        return;
    }
    const initialLocale = detectInitialLocale();
    const initialTheme = detectInitialTheme();
    setLocale(initialLocale);
    applyFrontendTheme(initialTheme);
    const basePath = detectBasePath();
    createRoot(mount).render(isDebugRoute() ? (
        <React.Suspense fallback={null}>
            <DebugRoot basePath={basePath} initialLocale={initialLocale} initialTheme={initialTheme} />
        </React.Suspense>
    ) : <DashboardRoot basePath={basePath} />);
}

startApp();
