// SPDX-License-Identifier: GPL-3.0-or-later

import { exec, type ExecOptionsWithBufferEncoding } from "child_process";
import fs from "fs";
import path from "path";
import { Socket } from "socket.io";


import Constant, { username } from "../shared/constants";
import { WatchedConfig } from "../shared/watched-config";
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
    console.error("commands.json not found for quickbox-ws");
}

const config = new WatchedConfig<CommandType>(configPath);

const execOption: ExecOptionsWithBufferEncoding = {
    env: { TERM: "xterm", ...process.env },
    encoding: "buffer",
    timeout: 1000 * 60 * 114, // 114 minutes
    maxBuffer: 5 * 1024 * 1024, // 5 MiB
};

export function decodeExecOutput(raw: Buffer | string) {
    if (typeof raw === "string") {
        return raw;
    }

    const utf8 = raw.toString("utf8");
    if (!utf8.includes("\uFFFD")) {
        return utf8;
    }

    try {
        const gb18030 = new TextDecoder("gb18030").decode(raw);
        if (!gb18030.includes("\uFFFD")) {
            return gb18030;
        }
    } catch {
        // ignore decoder availability mismatch and keep utf8 output
    }

    return utf8;
}

const execHandler = (payload: unknown, client: Socket) => {
    if (typeof payload !== "string") {
        client.emit(Constant.EVENT_EXEC, { cmd: "", success: false, message: "Invalid payload", stdout: "", stderr: "" });
        return;
    }
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
        ret.stdout = decodeExecOutput(stdout);
        ret.stderr = decodeExecOutput(stderr);
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
    client.on(Constant.EVENT_EXEC, payload => { execHandler(payload, client); });
    if (next) {
        next();
    }
};
