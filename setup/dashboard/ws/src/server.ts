// SPDX-License-Identifier: GPL-3.0-or-later

import * as express from "express";
import * as http from "http";
import { Server as socketio } from "socket.io";
import * as ws from "ws";
import { upTime } from "./widgets/up";

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

const template = `<html>
    <head>
        <title>QuickBox Websocket</title>
    </head>
    <body>
    <pre>Request from $ip$</pre>
    </body>
</html>`;

app.get("/", (req, res) => {
    res.send(template.replace("$ip$", req.ip));
});

app.get("/uptime", (req, res) => {
    res.send(upTime());
});

app.get("/en", (req, res) => {
    i18n.locale = "en";
    res.send(i18n.locale);
});

app.get("/zh", (req, res) => {
    i18n.locale = "zh";
    res.send(i18n.locale);
});

server.listen(8575, "127.0.0.1", () => {
    console.log("Quickbox-ws running...");
});
