// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { serviceMap } from "./info";

interface WidgetEndpoint {
    name: string;
    url: string;
    description: string;
    category: "widget" | "service" | "management";
}

function getWidgetEndpoints(): WidgetEndpoint[] {
    const endpoints: WidgetEndpoint[] = [
        { name: "System Load", url: "/node/load", description: "CPU load averages and process count", category: "widget" },
        { name: "Network Status", url: "/node/net_status", description: "Network interface RX/TX bytes", category: "widget" },
        { name: "Uptime", url: "/node/up", description: "System uptime display", category: "widget" },
        { name: "Disk Data", url: "/node/disk_data", description: "Disk usage and torrent info", category: "widget" },
        { name: "RAM Stats", url: "/node/ram_stats", description: "Memory usage statistics", category: "widget" },
        { name: "Bandwidth - Hourly", url: "/node/bw_tables?page=h", description: "Bandwidth tables (hourly)", category: "widget" },
        { name: "Bandwidth - Daily", url: "/node/bw_tables?page=d", description: "Bandwidth tables (daily)", category: "widget" },
        { name: "Bandwidth - Monthly", url: "/node/bw_tables?page=m", description: "Bandwidth tables (monthly)", category: "widget" },
        { name: "Bandwidth - Top 10", url: "/node/bw_tables?page=t", description: "Bandwidth tables (top 10 days)", category: "widget" },
        { name: "SSH Output Log", url: "/db/output.log", description: "Incremental output log (supports ?offset=N&length=N)", category: "widget" },
        { name: "All Service Status", url: "/node/service_status_all", description: "Structured status for every configured service", category: "management" },
        { name: "Service Control Center", url: "/node/service_control", description: "Rendered service controls; actions are not triggered from this preview", category: "management" },
        { name: "Package Management Center", url: "/node/pmc", description: "Installed package and service management view", category: "management" },
        { name: "Running Tasks", url: "/node/task_status", description: "Current task and update status", category: "management" },
    ];

    for (const [key] of serviceMap) {
        endpoints.push({
            name: `Service: ${key}`,
            url: `/node/service_status?service=${key}`,
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
    const managementEndpoints = endpoints.filter(e => e.category === "management");

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>QuickBox WS Debug Console</title>
                <link rel="stylesheet" href="/css/debug.css" />
            </head>
            <body className="debug-page">
                <div className="debug-container">
                    <header className="debug-header">
                        <div className="header-main">
                            <div className="header-title">
                                <div className="header-badge">DEV</div>
                                <h1>QuickBox WS Debug Console</h1>
                            </div>
                        </div>

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
                    </header>

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

                            <h2>Management</h2>
                            <div className="endpoint-group">
                                {managementEndpoints.map((ep, i) => (
                                    <button
                                        key={ep.url}
                                        className="endpoint-btn"
                                        data-url={ep.url}
                                        data-name={ep.name}
                                        title={ep.description}
                                        style={{ animationDelay: `${(widgetEndpoints.length + serviceEndpoints.length + i) * 40}ms` }}
                                    >
                                        <span className="btn-name">{ep.name}</span>
                                        <span className="btn-url">{ep.url}</span>
                                    </button>
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
                <script src="/js/debug.js" />
            </body>
        </html>
    );
}
