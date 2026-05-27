// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

type AppStatus = "loading" | "ready" | "error";

function App() {
    const backendPath = useMemo(() => "/app", []);
    const [status, setStatus] = useState<AppStatus>("loading");
    const [details, setDetails] = useState<string>("Connecting to backend dashboard...");

    useEffect(() => {
        let active = true;

        fetch(`${backendPath}/node/dashboard_config`, { headers: { Accept: "application/json" } })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Backend returned ${response.status}`);
                }
                return response.json() as Promise<{ username: string; version: string; branch: string }>;
            })
            .then((config) => {
                if (!active) {
                    return;
                }
                setStatus("ready");
                setDetails(`Backend dashboard reachable: ${config.username || "unknown user"} @ ${config.version} (${config.branch})`);
            })
            .catch((error: unknown) => {
                if (!active) {
                    return;
                }
                setStatus("error");
                setDetails(error instanceof Error ? error.message : "Unable to reach backend dashboard");
            });

        return () => {
            active = false;
        };
    }, [backendPath]);

    return (
        <main style={{ minHeight: "100vh", background: "#0b1220", color: "#e2e8f0", fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(148, 163, 184, 0.18)", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#93c5fd" }}>Frontend local access</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>QuickBox dashboard via Vite</div>
                    <div style={{ fontSize: 13, color: "#cbd5e1" }}>{details}</div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <a href={`${backendPath}/`} target="_blank" rel="noreferrer" style={{ color: "#e2e8f0", textDecoration: "none", border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: 10, padding: "8px 12px" }}>
                        Open backend directly
                    </a>
                    <button type="button" onClick={() => window.location.reload()} style={{ background: "#38bdf8", color: "#062235", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 700 }}>
                        Refresh
                    </button>
                </div>
            </div>

            {status === "error" ? (
                <div style={{ padding: 16, color: "#fca5a5" }}>
                    Frontend can load, but the backend dashboard is unreachable. Start the backend dev server and refresh.
                </div>
            ) : null}

            <iframe
                title="QuickBox dashboard"
                src={`${backendPath}/`}
                style={{ width: "100%", height: "calc(100vh - 72px)", border: 0, background: "#fff" }}
            />
        </main>
    );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);