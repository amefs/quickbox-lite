// SPDX-License-Identifier: GPL-3.0-or-later

import { exec, spawn, spawnSync, type ExecOptionsWithBufferEncoding } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
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

/**
 * Authoritative update lock. It lives outside /srv/dashboard so a dashboard
 * rsync (`--delete`) can never remove it, and outside the service's private
 * /tmp so the CLI and the WebSocket path share the same lock.
 */
export function getUpdateLockPath(): string {
    return process.env.QUICKBOX_UPDATE_LOCK ?? "/run/lock/quickbox-update.lock";
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
    } catch (error) {
        // A downgraded service user cannot signal another user's process. That is
        // a permission problem, not evidence that the process exited.
        return (error as NodeJS.ErrnoException).code === "EPERM";
    }
}

export function readUpdatePid(pidPath = updatePidPath()): number | null {
    try {
        if (!fs.existsSync(pidPath)) {
            return null;
        }
        const pid = parseInt(fs.readFileSync(pidPath, "utf8").trim(), 10);
        return Number.isFinite(pid) && pid > 0 ? pid : null;
    } catch {
        return null;
    }
}

export function isUpdateInProgress(pidPath = updatePidPath()): boolean {
    const pid = readUpdatePid(pidPath);
    return pid !== null && isPidAlive(pid);
}

/**
 * Non-destructive probe of the authoritative lock. `unknown` means flock is
 * unavailable (for example on a development macOS host), in which case the
 * launch still relies on the lock acquired inside the runner itself.
 */
export function probeUpdateLock(lockPath = getUpdateLockPath()): "free" | "busy" | "unknown" {
    try {
        const result = spawnSync("flock", ["-n", "-E", "75", lockPath, "true"], { timeout: 5000 });
        if (result.error) {
            return "unknown";
        }
        if (result.status === 0) {
            return "free";
        }
        if (result.status === 75) {
            return "busy";
        }
        return "unknown";
    } catch {
        return "unknown";
    }
}

export function buildUpdateRunnerScript(command: string, statusPath: string) {
    const lockPath = getUpdateLockPath();
    // The updater survives a restart of the WS unit (KillMode=process), but the
    // unit's PrivateTmp /tmp does not survive that restart. Keep the updater and
    // its health check on a persistent directory under the dashboard db instead.
    const updateTmpDir = path.join(getDashboardDbDir(), "tmp");
    const epochPath = path.join(getDashboardDbDir(), "output.log.epoch");
    // qbUpdate publishes this marker only after it owns both locks. When the
    // marker already exists, wait for it to change before reporting success so
    // a CLI update (which only holds the core lock) cannot be reported as a
    // successful Web launch. Legacy installs without a marker keep the old
    // immediate acknowledgement until the first new update creates one.
    return [
        `exec 9>${shellQuote(lockPath)} || { printf 'failed\\n' > ${shellQuote(statusPath)}; exit 78; }`,
        "if ! flock -n 9; then",
        `  printf 'busy\\n' > ${shellQuote(statusPath)}`,
        `  echo "[$(date -Is)] quickbox update skipped, another update holds ${lockPath}"`,
        "  exit 75",
        "fi",
        `if ! mkdir -p ${shellQuote(updateTmpDir)}; then`,
        `  printf 'failed\\n' > ${shellQuote(statusPath)}`,
        `  echo "[$(date -Is)] cannot create updater temporary directory ${updateTmpDir}"`,
        "  exit 78",
        "fi",
        `export TMPDIR=${shellQuote(updateTmpDir)}`,
        `cleanup() { exit_code=$?; rm -f ${shellQuote(updatePidPath())}; exit "$exit_code"; }`,
        "trap cleanup EXIT",
        "trap 'exit 129' HUP",
        "trap 'exit 130' INT",
        "trap 'kill -TERM \"${command_pid:-}\" 2>/dev/null || true; exit 143' TERM",
        `epoch_path=${shellQuote(epochPath)}`,
        'epoch_before=""',
        'if [[ -f "$epoch_path" ]]; then epoch_before=$(cat "$epoch_path" 2>/dev/null || true); fi',
        `bash -c ${shellQuote(command)} &`,
        "command_pid=$!",
        'if [[ -z "$epoch_before" ]]; then',
        `  printf 'ok\\n' > ${shellQuote(statusPath)}`,
        "else",
        "  acked=0",
        "  for ((attempt = 0; attempt < 30; attempt++)); do",
        '    epoch_after=$(cat "$epoch_path" 2>/dev/null || true)',
        '    if [[ -s "$epoch_path" && "$epoch_after" != "$epoch_before" ]]; then',
        `      printf 'ok\\n' > ${shellQuote(statusPath)}`,
        "      acked=1",
        "      break",
        "    fi",
        '    if ! kill -0 "$command_pid" 2>/dev/null; then break; fi',
        "    sleep 0.1",
        "  done",
        '  if [[ "$acked" -eq 0 ]]; then',
        '    if kill -0 "$command_pid" 2>/dev/null; then',
        `      printf 'ok\\n' > ${shellQuote(statusPath)}`,
        "    else",
        '      wait "$command_pid"',
        "      command_status=$?",
        '      if [[ "$command_status" -eq 75 ]]; then',
        `        printf 'busy\\n' > ${shellQuote(statusPath)}`,
        "      else",
        `        printf 'failed\\n' > ${shellQuote(statusPath)}`,
        "      fi",
        '      exit "$command_status"',
        "    fi",
        "  fi",
        "fi",
        `echo $$ > ${shellQuote(updatePidPath())}`,
        "wait \"$command_pid\"",
        "command_status=$?",
        "exit \"$command_status\"",
    ].join("\n");
}

function delay(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

function readTextFile(filePath: string): string {
    try {
        return fs.readFileSync(filePath, "utf8").trim();
    } catch {
        return "";
    }
}

export type UpdateLaunchState = "started" | "busy" | "failed";

export interface UpdateLaunchResult {
    state: UpdateLaunchState;
    pid?: number;
    detail?: string;
}

/**
 * Starts the detached updater and reports what the runner actually did. The
 * runner acquires the flock before touching anything; the caller only reports
 * success once that lock was acquired.
 */
export async function launchPersistentUpdate(command: string): Promise<UpdateLaunchResult> {
    if (probeUpdateLock() === "busy") {
        return { state: "busy", detail: "Update already in progress" };
    }

    const statusPath = path.join(os.tmpdir(), `quickbox-update-${process.pid}-${Date.now()}-${randomUUID()}.status`);
    const script = buildUpdateRunnerScript(command, statusPath);
    let childPid: number | undefined;
    try {
        const child = spawn("/bin/bash", ["-lc", script], {
            detached: true,
            stdio: "ignore",
            env: execOption.env,
        });
        child.unref();
        childPid = child.pid ?? undefined;
    } catch (error) {
        fs.rmSync(statusPath, { force: true });
        return { state: "failed", detail: error instanceof Error ? error.message : String(error) };
    }

    // Give the runner a bounded window to report the lock outcome.
    const deadline = Date.now() + 6000;
    let observed = "";
    while (Date.now() < deadline) {
        observed = readTextFile(statusPath);
        if (observed !== "") {
            break;
        }
        if (childPid !== undefined && !isPidAlive(childPid)) {
            break;
        }
        await delay(100);
    }
    fs.rmSync(statusPath, { force: true });

    if (observed === "busy") {
        return { state: "busy", detail: "Update already in progress" };
    }
    if (observed === "failed") {
        return { state: "failed", detail: "Update runner was refused before it owned the update locks" };
    }
    if (childPid !== undefined && observed === "" && !isPidAlive(childPid)) {
        return { state: "failed", detail: "Update runner exited before acquiring the lock" };
    }
    if (observed !== "ok") {
        return { state: "failed", detail: "Update runner did not confirm lock acquisition before timeout" };
    }
    return { state: "started", pid: childPid };
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
        launchPersistentUpdate(template)
            .then((result) => {
                if (result.state === "busy") {
                    ret.success = false;
                    ret.message = "Update already in progress";
                } else if (result.state === "failed") {
                    ret.success = false;
                    ret.message = "Failed to start detached update";
                    ret.stderr = result.detail ?? "";
                } else {
                    ret.message = "Detached Update Started";
                    ret.stdout = [
                        `Launcher PID: ${result.pid ?? "unknown"}`,
                        `Lock file: ${getUpdateLockPath()}`,
                        `PID file: ${updatePidPath()}`,
                        `Log file: ${outputLogPath()}`,
                    ].join("\n");
                }
                finish();
            })
            .catch((error: unknown) => {
                ret.success = false;
                ret.message = "Failed to start detached update";
                if (error instanceof Error) {
                    ret.stderr = error.message;
                }
                finish();
            });
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
