(function() {
    var currentUrl = "";
    var refreshTimer = null;
    var activeRequestController = null;
    var requestSequence = 0;
    var showingRaw = false;
    var requestHistory = [];
    var currentEndpointName = "";
    var logState = {
        content: "",
        end: -1,
        size: 0,
        epoch: ""
    };

    var buttons = document.querySelectorAll(".endpoint-btn");
    var resultTitle = document.getElementById("result-title");
    var resultUrl = document.getElementById("result-url");
    var resultTime = document.getElementById("result-time");
    var resultRendered = document.getElementById("result-rendered");
    var resultRaw = document.getElementById("result-raw");
    var resultRawHistory = document.getElementById("result-raw-history");
    var resultRawPre = document.getElementById("result-raw-pre");
    var resultRawCode = document.getElementById("result-raw-code");
    var btnRefresh = document.getElementById("btn-refresh");
    var btnRaw = document.getElementById("btn-raw");
    var btnHistoryClear = document.getElementById("btn-history-clear");
    var btnHistoryReload = document.getElementById("btn-history-reload");
    var statusIndicator = document.getElementById("status-indicator");
    var autoRefreshToggle = document.getElementById("auto-refresh-toggle");
    var refreshIntervalSelect = document.getElementById("refresh-interval");
    var debugBasePath = (function() {
        var pathname = window.location.pathname || "";
        var debugIndex = pathname.lastIndexOf("/debug");
        if (debugIndex <= 0) {
            return "";
        }
        return pathname.slice(0, debugIndex);
    })();

    function withDebugBase(path) {
        return debugBasePath + path;
    }

    // Shadow DOM for scoped widget CSS rendering
    var shadow = resultRendered.attachShadow({mode: "open"});

    var quickCss = document.createElement("link");
    quickCss.rel = "stylesheet";
    quickCss.href = withDebugBase("/debug/assets/skins/quick.css");
    shadow.appendChild(quickCss);

    var faCss = document.createElement("link");
    faCss.rel = "stylesheet";
    faCss.href = withDebugBase("/debug/assets/lib/font-awesome/css/font-awesome.min.css");
    shadow.appendChild(faCss);

    var debugCss = document.createElement("link");
    debugCss.rel = "stylesheet";
    debugCss.href = withDebugBase("/css/debug.css");
    shadow.appendChild(debugCss);

    var widgetContent = document.createElement("div");
    widgetContent.className = "widget-content";
    widgetContent.innerHTML = "<p class=\"placeholder-text\"><span class=\"placeholder-icon\">&#9776;</span>Select an endpoint from the sidebar to preview its output</p>";
    shadow.appendChild(widgetContent);

    function setStatus(state, text) {
        statusIndicator.className = "status-" + state;
        statusIndicator.textContent = text || state;
    }

    function isLogEndpoint(url) {
        return typeof url === "string" && url.indexOf("/db/output.log") === 0;
    }

    function buildRequestUrl(url, forceReload) {
        if (!isLogEndpoint(url)) {
            return url;
        }
        if (forceReload || logState.end < 0) {
            return "/db/output.log";
        }
        return "/db/output.log?offset=" + encodeURIComponent(logState.end)
            + "&epoch=" + encodeURIComponent(logState.epoch);
    }

    function resetLogState() {
        logState.content = "";
        logState.end = -1;
        logState.size = 0;
        logState.epoch = "";
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
            resultRawHistory.innerHTML = "<div class=\"raw-history-empty\">No request history yet</div>";
            return;
        }
        resultRawHistory.innerHTML = requestHistory.map(function(entry) {
            return "<div class=\"raw-history-entry\">"
                + "<div class=\"raw-history-meta\">"
                + "<span>" + escapeHtml(entry.time) + "</span>"
                + "<span>" + escapeHtml(entry.url) + "</span>"
                + "</div>"
                + "<div class=\"raw-history-body\">" + escapeHtml(entry.body) + "</div>"
                + "</div>";
        }).join("");
    }

    function renderRawPanel() {
        var logMode = isLogEndpoint(currentUrl);
        btnHistoryClear.disabled = !requestHistory.length;
        btnHistoryReload.disabled = !currentUrl;

        if (logMode) {
            resultRawHistory.style.display = "grid";
            resultRawPre.style.display = "none";
            renderHistoryList();
        } else {
            resultRawHistory.style.display = "none";
            resultRawPre.style.display = "block";
        }
    }

    function renderLogContent() {
        if (!logState.content) {
            widgetContent.innerHTML = "<p class=\"placeholder-text\"><span class=\"placeholder-icon\">&#128221;</span>No log output yet</p>";
            return;
        }
        widgetContent.innerHTML = "<pre class=\"debug-data\">" + escapeHtml(logState.content) + "</pre>";
    }

    function updateLogState(data, forceReload) {
        var epochChanged = logState.epoch && data.epoch && data.epoch !== logState.epoch;
        var changed = forceReload || epochChanged || logState.end < 0 || data.end < logState.end
            || (typeof data.content === "string" && data.content.length > 0)
            || (typeof data.size === "number" && data.size !== logState.size);
        if (forceReload || epochChanged || data.end < logState.end) {
            resetLogState();
        }
        if (typeof data.content === "string" && data.content.length > 0) {
            logState.content += data.content;
        }
        if (typeof data.end === "number") {
            logState.end = data.end;
        }
        if (typeof data.size === "number") {
            logState.size = data.size;
        }
        if (typeof data.epoch === "string") {
            logState.epoch = data.epoch;
        }
        renderLogContent();
        return changed;
    }

    function fetchEndpoint(url, name, forceReload, isAutoRefresh) {
        if (isAutoRefresh && activeRequestController) {
            return;
        }
        if (activeRequestController) {
            activeRequestController.abort();
        }
        var requestId = ++requestSequence;
        var controller = new AbortController();
        activeRequestController = controller;
        currentUrl = url;
        currentEndpointName = name || url;
        widgetContent.dataset.readonly = url === "/node/service_control" || url === "/node/pmc" ? "true" : "false";
        resultTitle.textContent = name || url;
        resultUrl.textContent = url;
        btnRefresh.disabled = false;
        btnRaw.disabled = false;
        btnHistoryReload.disabled = false;

        buttons.forEach(function(b) {
            b.classList.toggle("active", b.getAttribute("data-url") === url);
        });

        setStatus("loading", "loading\u2026");
        resultRendered.classList.add("is-loading");
        btnRefresh.classList.add("is-spinning");
        var startTime = performance.now();
        var requestUrl = buildRequestUrl(url, !!forceReload);

        if (forceReload && isLogEndpoint(url)) {
            resetLogState();
        }

        fetch(withDebugBase("/debug/node?url=" + encodeURIComponent(requestUrl)), { signal: controller.signal })
            .then(function(resp) {
                if (!resp.ok) throw new Error("HTTP " + resp.status);
                var ct = resp.headers.get("content-type") || "";
                if (ct.includes("application/json")) {
                    return resp.json().then(function(data) {
                        return { type: "json", data };
                    });
                }
                return resp.text().then(function(text) {
                    return { type: "html", data: text };
                });
            })
            .then(function(result) {
                if (requestId !== requestSequence) return;
                var elapsed = (performance.now() - startTime).toFixed(0);
                resultTime.textContent = elapsed + "ms";
                setStatus("done", elapsed + "ms");

                if (isLogEndpoint(url) && result.type === "json") {
                    var logChanged = updateLogState(result.data, !!forceReload);
                    if (logChanged) {
                        pushHistory({
                            time: new Date().toLocaleTimeString(),
                            url: requestUrl,
                            body: JSON.stringify(result.data, null, 2)
                        });
                    }
                    resultRawCode.textContent = logState.content;
                } else if (result.type === "json") {
                    var formatted = JSON.stringify(result.data, null, 2);
                    var highlighted = highlightJson(formatted);
                    widgetContent.innerHTML = "<pre class=\"debug-data debug-json\">" + highlighted + "</pre>";
                    resultRawCode.innerHTML = highlighted;
                    pushHistory({
                        time: new Date().toLocaleTimeString(),
                        url: requestUrl,
                        body: formatted
                    });
                } else {
                    if (url === "/node/task_status" && !result.data.trim()) {
                        var emptyTaskState = document.createElement("p");
                        emptyTaskState.className = "placeholder-text";
                        emptyTaskState.textContent = "No background task is currently running";
                        widgetContent.replaceChildren(emptyTaskState);
                    } else {
                        widgetContent.innerHTML = result.data;
                    }
                    resultRawCode.textContent = result.data;
                    pushHistory({
                        time: new Date().toLocaleTimeString(),
                        url: requestUrl,
                        body: result.data
                    });
                }

                resultRendered.classList.remove("is-loading");
                btnRefresh.classList.remove("is-spinning");
                renderRawPanel();
                updateRawView();
            })
            .catch(function(err) {
                if (requestId !== requestSequence || err.name === "AbortError") return;
                var elapsed = (performance.now() - startTime).toFixed(0);
                resultTime.textContent = elapsed + "ms";
                setStatus("error", "error");
                resultRendered.classList.remove("is-loading");
                btnRefresh.classList.remove("is-spinning");
                widgetContent.innerHTML = "<p class=\"debug-preview-error\">" + escapeHtml(err.message) + "</p>";
                resultRawCode.textContent = "Error: " + err.message;
                pushHistory({
                    time: new Date().toLocaleTimeString(),
                    url: requestUrl,
                    body: "Error: " + err.message
                });
                renderRawPanel();
            })
            .finally(function() {
                if (requestId === requestSequence) {
                    activeRequestController = null;
                }
            });
    }

    function escapeHtml(text) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function highlightJson(text) {
        var tokenPattern = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
        var highlighted = "";
        var lastIndex = 0;
        var token;
        while ((token = tokenPattern.exec(text)) !== null) {
            highlighted += escapeHtml(text.slice(lastIndex, token.index));
            var tokenType = token[1] ? "key" : token[2] ? "string" : token[3] ? "number" : token[4] === "null" ? "null" : "boolean";
            highlighted += "<span class=\"json-" + tokenType + "\">" + escapeHtml(token[0]) + "</span>";
            lastIndex = tokenPattern.lastIndex;
        }
        return highlighted + escapeHtml(text.slice(lastIndex));
    }

    function updateRawView() {
        if (showingRaw) {
            resultRendered.style.display = "none";
            resultRaw.style.display = "block";
            btnRaw.classList.add("active");
        } else {
            resultRendered.style.display = "block";
            resultRaw.style.display = "none";
            btnRaw.classList.remove("active");
        }
    }

    buttons.forEach(function(btn) {
        btn.addEventListener("click", function() {
            var url = this.getAttribute("data-url");
            var name = this.getAttribute("data-name");
            fetchEndpoint(url, name);
        });
    });

    btnRefresh.addEventListener("click", function() {
        if (currentUrl) {
            fetchEndpoint(currentUrl, currentEndpointName);
        }
    });

    btnHistoryClear.addEventListener("click", function() {
        requestHistory = [];
        if (isLogEndpoint(currentUrl)) {
            resetLogState();
            renderLogContent();
        } else {
            resultRawCode.textContent = "";
        }
        renderRawPanel();
    });

    btnHistoryReload.addEventListener("click", function() {
        if (currentUrl) {
            fetchEndpoint(currentUrl, currentEndpointName, true);
        }
    });

    btnRaw.addEventListener("click", function() {
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
                    fetchEndpoint(currentUrl, currentEndpointName, false, true);
                }
            }, interval);
        }
    }

    autoRefreshToggle.addEventListener("change", updateAutoRefresh);
    refreshIntervalSelect.addEventListener("change", updateAutoRefresh);

    document.addEventListener("keydown", function(e) {
        if (e.key === "r" && !e.ctrlKey && !e.metaKey && currentUrl
            && e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT") {
            e.preventDefault();
            fetchEndpoint(currentUrl, currentEndpointName);
        }
    });
})();
