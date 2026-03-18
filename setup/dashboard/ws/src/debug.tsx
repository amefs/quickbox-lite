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
                <style dangerouslySetInnerHTML={{ __html: STYLES }} />
            </head>
            <body>
                <div className="debug-container">
                    <header className="debug-header">
                        <h1>QuickBox WS Debug Console</h1>
                        <p className="subtitle">Click any endpoint to fetch and preview its output</p>
                    </header>

                    <div className="controls">
                        <label className="auto-refresh">
                            <input type="checkbox" id="auto-refresh-toggle" />
                            Auto-refresh
                        </label>
                        <select id="refresh-interval">
                            <option value="2000">2s</option>
                            <option value="5000" selected>5s</option>
                            <option value="10000">10s</option>
                            <option value="30000">30s</option>
                        </select>
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
                                    >
                                        <span className="btn-name">{ep.name.replace("Service: ", "")}</span>
                                    </button>
                                ))}
                            </div>

                            <h2>Packages</h2>
                            <div className="endpoint-group packages-info">
                                {installedPackages.map((p, i) => (
                                    <span key={i} className="package-tag">{p.name}</span>
                                ))}
                            </div>
                        </nav>

                        <main className="result-panel">
                            <div className="result-header">
                                <h2 id="result-title">Select an endpoint</h2>
                                <div className="result-actions">
                                    <button id="btn-refresh" className="action-btn" disabled>Refresh</button>
                                    <button id="btn-raw" className="action-btn" disabled>Raw</button>
                                </div>
                            </div>
                            <div className="result-meta">
                                <span id="result-url"></span>
                                <span id="result-time"></span>
                            </div>
                            <div id="result-rendered" className="result-content"></div>
                            <div id="result-raw" className="result-raw" style={{ display: "none" }}>
                                <pre><code id="result-raw-code"></code></pre>
                            </div>
                        </main>
                    </div>
                </div>
                <script dangerouslySetInnerHTML={{ __html: CLIENT_SCRIPT }} />
            </body>
        </html>
    );
}

const STYLES = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif; background: #1a1a2e; color: #e0e0e0; min-height: 100vh; }
    .debug-container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .debug-header { text-align: center; padding: 20px 0; border-bottom: 1px solid #333; margin-bottom: 20px; }
    .debug-header h1 { font-size: 24px; color: #00d4ff; }
    .subtitle { font-size: 13px; color: #888; margin-top: 6px; }
    .controls { display: flex; align-items: center; gap: 12px; padding: 10px 0; margin-bottom: 16px; }
    .auto-refresh { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
    .auto-refresh input { cursor: pointer; }
    #refresh-interval { background: #2a2a4a; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 4px 8px; font-size: 13px; }
    .status-idle { font-size: 12px; padding: 2px 10px; border-radius: 10px; background: #333; color: #888; }
    .status-loading { font-size: 12px; padding: 2px 10px; border-radius: 10px; background: #1a3a5c; color: #00d4ff; animation: pulse 1s infinite; }
    .status-done { font-size: 12px; padding: 2px 10px; border-radius: 10px; background: #1a3c1a; color: #4ade80; }
    .status-error { font-size: 12px; padding: 2px 10px; border-radius: 10px; background: #3c1a1a; color: #f87171; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .main-layout { display: grid; grid-template-columns: 320px 1fr; gap: 20px; }
    .endpoint-list { background: #16213e; border-radius: 8px; padding: 16px; overflow-y: auto; max-height: calc(100vh - 200px); }
    .endpoint-list h2 { font-size: 14px; color: #00d4ff; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 1px; }
    .endpoint-list h2:first-child { margin-top: 0; }
    .endpoint-group { display: flex; flex-direction: column; gap: 4px; }
    .services-group { flex-direction: row; flex-wrap: wrap; gap: 6px; }
    .endpoint-btn { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: #1a1a2e; border: 1px solid #333; border-radius: 6px; cursor: pointer; text-align: left; transition: all 0.15s; color: #e0e0e0; font-size: 13px; }
    .endpoint-btn:hover { background: #2a2a4a; border-color: #00d4ff; }
    .endpoint-btn.active { background: #0a2a4a; border-color: #00d4ff; box-shadow: 0 0 8px rgba(0, 212, 255, 0.2); }
    .btn-name { font-weight: 600; }
    .btn-url { font-size: 11px; color: #666; font-family: monospace; }
    .endpoint-btn-service { flex-direction: row; padding: 6px 12px; }
    .endpoint-btn-service .btn-name { font-weight: 500; font-size: 12px; }
    .package-tag { display: inline-block; padding: 3px 10px; background: #2a2a4a; border-radius: 12px; font-size: 11px; color: #aaa; }
    .packages-info { flex-direction: row; flex-wrap: wrap; gap: 6px; }
    .result-panel { background: #16213e; border-radius: 8px; padding: 16px; min-height: 400px; overflow: auto; }
    .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .result-header h2 { font-size: 16px; color: #e0e0e0; }
    .result-actions { display: flex; gap: 8px; }
    .action-btn { padding: 5px 14px; background: #2a2a4a; border: 1px solid #444; border-radius: 4px; color: #ccc; cursor: pointer; font-size: 12px; transition: all 0.15s; }
    .action-btn:hover:not(:disabled) { background: #3a3a5a; border-color: #00d4ff; color: #fff; }
    .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .action-btn.active { background: #0a2a4a; border-color: #00d4ff; color: #00d4ff; }
    .result-meta { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #2a2a4a; }
    .result-meta span { font-family: monospace; }
    .result-content { padding: 12px; background: #1a1a2e; border-radius: 6px; min-height: 200px; }
    .result-raw { padding: 12px; background: #0d0d1a; border-radius: 6px; min-height: 200px; }
    .result-raw pre { white-space: pre-wrap; word-break: break-all; font-size: 12px; color: #aaa; line-height: 1.6; }
    @media (max-width: 800px) { .main-layout { grid-template-columns: 1fr; } .endpoint-list { max-height: none; } }
`;

const CLIENT_SCRIPT = `
(function() {
    var currentUrl = '';
    var refreshTimer = null;
    var showingRaw = false;

    var buttons = document.querySelectorAll('.endpoint-btn');
    var resultTitle = document.getElementById('result-title');
    var resultUrl = document.getElementById('result-url');
    var resultTime = document.getElementById('result-time');
    var resultRendered = document.getElementById('result-rendered');
    var resultRaw = document.getElementById('result-raw');
    var resultRawCode = document.getElementById('result-raw-code');
    var btnRefresh = document.getElementById('btn-refresh');
    var btnRaw = document.getElementById('btn-raw');
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
        + '.widget-content { background: #f6f8fa; color: #333; padding: 12px; border-radius: 6px; min-height: 100px; '
        + 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.42857; } '
        + '.widget-content .row::after { content: ""; display: table; clear: both; } '
        + '.placeholder-text { color: #999; font-style: italic; text-align: center; padding: 60px 0; }';
    shadow.appendChild(scopeStyle);

    var widgetContent = document.createElement('div');
    widgetContent.className = 'widget-content';
    widgetContent.innerHTML = '<p class="placeholder-text">Click an endpoint on the left to preview its output here.</p>';
    shadow.appendChild(widgetContent);

    function setStatus(state, text) {
        statusIndicator.className = 'status-' + state;
        statusIndicator.textContent = text || state;
    }

    function fetchEndpoint(url, name) {
        currentUrl = url;
        resultTitle.textContent = name || url;
        resultUrl.textContent = url;
        btnRefresh.disabled = false;
        btnRaw.disabled = false;

        buttons.forEach(function(b) {
            b.classList.toggle('active', b.getAttribute('data-url') === url);
        });

        setStatus('loading', 'loading...');
        var startTime = performance.now();

        fetch('/debug/node?url=' + encodeURIComponent(url))
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

                if (result.type === 'json') {
                    var formatted = JSON.stringify(result.data, null, 2);
                    widgetContent.innerHTML = '<pre style="color:#333;font-size:12px;white-space:pre-wrap">' + escapeHtml(formatted) + '</pre>';
                    resultRawCode.textContent = formatted;
                } else {
                    widgetContent.innerHTML = result.data;
                    resultRawCode.textContent = result.data;
                }

                updateRawView();
            })
            .catch(function(err) {
                var elapsed = (performance.now() - startTime).toFixed(0);
                resultTime.textContent = elapsed + 'ms';
                setStatus('error', 'error');
                widgetContent.innerHTML = '<p style="color:#f87171">Error: ' + escapeHtml(err.message) + '</p>';
                resultRawCode.textContent = 'Error: ' + err.message;
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
            fetchEndpoint(currentUrl, resultTitle.textContent);
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
                    fetchEndpoint(currentUrl, resultTitle.textContent);
                }
            }, interval);
        }
    }

    autoRefreshToggle.addEventListener('change', updateAutoRefresh);
    refreshIntervalSelect.addEventListener('change', updateAutoRefresh);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey && currentUrl) {
            e.preventDefault();
            fetchEndpoint(currentUrl, resultTitle.textContent);
        }
    });
})();
`;
