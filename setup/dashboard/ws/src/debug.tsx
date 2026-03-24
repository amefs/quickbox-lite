// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { serviceMap, packageList } from "./info";

interface WidgetEndpoint {
    name: string;
    url: string;
    description: string;
    category: "widget" | "service";
}

function getWidgetEndpoints(): WidgetEndpoint[] {
    const endpoints: WidgetEndpoint[] = [
        { name: "System Load", url: "/node/load.php", description: "CPU load averages and process count", category: "widget" },
        { name: "Network Status", url: "/node/net_status.php", description: "Network interface RX/TX bytes", category: "widget" },
        { name: "Uptime", url: "/node/up.php", description: "System uptime display", category: "widget" },
        { name: "Disk Data", url: "/node/disk_data.php", description: "Disk usage and torrent info", category: "widget" },
        { name: "RAM Stats", url: "/node/ram_stats.php", description: "Memory usage statistics", category: "widget" },
        { name: "Bandwidth - Hourly", url: "/node/bw_tables.php?page=h", description: "Bandwidth tables (hourly)", category: "widget" },
        { name: "Bandwidth - Daily", url: "/node/bw_tables.php?page=d", description: "Bandwidth tables (daily)", category: "widget" },
        { name: "Bandwidth - Monthly", url: "/node/bw_tables.php?page=m", description: "Bandwidth tables (monthly)", category: "widget" },
        { name: "Bandwidth - Top 10", url: "/node/bw_tables.php?page=t", description: "Bandwidth tables (top 10 days)", category: "widget" },
        { name: "SSH Output Log", url: "/db/output.log", description: "Incremental output log (supports ?offset=N&length=N)", category: "widget" },
    ];

    for (const [key] of serviceMap) {
        endpoints.push({
            name: `Service: ${key}`,
            url: `/node/service_status.php?service=${key}`,
            description: `Status badge for ${key}`,
            category: "service",
        });
    }

    return endpoints;
}

export function DebugPage() {
    const endpoints = getWidgetEndpoints();
    const widgetEndpoints = endpoints.filter(e => e.category === "widget");
    const serviceEndpoints = endpoints.filter(e => e.category === "service");

    const installedPackages = packageList
        .filter(p => p.lockfile)
        .map(p => ({ name: p.name, pkg: p.package }));

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>QuickBox WS Debug Console</title>
                <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />
                <style dangerouslySetInnerHTML={{ __html: STYLES }} />
            </head>
            <body>
                <div className="debug-container">
                    <header className="debug-header">
                        <div className="header-badge">DEV</div>
                        <h1>QuickBox WS Debug Console</h1>
                        <p className="subtitle">Click any endpoint to fetch and preview its output</p>
                    </header>

                    <div className="controls">
                        <div className="controls-left">
                            <label className="auto-refresh">
                                <input type="checkbox" id="auto-refresh-toggle" />
                                <span className="toggle-track"><span className="toggle-thumb" /></span>
                                Auto-refresh
                            </label>
                            <select id="refresh-interval" defaultValue="5000">
                                <option value="2000">2s</option>
                                <option value="5000">5s</option>
                                <option value="10000">10s</option>
                                <option value="30000">30s</option>
                            </select>
                        </div>
                        <span id="status-indicator" className="status-idle">idle</span>
                    </div>

                    <div className="main-layout">
                        <nav className="endpoint-list">
                            <h2>Widgets</h2>
                            <div className="endpoint-group">
                                {widgetEndpoints.map((ep, i) => (
                                    <button
                                        key={i}
                                        className="endpoint-btn"
                                        data-url={ep.url}
                                        data-name={ep.name}
                                        title={ep.description}
                                        style={{ animationDelay: `${i * 40}ms` }}
                                    >
                                        <span className="btn-name">{ep.name}</span>
                                        <span className="btn-url">{ep.url}</span>
                                    </button>
                                ))}
                            </div>

                            <h2>Services</h2>
                            <div className="endpoint-group services-group">
                                {serviceEndpoints.map((ep, i) => (
                                    <button
                                        key={i}
                                        className="endpoint-btn endpoint-btn-service"
                                        data-url={ep.url}
                                        data-name={ep.name}
                                        title={ep.description}
                                        style={{ animationDelay: `${(widgetEndpoints.length + i) * 40}ms` }}
                                    >
                                        <span className="btn-name">{ep.name.replace("Service: ", "")}</span>
                                    </button>
                                ))}
                            </div>

                            <h2>Packages</h2>
                            <div className="endpoint-group packages-info">
                                {installedPackages.map((p, i) => (
                                    <span key={i} className="package-tag" style={{ animationDelay: `${i * 30}ms` }}>{p.name}</span>
                                ))}
                            </div>
                        </nav>

                        <main className="result-panel">
                            <div className="result-header">
                                <h2 id="result-title">Select an endpoint</h2>
                                <div className="result-actions">
                                    <button id="btn-refresh" className="action-btn" disabled title="Refresh (R)">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                                        Refresh
                                    </button>
                                    <button id="btn-raw" className="action-btn" disabled>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                        Raw
                                    </button>
                                </div>
                            </div>
                            <div className="result-meta">
                                <span id="result-url"></span>
                                <span id="result-time"></span>
                            </div>
                            <div id="result-rendered" className="result-content"></div>
                            <div id="result-raw" className="result-raw" style={{ display: "none" }}>
                                <div className="raw-toolbar">
                                    <div className="raw-toolbar-title">Raw Output</div>
                                    <div className="raw-toolbar-actions">
                                        <button id="btn-history-clear" className="action-btn action-btn-small" disabled>Clear All</button>
                                        <button id="btn-history-reload" className="action-btn action-btn-small" disabled>Reload</button>
                                    </div>
                                </div>
                                <div id="result-raw-history" className="raw-history" style={{ display: "none" }}></div>
                                <pre id="result-raw-pre"><code id="result-raw-code"></code></pre>
                            </div>
                        </main>
                    </div>

                    <footer className="debug-footer">
                        <span>Press <kbd>R</kbd> to refresh</span>
                        <span className="separator">·</span>
                        <span>Development mode only</span>
                    </footer>
                </div>
                <script dangerouslySetInnerHTML={{ __html: CLIENT_SCRIPT }} />
            </body>
        </html>
    );
}

const STYLES = `
    :root {
        --color-primary: #259dab;
        --color-primary-light: #2bb8ca;
        --color-primary-dim: rgba(37, 157, 171, 0.15);
        --color-bg: #1c1f2e;
        --color-panel: #1a2340;
        --color-surface: #232942;
        --color-surface-hover: #2c3352;
        --color-border: #2e3550;
        --color-border-hover: #3d4565;
        --color-text: #d8dce4;
        --color-text-muted: #7a8194;
        --color-text-dim: #545b72;
        --color-success: #4ade80;
        --color-error: #f87171;
        --space-xs: 4px;
        --space-sm: 8px;
        --space-md: 16px;
        --space-lg: 24px;
        --space-xl: 40px;
        --radius-sm: 6px;
        --radius-md: 10px;
        --radius-lg: 14px;
        --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
        --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--color-bg);
        color: var(--color-text);
        min-height: 100vh;
        line-height: 1.5;
    }

    .debug-container {
        max-width: 1440px;
        margin: 0 auto;
        padding: var(--space-lg);
        animation: fadeIn 500ms var(--ease-out-expo) both;
    }

    /* Header */
    .debug-header {
        text-align: left;
        padding: var(--space-lg) 0 var(--space-lg);
        border-bottom: 1px solid var(--color-border);
        margin-bottom: var(--space-lg);
        display: flex;
        align-items: center;
        gap: var(--space-md);
        flex-wrap: wrap;
    }
    .header-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        background: var(--color-primary-dim);
        color: var(--color-primary-light);
        border: 1px solid rgba(37, 157, 171, 0.3);
        border-radius: var(--radius-sm);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
    }
    .debug-header h1 {
        font-size: 22px;
        font-weight: 600;
        color: var(--color-text);
        letter-spacing: -0.3px;
    }
    .subtitle {
        width: 100%;
        font-size: 13px;
        color: var(--color-text-muted);
        margin-top: -4px;
    }

    /* Controls bar */
    .controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding: var(--space-sm) var(--space-md);
        margin-bottom: var(--space-lg);
        background: var(--color-panel);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
    }
    .controls-left {
        display: flex;
        align-items: center;
        gap: var(--space-md);
    }

    /* Custom toggle switch */
    .auto-refresh {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        font-size: 13px;
        cursor: pointer;
        color: var(--color-text-muted);
        user-select: none;
        transition: color 250ms var(--ease-out-quart);
    }
    .auto-refresh:hover { color: var(--color-text); }
    .auto-refresh input { position: absolute; opacity: 0; pointer-events: none; }
    .toggle-track {
        position: relative;
        display: inline-block;
        width: 32px;
        height: 18px;
        background: var(--color-border);
        border-radius: 9px;
        transition: background 250ms var(--ease-out-quart);
        flex-shrink: 0;
    }
    .toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        background: var(--color-text-muted);
        border-radius: 50%;
        transition: transform 250ms var(--ease-out-quart), background 250ms var(--ease-out-quart);
    }
    .auto-refresh input:checked ~ .toggle-track {
        background: var(--color-primary-dim);
    }
    .auto-refresh input:checked ~ .toggle-track .toggle-thumb {
        transform: translateX(14px);
        background: var(--color-primary);
    }
    .auto-refresh input:focus-visible ~ .toggle-track {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
    }

    #refresh-interval {
        background: var(--color-surface);
        color: var(--color-text);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 4px 10px;
        font-size: 13px;
        font-family: inherit;
        transition: border-color 200ms var(--ease-out-quart);
    }
    #refresh-interval:hover { border-color: var(--color-border-hover); }
    #refresh-interval:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }

    /* Status badge */
    [id="status-indicator"] {
        font-size: 12px;
        font-weight: 600;
        padding: 3px 12px;
        border-radius: 12px;
        transition: all 300ms var(--ease-out-quart);
        white-space: nowrap;
    }
    .status-idle { background: var(--color-surface); color: var(--color-text-muted); }
    .status-loading { background: var(--color-primary-dim); color: var(--color-primary-light); animation: pulse 1.2s ease-in-out infinite; }
    .status-done { background: rgba(74, 222, 128, 0.12); color: var(--color-success); }
    .status-error { background: rgba(248, 113, 113, 0.12); color: var(--color-error); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    /* Main grid */
    .main-layout {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: var(--space-lg);
        align-items: start;
    }

    /* Sidebar */
    .endpoint-list {
        background: var(--color-panel);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-md);
        overflow-y: auto;
        max-height: calc(100vh - 240px);
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
    }
    .endpoint-list h2 {
        font-size: 11px;
        font-weight: 700;
        color: var(--color-text-muted);
        margin: var(--space-lg) 0 var(--space-sm);
        text-transform: uppercase;
        letter-spacing: 1.2px;
    }
    .endpoint-list h2:first-child { margin-top: var(--space-xs); }
    .endpoint-group { display: flex; flex-direction: column; gap: var(--space-xs); }
    .services-group { flex-direction: row; flex-wrap: wrap; gap: 6px; }

    /* Endpoint buttons — entrance animation */
    .endpoint-btn {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 14px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        cursor: pointer;
        text-align: left;
        color: var(--color-text);
        font-size: 13px;
        font-family: inherit;
        transition: background 200ms var(--ease-out-quart),
                    border-color 200ms var(--ease-out-quart),
                    transform 150ms var(--ease-out-quart),
                    box-shadow 200ms var(--ease-out-quart);
        animation: slideIn 400ms var(--ease-out-expo) both;
    }
    .endpoint-btn:hover {
        background: var(--color-surface);
        border-color: var(--color-border);
    }
    .endpoint-btn:active {
        transform: scale(0.98);
    }
    .endpoint-btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -1px;
    }
    .endpoint-btn.active {
        background: var(--color-primary-dim);
        border-color: rgba(37, 157, 171, 0.35);
    }
    .endpoint-btn.active .btn-name { color: var(--color-primary-light); }
    .btn-name { font-weight: 600; transition: color 200ms var(--ease-out-quart); }
    .btn-url { font-size: 11px; color: var(--color-text-dim); font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; }
    .endpoint-btn-service {
        flex-direction: row;
        padding: 6px 12px;
        border-radius: 16px;
        border: 1px solid var(--color-border);
    }
    .endpoint-btn-service:hover {
        border-color: var(--color-border-hover);
        background: var(--color-surface);
    }
    .endpoint-btn-service.active {
        background: var(--color-primary-dim);
        border-color: rgba(37, 157, 171, 0.35);
    }
    .endpoint-btn-service .btn-name { font-weight: 500; font-size: 12px; }

    /* Package tags */
    .package-tag {
        display: inline-block;
        padding: 3px 10px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 14px;
        font-size: 11px;
        color: var(--color-text-muted);
        animation: fadeInUp 350ms var(--ease-out-expo) both;
    }
    .packages-info { flex-direction: row; flex-wrap: wrap; gap: 6px; }

    /* Result panel */
    .result-panel {
        background: var(--color-panel);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        min-height: 480px;
        overflow: auto;
        animation: fadeIn 600ms var(--ease-out-expo) 200ms both;
    }
    .result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-sm);
    }
    .result-header h2 { font-size: 16px; font-weight: 600; color: var(--color-text); }

    .result-actions { display: flex; gap: var(--space-sm); }
    .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        font-weight: 500;
        transition: all 200ms var(--ease-out-quart);
    }
    .action-btn svg { flex-shrink: 0; }
    .action-btn:hover:not(:disabled) {
        background: var(--color-surface-hover);
        border-color: var(--color-border-hover);
        color: var(--color-text);
    }
    .action-btn:active:not(:disabled) { transform: scale(0.96); }
    .action-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
    .action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .action-btn.active {
        background: var(--color-primary-dim);
        border-color: rgba(37, 157, 171, 0.35);
        color: var(--color-primary-light);
    }

    .result-meta {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--color-text-dim);
        margin-bottom: var(--space-md);
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-border);
    }
    .result-meta span { font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; font-size: 11px; }

    .result-content {
        padding: var(--space-md);
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        min-height: 240px;
        transition: opacity 200ms var(--ease-out-quart);
    }
    .result-raw {
        padding: var(--space-md);
        background: #13152a;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        min-height: 240px;
    }
    .result-raw pre {
        white-space: pre-wrap;
        word-break: break-all;
        font-size: 12px;
        color: var(--color-text-muted);
        line-height: 1.7;
        font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    }
    .raw-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-border);
    }
    .raw-toolbar-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-dim);
    }
    .raw-toolbar-actions {
        display: flex;
        gap: var(--space-sm);
    }
    .action-btn-small {
        padding: 4px 10px;
        font-size: 11px;
    }
    .raw-history {
        display: grid;
        gap: var(--space-sm);
    }
    .raw-history-entry {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: rgba(255, 255, 255, 0.02);
        overflow: hidden;
    }
    .raw-history-meta {
        display: flex;
        justify-content: space-between;
        gap: var(--space-sm);
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid var(--color-border);
        font-size: 11px;
        color: var(--color-text-dim);
        font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    }
    .raw-history-body {
        padding: 10px 12px;
        font-size: 12px;
        line-height: 1.7;
        color: var(--color-text-muted);
        white-space: pre-wrap;
        word-break: break-word;
        font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    }
    .raw-history-empty {
        padding: 18px 14px;
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-dim);
        text-align: center;
        font-size: 12px;
    }

    /* Footer */
    .debug-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-sm);
        padding: var(--space-lg) 0 var(--space-sm);
        font-size: 12px;
        color: var(--color-text-dim);
    }
    .debug-footer kbd {
        display: inline-block;
        padding: 1px 6px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-family: inherit;
        font-size: 11px;
        color: var(--color-text-muted);
    }
    .debug-footer .separator { opacity: 0.4; }

    /* Entrance animations */
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Content load fade */
    .result-content.is-loading { opacity: 0.4; }

    /* Refresh spin animation */
    .action-btn.is-spinning svg {
        animation: spin 600ms linear;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }

    /* Responsive */
    @media (max-width: 860px) {
        .main-layout { grid-template-columns: 1fr; }
        .endpoint-list { max-height: none; }
        .debug-header { text-align: center; justify-content: center; }
        .controls { flex-direction: column; gap: var(--space-sm); }
        .controls-left { width: 100%; justify-content: center; }
    }
`;

const CLIENT_SCRIPT = `
(function() {
    var currentUrl = '';
    var refreshTimer = null;
    var showingRaw = false;
    var requestHistory = [];
    var currentEndpointName = '';
    var logState = {
        content: '',
        end: -1,
        size: 0
    };

    var buttons = document.querySelectorAll('.endpoint-btn');
    var resultTitle = document.getElementById('result-title');
    var resultUrl = document.getElementById('result-url');
    var resultTime = document.getElementById('result-time');
    var resultRendered = document.getElementById('result-rendered');
    var resultRaw = document.getElementById('result-raw');
    var resultRawHistory = document.getElementById('result-raw-history');
    var resultRawPre = document.getElementById('result-raw-pre');
    var resultRawCode = document.getElementById('result-raw-code');
    var btnRefresh = document.getElementById('btn-refresh');
    var btnRaw = document.getElementById('btn-raw');
    var btnHistoryClear = document.getElementById('btn-history-clear');
    var btnHistoryReload = document.getElementById('btn-history-reload');
    var statusIndicator = document.getElementById('status-indicator');
    var autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    var refreshIntervalSelect = document.getElementById('refresh-interval');

    // Shadow DOM for scoped widget CSS rendering
    var shadow = resultRendered.attachShadow({mode: 'open'});

    var quickCss = document.createElement('link');
    quickCss.rel = 'stylesheet';
    quickCss.href = '/debug/assets/skins/quick.css';
    shadow.appendChild(quickCss);

    var faCss = document.createElement('link');
    faCss.rel = 'stylesheet';
    faCss.href = '/debug/assets/lib/font-awesome/css/font-awesome.min.css';
    shadow.appendChild(faCss);

    var scopeStyle = document.createElement('style');
    scopeStyle.textContent = ':host { display: block; } '
        + '.widget-content { background: #f6f8fa; color: #333; padding: 14px; border-radius: 8px; min-height: 100px; '
        + 'font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.42857; '
        + 'transition: opacity 300ms cubic-bezier(0.25, 1, 0.5, 1); } '
        + '.widget-content .row::after { content: ""; display: table; clear: both; } '
        + '.placeholder-text { color: #8b92a5; font-style: normal; text-align: center; padding: 80px 20px; font-size: 14px; } '
        + '.placeholder-icon { display: block; font-size: 32px; margin-bottom: 12px; opacity: 0.4; }';
    shadow.appendChild(scopeStyle);

    var widgetContent = document.createElement('div');
    widgetContent.className = 'widget-content';
    widgetContent.innerHTML = '<p class="placeholder-text"><span class="placeholder-icon">&#9776;</span>Select an endpoint from the sidebar to preview its output</p>';
    shadow.appendChild(widgetContent);

    function setStatus(state, text) {
        statusIndicator.className = 'status-' + state;
        statusIndicator.textContent = text || state;
    }

    function isLogEndpoint(url) {
        return typeof url === 'string' && url.indexOf('/db/output.log') === 0;
    }

    function buildRequestUrl(url, forceReload) {
        if (!isLogEndpoint(url)) {
            return url;
        }
        if (forceReload || logState.end < 0) {
            return '/db/output.log';
        }
        return '/db/output.log?offset=' + encodeURIComponent(logState.end);
    }

    function resetLogState() {
        logState.content = '';
        logState.end = -1;
        logState.size = 0;
    }

    function pushHistory(entry) {
        requestHistory.unshift(entry);
        if (requestHistory.length > 50) {
            requestHistory.length = 50;
        }
        renderRawPanel();
    }

    function renderHistoryList() {
        if (!requestHistory.length) {
            resultRawHistory.innerHTML = '<div class="raw-history-empty">No request history yet</div>';
            return;
        }
        resultRawHistory.innerHTML = requestHistory.map(function(entry) {
            return '<div class="raw-history-entry">'
                + '<div class="raw-history-meta">'
                + '<span>' + escapeHtml(entry.time) + '</span>'
                + '<span>' + escapeHtml(entry.url) + '</span>'
                + '</div>'
                + '<div class="raw-history-body">' + escapeHtml(entry.body) + '</div>'
                + '</div>';
        }).join('');
    }

    function renderRawPanel() {
        var logMode = isLogEndpoint(currentUrl);
        btnHistoryClear.disabled = !requestHistory.length;
        btnHistoryReload.disabled = !currentUrl;

        if (logMode) {
            resultRawHistory.style.display = 'grid';
            resultRawPre.style.display = 'none';
            renderHistoryList();
        } else {
            resultRawHistory.style.display = 'none';
            resultRawPre.style.display = 'block';
        }
    }

    function renderLogContent() {
        if (!logState.content) {
            widgetContent.innerHTML = '<p class="placeholder-text"><span class="placeholder-icon">&#128221;</span>No log output yet</p>';
            return;
        }
        widgetContent.innerHTML = '<pre style="color:#333;font-size:12px;white-space:pre-wrap;line-height:1.7;font-family:SF Mono,Cascadia Code,Fira Code,monospace">' + escapeHtml(logState.content) + '</pre>';
    }

    function updateLogState(data, forceReload) {
        if (forceReload || data.end < logState.end) {
            resetLogState();
        }
        if (typeof data.content === 'string' && data.content.length > 0) {
            logState.content += data.content;
        }
        if (typeof data.end === 'number') {
            logState.end = data.end;
        }
        if (typeof data.size === 'number') {
            logState.size = data.size;
        }
        renderLogContent();
    }

    function fetchEndpoint(url, name, forceReload) {
        currentUrl = url;
        currentEndpointName = name || url;
        resultTitle.textContent = name || url;
        resultUrl.textContent = url;
        btnRefresh.disabled = false;
        btnRaw.disabled = false;
        btnHistoryReload.disabled = false;

        buttons.forEach(function(b) {
            b.classList.toggle('active', b.getAttribute('data-url') === url);
        });

        setStatus('loading', 'loading\u2026');
        resultRendered.classList.add('is-loading');
        btnRefresh.classList.add('is-spinning');
        var startTime = performance.now();
        var requestUrl = buildRequestUrl(url, !!forceReload);

        if (forceReload && isLogEndpoint(url)) {
            resetLogState();
        }

        fetch('/debug/node?url=' + encodeURIComponent(requestUrl))
            .then(function(resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                var ct = resp.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    return resp.json().then(function(data) {
                        return { type: 'json', data: data };
                    });
                }
                return resp.text().then(function(text) {
                    return { type: 'html', data: text };
                });
            })
            .then(function(result) {
                var elapsed = (performance.now() - startTime).toFixed(0);
                resultTime.textContent = elapsed + 'ms';
                setStatus('done', elapsed + 'ms');

                if (isLogEndpoint(url) && result.type === 'json') {
                    updateLogState(result.data, !!forceReload);
                    pushHistory({
                        time: new Date().toLocaleTimeString(),
                        url: requestUrl,
                        body: JSON.stringify(result.data, null, 2)
                    });
                    resultRawCode.textContent = logState.content;
                } else if (result.type === 'json') {
                    var formatted = JSON.stringify(result.data, null, 2);
                    widgetContent.innerHTML = '<pre style="color:#333;font-size:12px;white-space:pre-wrap;line-height:1.7;font-family:SF Mono,Cascadia Code,Fira Code,monospace">' + escapeHtml(formatted) + '</pre>';
                    resultRawCode.textContent = formatted;
                    pushHistory({
                        time: new Date().toLocaleTimeString(),
                        url: requestUrl,
                        body: formatted
                    });
                } else {
                    widgetContent.innerHTML = result.data;
                    resultRawCode.textContent = result.data;
                    pushHistory({
                        time: new Date().toLocaleTimeString(),
                        url: requestUrl,
                        body: result.data
                    });
                }

                resultRendered.classList.remove('is-loading');
                btnRefresh.classList.remove('is-spinning');
                renderRawPanel();
                updateRawView();
            })
            .catch(function(err) {
                var elapsed = (performance.now() - startTime).toFixed(0);
                resultTime.textContent = elapsed + 'ms';
                setStatus('error', 'error');
                resultRendered.classList.remove('is-loading');
                btnRefresh.classList.remove('is-spinning');
                widgetContent.innerHTML = '<p style="color:#f87171;padding:20px;text-align:center">' + escapeHtml(err.message) + '</p>';
                resultRawCode.textContent = 'Error: ' + err.message;
                pushHistory({
                    time: new Date().toLocaleTimeString(),
                    url: requestUrl,
                    body: 'Error: ' + err.message
                });
                renderRawPanel();
            });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function updateRawView() {
        if (showingRaw) {
            resultRendered.style.display = 'none';
            resultRaw.style.display = 'block';
            btnRaw.classList.add('active');
        } else {
            resultRendered.style.display = 'block';
            resultRaw.style.display = 'none';
            btnRaw.classList.remove('active');
        }
    }

    buttons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var url = this.getAttribute('data-url');
            var name = this.getAttribute('data-name');
            fetchEndpoint(url, name);
        });
    });

    btnRefresh.addEventListener('click', function() {
        if (currentUrl) {
            fetchEndpoint(currentUrl, currentEndpointName);
        }
    });

    btnHistoryClear.addEventListener('click', function() {
        requestHistory = [];
        if (isLogEndpoint(currentUrl)) {
            resetLogState();
            renderLogContent();
        } else {
            resultRawCode.textContent = '';
        }
        renderRawPanel();
    });

    btnHistoryReload.addEventListener('click', function() {
        if (currentUrl) {
            fetchEndpoint(currentUrl, currentEndpointName, true);
        }
    });

    btnRaw.addEventListener('click', function() {
        showingRaw = !showingRaw;
        updateRawView();
    });

    function updateAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        if (autoRefreshToggle.checked && currentUrl) {
            var interval = parseInt(refreshIntervalSelect.value, 10);
            refreshTimer = setInterval(function() {
                if (currentUrl) {
                    fetchEndpoint(currentUrl, currentEndpointName);
                }
            }, interval);
        }
    }

    autoRefreshToggle.addEventListener('change', updateAutoRefresh);
    refreshIntervalSelect.addEventListener('change', updateAutoRefresh);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey && currentUrl
            && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            fetchEndpoint(currentUrl, currentEndpointName);
        }
    });
})();
`;
