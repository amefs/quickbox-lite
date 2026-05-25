// SPDX-License-Identifier: GPL-3.0-or-later

import "./testing/bootstrap";

import express from "express";
import http from "http";
import path from "path";
import { Server as socketio } from "socket.io";
import { WebSocketServer } from "ws";

import logHandler from "./handlers/log";
import messageHandler from "./handlers/message";
import execHandler from "./handlers/exec";
import i18nHandler from "./handlers/i18n";
import { isTestMode } from "./testing";
import { createAppRouter } from "./router";

const app = express();
app.set("trust proxy", "loopback");

const dashboardDir = path.resolve(__dirname, "..", "..");

const server = http.createServer(app);
const io = new socketio(server, { wsEngine: WebSocketServer });
const wsPathIo = new socketio(server, { path: "/ws/socket.io", wsEngine: WebSocketServer });

for (const socketServer of [io, wsPathIo]) {
    socketServer.use(logHandler);
    socketServer.use(messageHandler);
    socketServer.use(execHandler);
    socketServer.use(i18nHandler);
}

app.use(createAppRouter({ dashboardDir }));

export { app };

if (process.env.NODE_ENV !== "test" || process.env.MOCK_ENABLED === "1") {
    const host = process.env.WS_HOST || "127.0.0.1";
    const port = parseInt(process.env.WS_PORT || "8575", 10);
    server.listen(port, host, () => {
        console.log(`Quickbox-ws running on http://${host}:${port} ...`);
        if (isTestMode()) {
            console.log(`Mock mode enabled, profile: ${process.env.MOCK_PROFILE || "all-running"}`);
        }
    });
}
