import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as SocketIO from "socket.io";


import Constant from "../constant";
import { WatchedConfig } from "../watchedConfig";
import { CommandType,getFiles, buildCommand } from "./utils/command";


let configPath = path.join(__dirname, "commands.json");
if (!fs.existsSync(configPath)) {
    configPath = path.join(__dirname, "..", "commands.json");
}
const config = new WatchedConfig<CommandType>(configPath);
const quickboxUsers = getFiles("/root/.qbuser/");
const username = quickboxUsers.map(user => user.replace(".info", ""))[0];

const execOption = {
    env: { TERM: "xterm", ...process.env },
    timeout: 1000 * 60 * 114, // 114 minutes
    maxBuffer: 5 * 1024 * 1024, // 5 MiB
};

const execHandler = async (payload: string, client: SocketIO.Socket) => {
    const ret = {
        cmd: payload,
        success: true,
        message: "",
        stdout: "",
        stderr: "",
    };
    let template: string;
    try {
        template = buildCommand(payload, config, username);
    } catch (e) {
        ret.success = false;
        ret.message = "Invalid command";
        if (e instanceof Error) {
            ret.message = e.message;
        }
        client.emit(Constant.EVENT_EXEC, ret);
        return;
    }
    exec(template, execOption, (error, stdout, stderr) => {
        ret.stdout = stdout;
        ret.stderr = stderr;
        if (error) {
            ret.success = false;
            ret.message = "Execute Failed";
            if (error.killed && error.signal === "SIGTERM") {
                ret.message = "Execute Timeout";
            }
        }
        client.emit(Constant.EVENT_EXEC, ret);
    });
};

export default (client: SocketIO.Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_EXEC, payload => execHandler(payload, client));
    if (next) {
        next();
    }
};
