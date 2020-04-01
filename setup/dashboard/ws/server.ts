import axios from "axios";
import * as express from "express";
import * as https from "https";
import * as http from "http";
import * as socketio from "socket.io";
import { exec } from "child_process";

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const EVENT_CONNECTION = "connection";
const EVENT_DISCONNECT = "disconnect";
const EVENT_MESSAGE = "message";
const EVENT_EXEC = "exec";

const afetch = axios.create({
    baseURL: "http://localhost",
    timeout: 5000,
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
    }),
});

const parseUrl = (url: string) => {
    let u: URL;
    if (url.toLowerCase().startsWith("http")) {
        u = new URL(url);
    } else {
        u = new URL(url, "place://holder");
    }
    const pathName = u.pathname;
    const args = {};
    u.searchParams.forEach((v, k) => {
        args[k] = v;
    });
    return {
        pathName,
        args,
    };
};

const messageHandler = async (payload: string, client: SocketIO.Socket) => {
    const ret = {
        pathName: payload,
        success: true,
        message: "",
        response: "",
    };
    try {
        const req = parseUrl(payload);
        ret.response = (await afetch.get(req.pathName, { params: req.args })).data;
    } catch (error) {
        ret.message = error ? error.toString() : "Unknown error";
        ret.success = false;
    } finally {
        client.send(ret);
    }
};

const execHandler = async (payload: string, client: SocketIO.Socket) => {
    const ret = {
        cmd: payload,
        success: true,
        message: "",
        stdout: "",
        stderr: "",
    };
    exec(payload, (error, stdout, stderr) => {
        ret.stdout = stdout;
        ret.stderr = stderr;
        if (error) {
            ret.success = false;
            ret.message = error.toString();
        }
        client.emit(EVENT_EXEC, ret);
    });
};

io.on(EVENT_CONNECTION, client => {
    console.log(client.id, "connect");
    client.on(EVENT_MESSAGE, message => { messageHandler(message, client); });
    client.on(EVENT_EXEC, message => { execHandler(message, client); });
    client.on(EVENT_DISCONNECT, () => { console.log(client.id, "disconnect"); });
});

server.listen(8575, "127.0.0.1", () => {
    console.log("quickbox-ws running...");
});
