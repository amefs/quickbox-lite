// SPDX-License-Identifier: GPL-3.0-or-later

import { io } from "socket.io-client";

const WS_URL = process.env.TEST_WS_URL ?? "http://127.0.0.1:8575";
const WS_PATH = process.env.TEST_WS_PATH ?? "/socket.io";
const PING_COMMAND = process.env.TEST_WS_PING ?? "ping::";
const PING_INTERVAL = Number.parseInt(process.env.TEST_WS_INTERVAL ?? "1000", 10);
const MAX_PINGS = Number.isNaN(Number(process.env.TEST_WS_MAX_PINGS))
    ? undefined
    : Number(process.env.TEST_WS_MAX_PINGS);

let pingCount = 0;
let connectionError = false;
let idx = 0;

const socket = io(WS_URL, { path: WS_PATH });

socket.on("connect", () => {
    console.log(`[ws] connected with id: '${socket.id}'.`);
});

socket.on("pong", () => {
    console.log(`[ws${++idx}] pong`);
});
socket.on("message", (data) => {
    console.log(`[ws${++idx}] message:`, data);
});
socket.on("exec", (data) => {
    console.log(`[ws${++idx}] exec:`, data);
});
socket.on("disconnect", (reason) => {
    console.log(`[ws${++idx}] disconnect: ${reason}`);
    connectionError = true;
});
socket.on("error", (err) => {
    console.log(`[ws${++idx}] err:`, err);
    connectionError = true;
});

const timer = setInterval(() => {
    if (connectionError || (typeof MAX_PINGS === "number" && pingCount >= MAX_PINGS)) {
        clearInterval(timer);
        socket.close();
        return;
    }
    pingCount += 1;
    socket.emit("exec", PING_COMMAND);
}, Number.isNaN(PING_INTERVAL) ? 1000 : Math.max(100, PING_INTERVAL));

process.on("SIGINT", () => {
    console.log("Caught SIGINT, closing socket...");
    clearInterval(timer);
    socket.close();
});

console.log(`WS client running against ${WS_URL}${WS_PATH}`);
