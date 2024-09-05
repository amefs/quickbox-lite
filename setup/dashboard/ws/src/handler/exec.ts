// SPDX-License-Identifier: GPL-3.0-or-later

import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { Socket } from "socket.io";


import Constant, { username } from "../constant";
import { WatchedConfig } from "../watchedConfig";
import { CommandType, buildCommand } from "./utils/command";


let baseDir = __dirname;
let configPath = "";
let lookupDepth = 3;
while (lookupDepth-- > 0) {
    const filePath = path.join(baseDir, "config", "commands.json");
    if (fs.existsSync(filePath)) {
        configPath = filePath;
        break;
    }
    baseDir = path.join(baseDir, "..");
}
if (!configPath) {
    console.error("commonds.json not found for quickbox-ws");
}

const config = new WatchedConfig<CommandType>(configPath);

const execOption = {
    env: { TERM: "xterm", ...process.env },
    timeout: 1000 * 60 * 114, // 114 minutes
    maxBuffer: 5 * 1024 * 1024, // 5 MiB
};

const execHandler = (payload: string, client: Socket) => {
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
        ret.message = "Invalid Command";
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
            ret.message = "Execution Failed";
            if (error.killed && error.signal === "SIGTERM") {
                ret.message = "Execution Timeout";
            }
        }
        client.emit(Constant.EVENT_EXEC, ret);
    });
};

export default (client: Socket, next?: (err?: Error) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    client.on(Constant.EVENT_EXEC, payload => { execHandler(payload, client); });
    if (next) {
        next();
    }
};
