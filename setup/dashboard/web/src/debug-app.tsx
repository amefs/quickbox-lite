// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import {
    ArrowLeftOutlined,
    BugOutlined,
    CodeOutlined,
    DeleteOutlined,
    EyeOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import {
    Alert,
    Button,
    Card,
    Col,
    ConfigProvider,
    Empty,
    Layout,
    Row,
    Segmented,
    Select,
    Space,
    Spin,
    Switch,
    Tag,
    Typography,
} from "antd";

import type { DebugEndpointItem, DebugMetaPayload } from "../../ws/src/shared/bootstrap-contract";
import type { DashboardTheme } from "../../ws/src/shared/theme";
import { applyFrontendTheme, getAntdThemeConfig } from "./runtime/theme-store";

interface DebugHistoryEntry {
    id: number;
    url: string;
    name: string;
    timestamp: string;
    elapsedMs: number;
    ok: boolean;
    rawText: string;
}

type FetchStatus = "idle" | "loading" | "ok" | "error";

function formatOutputHtml(rawText: string): string | null {
    const trimmed = rawText.trimStart();
    if (trimmed.startsWith("<")) {
        return rawText;
    }
    try {
        const parsed = JSON.parse(rawText) as unknown;
        if (parsed && typeof parsed === "object" && "html" in parsed && typeof (parsed as { html?: unknown }).html === "string") {
            return (parsed as { html: string }).html;
        }
    } catch {
        // Non-JSON responses fall back to raw display.
    }
    return null;
}

function ShadowHtmlPreview({ html, theme }: { html: string; theme: DashboardTheme }) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }
        const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
        shadow.innerHTML = `<link rel="stylesheet" href="/css/dashboard-foundation.css" /><link rel="stylesheet" href="/css/dashboard-theme-${theme}.css" /><div data-theme="${theme}">${html}</div>`;
    }, [html, theme]);

    return (
        <div
            id="result-rendered"
            ref={hostRef}
            data-theme={theme}
            style={{ padding: 12, borderRadius: 4, border: "1px solid rgba(128,128,128,0.2)" }}
        />
    );
}

function formatRawPretty(rawText: string): string {
    try {
        return JSON.stringify(JSON.parse(rawText), null, 2);
    } catch {
        return rawText;
    }
}

export function DebugApp({ meta }: { meta: DebugMetaPayload }) {
    const [theme, setTheme] = React.useState<DashboardTheme>(meta.theme);
    const [selectedEndpoint, setSelectedEndpoint] = React.useState<DebugEndpointItem | null>(null);
    const [viewMode, setViewMode] = React.useState<"rendered" | "raw">("rendered");
    const [autoRefresh, setAutoRefresh] = React.useState(false);
    const [refreshIntervalMs, setRefreshIntervalMs] = React.useState(5000);
    const [status, setStatus] = React.useState<FetchStatus>("idle");
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [currentResult, setCurrentResult] = React.useState<{
        rawText: string;
        elapsedMs: number;
        url: string;
        name: string;
    } | null>(null);
    const [history, setHistory] = React.useState<DebugHistoryEntry[]>([]);
    const historyIdRef = React.useRef(1);

    const widgetEndpoints = React.useMemo(
        () => meta.endpoints.filter((ep) => ep.category === "widget"),
        [meta.endpoints],
    );
    const serviceEndpoints = React.useMemo(
        () => meta.endpoints.filter((ep) => ep.category === "service"),
        [meta.endpoints],
    );

    const handleThemeChange = (nextTheme: DashboardTheme) => {
        setTheme(nextTheme);
        applyFrontendTheme(nextTheme);
    };

    const fetchEndpoint = React.useCallback(async (endpoint: DebugEndpointItem) => {
        setSelectedEndpoint(endpoint);
        setStatus("loading");
        setErrorMessage(null);
        const started = performance.now();
        try {
            const response = await fetch(`${meta.basePath}/debug/node?url=${encodeURIComponent(endpoint.url)}`, {
                credentials: "same-origin",
            });
            const rawText = await response.text();
            const elapsedMs = Math.round(performance.now() - started);
            const ok = response.ok;
            setStatus(ok ? "ok" : "error");
            if (!ok) {
                setErrorMessage(`HTTP ${response.status}: ${rawText}`);
            }
            setCurrentResult({
                rawText,
                elapsedMs,
                url: endpoint.url,
                name: endpoint.name,
            });
            const entry: DebugHistoryEntry = {
                id: historyIdRef.current++,
                url: endpoint.url,
                name: endpoint.name,
                timestamp: new Date().toLocaleTimeString(),
                elapsedMs,
                ok,
                rawText,
            };
            setHistory((prev) => [entry, ...prev].slice(0, 20));
        } catch (error) {
            const elapsedMs = Math.round(performance.now() - started);
            const message = error instanceof Error ? error.message : String(error);
            setStatus("error");
            setErrorMessage(message);
            setCurrentResult({
                rawText: message,
                elapsedMs,
                url: endpoint.url,
                name: endpoint.name,
            });
        }
    }, [meta.basePath]);

    React.useEffect(() => {
        if (!autoRefresh || !selectedEndpoint) {
            return;
        }
        const timer = window.setInterval(() => {
            void fetchEndpoint(selectedEndpoint);
        }, refreshIntervalMs);
        return () => window.clearInterval(timer);
    }, [autoRefresh, refreshIntervalMs, selectedEndpoint, fetchEndpoint]);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey && !event.altKey) {
                const target = event.target as HTMLElement | null;
                if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
                    return;
                }
                if (selectedEndpoint) {
                    void fetchEndpoint(selectedEndpoint);
                }
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedEndpoint, fetchEndpoint]);

    const statusTagColor = status === "ok" ? "success" : status === "error" ? "error" : status === "loading" ? "processing" : "default";
    const renderedHtml = currentResult ? formatOutputHtml(currentResult.rawText) : null;

    return (
        <ConfigProvider theme={getAntdThemeConfig(theme, { colorPrimary: "#2574ab", borderRadius: 4 })}>
            <Layout style={{ minHeight: "100vh" }}>
                <Layout.Header
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 24px",
                        borderBottom: "1px solid rgba(128, 128, 128, 0.2)",
                        height: 60,
                        lineHeight: "60px",
                    }}
                >
                    <Space size={12}>
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined />}
                            href={`${meta.basePath}/`}
                        >
                            Dashboard
                        </Button>
                        <Tag color="cyan" icon={<BugOutlined />}>DEV</Tag>
                        <Typography.Title level={1} style={{ margin: 0, fontSize: 20 }}>
                            QuickBox WS Debug Console
                        </Typography.Title>
                    </Space>
                    <Space size={16}>
                        <Space size={8}>
                            <Typography.Text type="secondary">Theme</Typography.Text>
                            <Segmented
                                size="small"
                                value={theme}
                                onChange={(val) => handleThemeChange(val as DashboardTheme)}
                                options={[
                                    { label: "Defaulted", value: "defaulted" },
                                    { label: "Smoked", value: "smoked" },
                                ]}
                            />
                        </Space>
                        <Space size={8}>
                            <Typography.Text type="secondary">Auto-refresh</Typography.Text>
                            <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
                            <Select
                                size="small"
                                value={refreshIntervalMs}
                                onChange={setRefreshIntervalMs}
                                style={{ width: 76 }}
                                options={[
                                    { value: 2000, label: "2s" },
                                    { value: 5000, label: "5s" },
                                    { value: 10000, label: "10s" },
                                    { value: 30000, label: "30s" },
                                ]}
                            />
                        </Space>
                        <Tag color={statusTagColor}>{status}</Tag>
                    </Space>
                </Layout.Header>

                <Layout.Content style={{ padding: 24, maxWidth: 1440, width: "100%", margin: "0 auto" }}>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={7}>
                            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                                <Card title="Widgets" size="small">
                                    <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                                        {widgetEndpoints.map((ep) => (
                                            <Button
                                                key={ep.url}
                                                block
                                                data-url={ep.url}
                                                type={selectedEndpoint?.url === ep.url ? "primary" : "default"}
                                                style={{ textAlign: "left", height: "auto", padding: "8px 12px" }}
                                                onClick={() => void fetchEndpoint(ep)}
                                                title={ep.description}
                                            >
                                                <div style={{ fontWeight: 600 }}>{ep.name}</div>
                                                <Typography.Text
                                                    type={selectedEndpoint?.url === ep.url ? undefined : "secondary"}
                                                    style={{ fontSize: 12, color: selectedEndpoint?.url === ep.url ? "rgba(255,255,255,0.85)" : undefined }}
                                                >
                                                    {ep.url}
                                                </Typography.Text>
                                            </Button>
                                        ))}
                                    </Space>
                                </Card>

                                <Card title="Services" size="small">
                                    <Space wrap size={[8, 8]}>
                                        {serviceEndpoints.map((ep) => (
                                            <Button
                                                key={ep.url}
                                                size="small"
                                                data-url={ep.url}
                                                type={selectedEndpoint?.url === ep.url ? "primary" : "default"}
                                                onClick={() => void fetchEndpoint(ep)}
                                                title={ep.description}
                                            >
                                                {ep.name.replace("Service: ", "")}
                                            </Button>
                                        ))}
                                    </Space>
                                </Card>

                                <Card title="Packages" size="small">
                                    <Space wrap size={[6, 6]}>
                                        {meta.packages.map((pkg) => (
                                            <Tag key={pkg.pkg}>{pkg.name}</Tag>
                                        ))}
                                    </Space>
                                </Card>
                            </Space>
                        </Col>

                        <Col xs={24} lg={17}>
                            <Card
                                title={<span id="result-title">{selectedEndpoint ? selectedEndpoint.name : "Select an endpoint"}</span>}
                                extra={(
                                    <Space>
                                        <Button
                                            icon={<ReloadOutlined />}
                                            disabled={!selectedEndpoint || status === "loading"}
                                            onClick={() => selectedEndpoint && void fetchEndpoint(selectedEndpoint)}
                                            title="Refresh (R)"
                                        >
                                            Refresh
                                        </Button>
                                        <Segmented
                                            value={viewMode}
                                            onChange={(val) => setViewMode(val as "rendered" | "raw")}
                                            options={[
                                                { label: "Rendered", value: "rendered", icon: <EyeOutlined /> },
                                                { label: "Raw", value: "raw", icon: <CodeOutlined /> },
                                            ]}
                                        />
                                    </Space>
                                )}
                            >
                                {currentResult && (
                                    <Space style={{ marginBottom: 12 }} wrap>
                                        <Tag color="blue">{currentResult.url}</Tag>
                                        <Tag>{currentResult.elapsedMs} ms</Tag>
                                    </Space>
                                )}

                                {errorMessage && (
                                    <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 12 }} />
                                )}

                                {status === "loading" && !currentResult ? (
                                    <div style={{ padding: 48, textAlign: "center" }}>
                                        <Spin />
                                    </div>
                                ) : !currentResult ? (
                                    <Empty description="Click any widget or service endpoint on the left to inspect its output." />
                                ) : viewMode === "rendered" ? (
                                    renderedHtml !== null ? (
                                        <ShadowHtmlPreview html={renderedHtml} theme={theme} />
                                    ) : (
                                        <pre
                                            id="result-rendered"
                                            style={{
                                                margin: 0,
                                                padding: 16,
                                                borderRadius: 4,
                                                overflow: "auto",
                                                maxHeight: 540,
                                                background: theme === "smoked" ? "#14161f" : "#f5f5f5",
                                            }}
                                        >
                                            <code>{formatRawPretty(currentResult.rawText)}</code>
                                        </pre>
                                    )
                                ) : (
                                    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                                        <Space style={{ justifyContent: "space-between", width: "100%" }}>
                                            <Typography.Text strong>
                                                Raw Output ({history.length} in history)
                                            </Typography.Text>
                                            <Space>
                                                <Button
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    disabled={history.length === 0}
                                                    onClick={() => setHistory([])}
                                                >
                                                    Clear All
                                                </Button>
                                                <Button
                                                    size="small"
                                                    icon={<ReloadOutlined />}
                                                    disabled={!selectedEndpoint}
                                                    onClick={() => selectedEndpoint && void fetchEndpoint(selectedEndpoint)}
                                                >
                                                    Reload
                                                </Button>
                                            </Space>
                                        </Space>

                                        {history.length > 0 && (
                                            <Space wrap size={[6, 6]}>
                                                {history.map((item) => (
                                                    <Tag
                                                        key={item.id}
                                                        color={item.ok ? "processing" : "error"}
                                                        style={{ cursor: "pointer" }}
                                                        onClick={() => setCurrentResult({
                                                            rawText: item.rawText,
                                                            elapsedMs: item.elapsedMs,
                                                            url: item.url,
                                                            name: item.name,
                                                        })}
                                                    >
                                                        {item.timestamp} · {item.name} ({item.elapsedMs}ms)
                                                    </Tag>
                                                ))}
                                            </Space>
                                        )}

                                        <pre
                                            id="result-rendered"
                                            style={{
                                                margin: 0,
                                                padding: 16,
                                                borderRadius: 4,
                                                overflow: "auto",
                                                maxHeight: 540,
                                                background: theme === "smoked" ? "#14161f" : "#f5f5f5",
                                            }}
                                        >
                                            <code>{formatRawPretty(currentResult.rawText)}</code>
                                        </pre>
                                    </Space>
                                )}
                            </Card>
                        </Col>
                    </Row>
                </Layout.Content>

                <Layout.Footer style={{ textAlign: "center" }}>
                    <Typography.Text type="secondary">
                        Press <Typography.Text keyboard>R</Typography.Text> to refresh · Development mode only
                    </Typography.Text>
                </Layout.Footer>
            </Layout>
        </ConfigProvider>
    );
}
