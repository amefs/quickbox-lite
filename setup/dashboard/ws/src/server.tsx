// SPDX-License-Identifier: GPL-3.0-or-later

import "./testing/bootstrap";

import express from "express";
import http from "http";
import path from "path";
import { Server as socketio } from "socket.io";
import { WebSocketServer } from "ws";
import React from "react";
import ReactDOMServer from "react-dom/server";

import logHandler from "./handler/log";
import messageHandler, { resolveWidget } from "./handler/message";
import execHandler from "./handler/exec";
import i18nHandler from "./handler/i18n";
import i18n, { VALID_LOCALES } from "./i18n";
import { DebugPage } from "./debug";
import { isTestMode, setActiveProfile } from "./testing";

const app = express();
app.set("trust proxy", true);

const server = http.createServer(app);
const io = new socketio(server, { wsEngine: WebSocketServer });

io.use(logHandler);
io.use(messageHandler);
io.use(execHandler);
io.use(i18nHandler);

app.get("/", (req, res) => {
    res.send(ReactDOMServer.renderToString(<html>
        <head>
            <title>QuickBox Websocket</title>
        </head>
        <body>
            <pre>Request from {req.ip}</pre>
        </body>
    </html>));
});

app.get("/set", (req, res) => {
    const remoteAddr = req.ip ?? "";
    const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
    if (!isLocal) {
        res.status(403).send("Forbidden");
        return;
    }
    const lang = req.query.lang;
    if (typeof lang === "string" && VALID_LOCALES.includes(lang)) {
        i18n.locale = lang;
    } else {
        i18n.locale = "en";
    }
    res.send(i18n.locale);
});


const dashboardDir = path.resolve(__dirname, "..", "..");
app.use("/debug/assets/skins", express.static(path.join(dashboardDir, "skins")));
app.use("/debug/assets/lib", express.static(path.join(dashboardDir, "lib")));
app.use("/debug/assets/fonts", express.static(path.join(dashboardDir, "fonts")));

app.get("/debug/node", async (req, res) => {
    const url = req.query.url;
    if (typeof url !== "string" || !url) {
        res.status(400).json({ error: "url query param required, e.g. /debug/node?url=/node/up.php" });
        return;
    }
    const result = await resolveWidget(url);
    res.send(result);
});

app.get("/debug", (_req, res) => {
    res.send(ReactDOMServer.renderToString(<DebugPage />));
});

// Test-only endpoint: switch mock profile
if (isTestMode()) {
    app.post("/test/profile", express.json(), (req, res) => {
        const { profile } = req.body as { profile?: string };
        if (typeof profile === "string") {
            setActiveProfile(profile);
            res.json({ ok: true, profile });
        } else {
            res.status(400).json({ error: "profile field required" });
        }
    });
}


export { app };

if (process.env.NODE_ENV !== "test" || process.env.MOCK_ENABLED === "1") {
    const host = process.env.WS_HOST || "127.0.0.1";
    const port = parseInt(process.env.WS_PORT || "8575", 10);
    server.listen(port, host, () => {
        console.log(`Quickbox-ws running on ${host}:${port}...`);
        if (isTestMode()) {
            console.log(`Mock mode enabled, profile: ${process.env.MOCK_PROFILE || "all-running"}`);
        }
    });
}
