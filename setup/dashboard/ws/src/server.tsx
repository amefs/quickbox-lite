// SPDX-License-Identifier: GPL-3.0-or-later

import express from "express";
import http from "http";
import { Server as socketio } from "socket.io";
import ws from "ws";
import React from "react";
import ReactDOMServer from "react-dom/server";

import logHandler from "./handler/log";
import messageHandler from "./handler/message";
import execHandler from "./handler/exec";
import i18nHandler from "./handler/i18n";
import i18n from "./i18n";

const app = express();
app.set("trust proxy", true);

const server = http.createServer(app);
const io = new socketio(server, { wsEngine: ws.Server });

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
    const lang = req.query.lang;
    if (typeof lang === "string") {
        i18n.locale = lang;
    } else {
        i18n.locale = "en";
    }
    res.send(i18n.locale);
});

server.listen(8575, "127.0.0.1", () => {
    console.log("Quickbox-ws running...");
});
