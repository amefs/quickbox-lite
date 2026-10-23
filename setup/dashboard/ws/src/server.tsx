// SPDX-License-Identifier: GPL-3.0-or-later

import "./testing/bootstrap";

import express from "express";
import http from "http";
import path from "path";
import { Server as socketio } from "socket.io";
import { WebSocketServer } from "ws";

import { assertProductionAuth, authorizeHandshake, gatewayAuthMiddleware } from "./auth";
import logHandler from "./handlers/log";
import messageHandler from "./handlers/message";
import execHandler from "./handlers/exec";
import i18nHandler from "./handlers/i18n";
import { isTestMode } from "./testing";
import { createAppRouter } from "./router";

const FATAL_EXIT_GRACE_MS = 1000;

/**
 * Records a fatal condition and leaves the process promptly and non-zero.
 * Setting `exitCode` alone is not enough: a live watcher keeps the event loop
 * busy, so a bounded timer forces the exit. No lock or state file is removed
 * here — a detached updater may still own them.
 */
function fatalExit(context: string, error?: unknown): void {
    let detail = "";
    if (error instanceof Error) {
        detail = `${error.name}: ${error.message}`;
    } else if (typeof error === "string") {
        detail = error;
    } else if (error !== undefined && error !== null) {
        detail = JSON.stringify(error);
    }
    console.error(`[quickbox-ws] fatal ${context}${detail !== "" ? `: ${detail}` : ""}`);
    process.exitCode = 1;
    setTimeout(() => {
        process.exit(1);
    }, FATAL_EXIT_GRACE_MS);
}

process.on("unhandledRejection", (reason) => {
    console.error("[quickbox-ws] unhandledRejection", reason);
    fatalExit("unhandledRejection", reason);
});
process.on("uncaughtException", (error) => {
    console.error("[quickbox-ws] uncaughtException", error);
    fatalExit("uncaughtException", error);
});

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

app.use(createAppRouter({
    dashboardDir,
    skinsDir: isTestMode() ? process.env.QUICKBOX_TEST_SKINS_DIR : undefined,
}));

export { app };

if (process.env.NODE_ENV !== "test" || process.env.MOCK_ENABLED === "1") {
    if (assertProductionAuth() !== null) {
        process.exit(1);
    }

    const host = process.env.WS_HOST || "127.0.0.1";
    const port = parseInt(process.env.WS_PORT || "8575", 10);
    server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            console.error(`[quickbox-ws] port ${port} is already in use on ${host}`);
        } else {
            console.error(`[quickbox-ws] failed to listen on http://${host}:${port}`, error);
        }
        process.exit(1);
    });
    server.listen(port, host, () => {
        console.log(`Quickbox-ws running on http://${host}:${port} ...`);
        if (isTestMode()) {
            console.log(`Mock mode enabled, profile: ${process.env.MOCK_PROFILE || "all-running"}`);
        }
    });
}
