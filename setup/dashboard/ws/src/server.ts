import * as express from "express";
import * as http from "http";
import { Server as socketio } from "socket.io";
import * as ws from "ws";

import logHandler from "./handler/log";
import messageHandler from "./handler/message";
import execHandler from "./handler/exec";


const app = express();
app.set("trust proxy", true);

const server = http.createServer(app);
const io = new socketio(server, { wsEngine: ws.Server });

io.use(logHandler);
io.use(messageHandler);
io.use(execHandler);

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

server.listen(8575, "127.0.0.1", () => {
    console.log("quickbox-ws running...");
});
