// SPDX-License-Identifier: GPL-3.0-or-later

function createLine(text: string): HTMLDivElement {
    const line = document.createElement("div");
    line.textContent = text;
    return line;
}

function createButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
}

async function loadBackendStatus(backendPath: string): Promise<string> {
    const response = await fetch(`${backendPath}/node/dashboard_config`, {
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
    }

    const config = await response.json() as { username: string; version: string; branch: string };
    const username = config.username || "unknown user";
    return `Backend dashboard reachable: ${username} @ ${config.version} (${config.branch})`;
}

function mountApp() {
    const backendPath = "/app";

    document.title = "QuickBox Lite Frontend Debug";

    const root = document.getElementById("root");
    if (!root) {
        throw new Error("Missing root element");
    }

    root.innerHTML = "";
    root.style.minHeight = "100vh";
    root.style.background = "#0b1220";
    root.style.color = "#e2e8f0";
    root.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const topbar = document.createElement("div");
    topbar.style.padding = "16px";
    topbar.style.borderBottom = "1px solid rgba(148, 163, 184, 0.18)";
    topbar.style.display = "flex";
    topbar.style.justifyContent = "space-between";
    topbar.style.alignItems = "center";
    topbar.style.gap = "16px";
    topbar.style.flexWrap = "wrap";

    const titleWrap = document.createElement("div");
    titleWrap.append(
        createLine("Frontend local access"),
        createLine("QuickBox dashboard via Vite"),
    );
    titleWrap.firstElementChild?.setAttribute("style", "font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#93c5fd;");
    titleWrap.children[1].setAttribute("style", "font-size:18px;font-weight:700;");

    const statusLine = createLine("Connecting to backend dashboard...");
    statusLine.style.fontSize = "13px";
    statusLine.style.color = "#cbd5e1";
    titleWrap.append(statusLine);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "12px";

    const openBackend = document.createElement("a");
    openBackend.href = `${backendPath}/`;
    openBackend.target = "_blank";
    openBackend.rel = "noreferrer";
    openBackend.textContent = "Open backend directly";
    openBackend.style.color = "#e2e8f0";
    openBackend.style.textDecoration = "none";
    openBackend.style.border = "1px solid rgba(148, 163, 184, 0.3)";
    openBackend.style.borderRadius = "10px";
    openBackend.style.padding = "8px 12px";

    const refresh = createButton("Refresh", () => window.location.reload());
    refresh.style.background = "#38bdf8";
    refresh.style.color = "#062235";
    refresh.style.border = "0";
    refresh.style.borderRadius = "10px";
    refresh.style.padding = "8px 12px";
    refresh.style.fontWeight = "700";

    actions.append(openBackend, refresh);
    topbar.append(titleWrap, actions);

    const notice = document.createElement("div");
    notice.style.padding = "16px";
    notice.style.color = "#fca5a5";
    notice.hidden = true;

    const iframe = document.createElement("iframe");
    iframe.title = "QuickBox dashboard";
    iframe.src = `${backendPath}/`;
    iframe.style.width = "100%";
    iframe.style.height = "calc(100vh - 72px)";
    iframe.style.border = "0";
    iframe.style.background = "#fff";

    root.append(topbar, notice, iframe);

    void loadBackendStatus(backendPath)
        .then((message) => {
            statusLine.textContent = message;
            notice.hidden = true;
        })
        .catch((error: unknown) => {
            statusLine.textContent = error instanceof Error ? error.message : "Unable to reach backend dashboard";
            notice.textContent = "Frontend can load, but the backend dashboard is unreachable. Start the backend dev server and refresh.";
            notice.hidden = false;
        });
}

mountApp();