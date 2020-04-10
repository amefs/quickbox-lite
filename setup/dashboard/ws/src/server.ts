import * as express from "express";
import * as http from "http";
import * as socketio from "socket.io";

import logHandler from "./handler/log";
import messageHandler from "./handler/message";
import execHandler from "./handler/exec";


const app = express();
const server = http.createServer(app);
const io = socketio(server);

io.use(logHandler);
io.use(messageHandler);
io.use(execHandler);

app.get("/", (req, res) => {
    res.send("QuickBox Websocket");
});

server.listen(8575, "127.0.0.1", () => {
    console.log("quickbox-ws running...");
});
