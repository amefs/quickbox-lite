// SPDX-License-Identifier: GPL-3.0-or-later

import "./testing/bootstrap";

import express from "express";
import http from "http";
import path from "path";
import { Server as socketio } from "socket.io";
import { WebSocketServer } from "ws";

import { authorizeHandshake, gatewayAuthMiddleware, warnIfGatewayMissing } from "./auth";
import logHandler from "./handlers/log";
import messageHandler from "./handlers/message";
import execHandler from "./handlers/exec";
import i18nHandler from "./handlers/i18n";
import { isTestMode } from "./testing";
import { createAppRouter } from "./router";

const app = express();
app.set("trust proxy", "loopback");
app.use(gatewayAuthMiddleware);

const dashboardDir = path.resolve(__dirname, "..", "..");

const server = http.createServer(app);
const socketOptions = {
    wsEngine: WebSocketServer,
    allowRequest: (req: http.IncomingMessage, callback: (err: string | null | undefined, success: boolean) => void) => {
        const result = authorizeHandshake(req);
        callback(result.ok ? null : (result.error ?? "forbidden"), result.ok);
    },
};
const io = new socketio(server, socketOptions);
const wsPathIo = new socketio(server, { ...socketOptions, path: "/ws/socket.io" });

for (const socketServer of [io, wsPathIo]) {
    socketServer.use(logHandler);
    socketServer.use(messageHandler);
    socketServer.use(execHandler);
    socketServer.use(i18nHandler);
}

app.use(createAppRouter({ dashboardDir }));

export { app };

process.on("unhandledRejection", (reason) => {
    console.error("[quickbox-ws] unhandledRejection", reason);
});
process.on("uncaughtException", (error) => {
    console.error("[quickbox-ws] uncaughtException", error);
});

if (process.env.NODE_ENV !== "test" || process.env.MOCK_ENABLED === "1") {
    warnIfGatewayMissing();
    const host = process.env.WS_HOST || "127.0.0.1";
    const port = parseInt(process.env.WS_PORT || "8575", 10);
    server.listen(port, host, () => {
        console.log(`Quickbox-ws running on http://${host}:${port} ...`);
        if (isTestMode()) {
            console.log(`Mock mode enabled, profile: ${process.env.MOCK_PROFILE || "all-running"}`);
        }
    });
}
