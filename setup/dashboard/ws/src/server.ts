import * as express from "express";
import * as http from "http";
import * as socketio from "socket.io";

import logHandler from "./handler/log";
import messageHandler from "./handler/message";
import execHandler from "./handler/exec";


const app = express();
app.set("trust proxy", true);

const server = http.createServer(app);
const io = socketio(server, { wsEngine: "ws" });

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
