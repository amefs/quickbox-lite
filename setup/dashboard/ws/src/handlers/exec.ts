// SPDX-License-Identifier: GPL-3.0-or-later

import { exec, spawn, type ExecOptionsWithBufferEncoding } from "child_process";
import fs from "fs";
import path from "path";
import { Socket } from "socket.io";


import Constant, { username } from "../shared/constants";
import { WatchedConfig } from "../shared/watched-config";
import { CommandType, buildCommand } from "./utils/command";
import { runMockCommand } from "../testing/mock-adapter";


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
    env: { TERM: "xterm", PATH: process.env.PATH, LANG: process.env.LANG, LC_ALL: process.env.LC_ALL },
    encoding: "buffer",
    timeout: 1000 * 60 * 114, // 114 minutes
    maxBuffer: 5 * 1024 * 1024, // 5 MiB
};

const DEFAULT_MAX_PER_SOCKET = 2;
const DEFAULT_MAX_GLOBAL = 8;
const inflightBySocket = new WeakMap<Socket, number>();
let inflightGlobal = 0;

export function getDashboardDbDir() {
    return process.env.QUICKBOX_DASHBOARD_DB_DIR ?? "/srv/dashboard/db";
}

function outputLogPath() {
    return path.join(getDashboardDbDir(), "output.log");
}

function updatePidPath() {
    return path.join(getDashboardDbDir(), "update.pid");
}

function shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}

function isPersistentUpdate(payload: string) {
    const [command, operation] = payload.trim().split(":");
    return command === "box" && operation === "update";
}

export function isPidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export function isUpdateInProgress(pidPath = updatePidPath()): boolean {
    try {
        if (!fs.existsSync(pidPath)) {
            return false;
        }
        const pid = parseInt(fs.readFileSync(pidPath, "utf8").trim(), 10);
        if (!Number.isFinite(pid) || pid <= 0) {
            return false;
        }
        return isPidAlive(pid);
    } catch {
        return false;
    }
}

function buildPersistentUpdateScript(command: string) {
    return [
        `echo $$ > ${shellQuote(updatePidPath())}`,
        `exec 1>>${shellQuote(outputLogPath())} 2>&1`,
        "echo \"[$(date -Is)] quickbox update started (pid=$$)\"",
        command,
        "echo \"[$(date -Is)] quickbox update finished (exit=$?)\"",
        `rm -f ${shellQuote(updatePidPath())}`,
    ].join("\n");
}

function appendUpdateLauncherLog(message: string) {
    try {
        fs.mkdirSync(getDashboardDbDir(), { recursive: true });
        fs.appendFileSync(outputLogPath(), `${message}\n`);
    } catch {
        // The runner still attempts to write the same log path after it starts.
    }
}

function startPersistentUpdate(command: string) {
    const script = buildPersistentUpdateScript(command);
    const child = spawn("/bin/bash", ["-lc", script], {
        detached: true,
        stdio: "ignore",
        env: execOption.env,
    });
    child.unref();
    appendUpdateLauncherLog(`[${new Date().toISOString()}] quickbox update scheduled as detached process ${child.pid ?? "unknown"}`);
    return child.pid;
}

export function tryAcquireExecSlot(socket: Socket, maxPerSocket = DEFAULT_MAX_PER_SOCKET, maxGlobal = DEFAULT_MAX_GLOBAL): boolean {
    const current = inflightBySocket.get(socket) ?? 0;
    if (current >= maxPerSocket || inflightGlobal >= maxGlobal) {
        return false;
    }
    inflightBySocket.set(socket, current + 1);
    inflightGlobal += 1;
    return true;
}

export function releaseExecSlot(socket: Socket): void {
    const current = inflightBySocket.get(socket) ?? 0;
    if (current > 0) {
        inflightBySocket.set(socket, current - 1);
        inflightGlobal = Math.max(0, inflightGlobal - 1);
    }
}

export function resetExecSlotsForTests(): void {
    inflightGlobal = 0;
}

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
    if (!tryAcquireExecSlot(client)) {
        ret.success = false;
        ret.message = "Too many commands in progress";
        client.emit(Constant.EVENT_EXEC, ret);
        return;
    }
    const finish = () => {
        releaseExecSlot(client);
        client.emit(Constant.EVENT_EXEC, ret);
    };
    const mockResult = runMockCommand(payload);
    if (mockResult !== undefined) {
        ret.success = mockResult;
        ret.message = mockResult ? "Mock command completed" : "Mock command rejected";
        finish();
        return;
    }
    if (isPersistentUpdate(payload)) {
        try {
            if (isUpdateInProgress()) {
                ret.success = false;
                ret.message = "Update already in progress";
                finish();
                return;
            }
            const pid = startPersistentUpdate(template);
            ret.message = "Detached Update Started";
            ret.stdout = [
                `Launcher PID: ${pid ?? "unknown"}`,
                `PID file: ${updatePidPath()}`,
                `Log file: ${outputLogPath()}`,
            ].join("\n");
        } catch (e) {
            ret.success = false;
            ret.message = "Failed to start detached update";
            if (e instanceof Error) {
                ret.stderr = e.message;
            }
        }
        finish();
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
        finish();
    });
};

export default (client: Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_EXEC, payload => { execHandler(payload, client); });
    if (next) {
        next();
    }
};
