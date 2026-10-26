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
import { invalidateServiceState, refreshServiceState } from "../widgets/service-state";
import { runMockCommand } from "../testing/mock-adapter";
import { serviceMap } from "../info";
import { isServiceEnabled } from "../widgets/panels";
import { serviceStatusAll } from "../widgets/service-status";
import { VALID_LOCALES, withLocale } from "../i18n";

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

// The runner is started without a login shell, so nothing fills in PATH from
// /etc/profile any more. Name a sane default instead of exporting the string
// "undefined" when the unit environment is bare, and skip the locale variables
// when they are unset (LC_ALL=undefined only earns a setlocale warning).
const FALLBACK_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

function buildExecEnvironment(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { TERM: "xterm", PATH: process.env.PATH || FALLBACK_PATH };
    if (process.env.LANG) {
        env.LANG = process.env.LANG;
    }
    if (process.env.LC_ALL) {
        env.LC_ALL = process.env.LC_ALL;
    }
    return env;
}

const execOption: ExecOptionsWithBufferEncoding = {
    env: buildExecEnvironment(),
    encoding: "buffer",
    timeout: 1000 * 60 * 114, // 114 minutes
    maxBuffer: 5 * 1024 * 1024, // 5 MiB
};
const serviceActionExecOption: ExecOptionsWithBufferEncoding = { ...execOption, timeout: 15_000 };
const serviceActionsInFlight = new Set<string>();
const serviceActionOperations = {
    enable: ["enable", "start"],
    disable: ["stop", "disable"],
    restart: ["restart"],
} as const;

function isServiceAction(value: string): value is keyof typeof serviceActionOperations {
    return Object.prototype.hasOwnProperty.call(serviceActionOperations, value);
}

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

// The launcher's own lock, distinct from the core lock that qbUpdate takes to
// serialize the update body. Holding it means a web-triggered update is already
// starting or running; a CLI update does not take it.
export function getWebLauncherLockPath(): string {
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

export function probeWebLauncherLock(lockPath = getWebLauncherLockPath()): "free" | "busy" | "unknown" {
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

export const UPDATE_ACK_PENDING = "pending";
export const UPDATE_ACK_OK = "ok";
export const UPDATE_ACK_BUSY = "busy";
export const UPDATE_ACK_FAILED = "failed";

export function buildUpdateRunnerScript(command: string, statusPath: string) {
    const lockPath = getWebLauncherLockPath();
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
    //
    // The first write is an acknowledgement of a different kind: it proves the
    // runner exists, so a caller that finds no status at all knows the shell
    // never started instead of guessing why nothing was written.
    return [
        `printf '${UPDATE_ACK_PENDING}\\n' > ${shellQuote(statusPath)}`,
        `exec 9>${shellQuote(lockPath)} || { printf '${UPDATE_ACK_FAILED}\\n' > ${shellQuote(statusPath)}; exit 78; }`,
        "if ! flock -n 9; then",
        `  printf '${UPDATE_ACK_BUSY}\\n' > ${shellQuote(statusPath)}`,
        `  echo "[$(date -Is)] quickbox update skipped, another update holds ${lockPath}"`,
        "  exit 75",
        "fi",
        `if ! mkdir -p ${shellQuote(updateTmpDir)}; then`,
        `  printf '${UPDATE_ACK_FAILED}\\n' > ${shellQuote(statusPath)}`,
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
        `  printf '${UPDATE_ACK_OK}\\n' > ${shellQuote(statusPath)}`,
        "else",
        "  acked=0",
        "  for ((attempt = 0; attempt < 30; attempt++)); do",
        '    epoch_after=$(cat "$epoch_path" 2>/dev/null || true)',
        '    if [[ -s "$epoch_path" && "$epoch_after" != "$epoch_before" ]]; then',
        `      printf '${UPDATE_ACK_OK}\\n' > ${shellQuote(statusPath)}`,
        "      acked=1",
        "      break",
        "    fi",
        '    if ! kill -0 "$command_pid" 2>/dev/null; then break; fi',
        "    sleep 0.1",
        "  done",
        '  if [[ "$acked" -eq 0 ]]; then',
        '    if kill -0 "$command_pid" 2>/dev/null; then',
        `      printf '${UPDATE_ACK_OK}\\n' > ${shellQuote(statusPath)}`,
        "    else",
        '      wait "$command_pid"',
        "      command_status=$?",
        '      if [[ "$command_status" -eq 75 ]]; then',
        `        printf '${UPDATE_ACK_BUSY}\\n' > ${shellQuote(statusPath)}`,
        "      else",
        `        printf '${UPDATE_ACK_FAILED}\\n' > ${shellQuote(statusPath)}`,
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

// The runner acknowledges within a second on a healthy box: it reports the lock
// outcome as soon as qbUpdate owns both locks, which is a few hundred
// milliseconds of shell startup away. The window is far wider than that because
// a slow box (NSS lookup for the service user, a contended /run/lock, a busy
// disk) can delay the acknowledgement without preventing the update.
//
// Past the window the decision rests on whether the runner is still alive, not
// on the clock. A live runner means the update is starting; treating a missed
// acknowledgement as a launch failure is what produced "Failed to start
// detached update" next to an update that was in fact running.
export const UPDATE_ACK_TIMEOUT_MS = 9000;

export interface LaunchObservation {
    // The last acknowledgement the runner published, "" when it published none.
    observed: string;
    // Whether the runner process still existed when the wait ended.
    childAlive: boolean;
}

export function interpretLaunchStatus({ observed, childAlive }: LaunchObservation): UpdateLaunchResult {
    if (observed === UPDATE_ACK_BUSY) {
        return { state: "busy", detail: "Update already in progress" };
    }
    if (observed === UPDATE_ACK_FAILED) {
        return { state: "failed", detail: "Update runner was refused before it owned the update locks" };
    }
    if (observed === UPDATE_ACK_OK) {
        return { state: "started" };
    }
    if (childAlive) {
        return {
            state: "started",
            detail: `Update runner is alive but did not confirm the update lock within ${UPDATE_ACK_TIMEOUT_MS / 1000}s`,
        };
    }
    return {
        state: "failed",
        detail: observed === "" ? "Update runner exited before acquiring the lock" : "Update runner stopped before confirming the update lock",
    };
}

export async function launchPersistentUpdate(command: string): Promise<UpdateLaunchResult> {
    if (probeWebLauncherLock() === "busy") {
        return { state: "busy", detail: "Update already in progress" };
    }

    const statusPath = path.join(os.tmpdir(), `quickbox-update-${process.pid}-${Date.now()}-${randomUUID()}.status`);
    const script = buildUpdateRunnerScript(command, statusPath);
    let childPid: number | undefined;
    try {
        // Not a login shell: the script only needs PATH, and /etc/profile is an
        // unbounded amount of work that used to run before the acknowledgement.
        const child = spawn("/bin/bash", ["-c", script], {
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

    const deadline = Date.now() + UPDATE_ACK_TIMEOUT_MS;
    let observed = "";
    while (Date.now() < deadline) {
        observed = readTextFile(statusPath);
        if (observed !== "" && observed !== UPDATE_ACK_PENDING) {
            break;
        }
        if (childPid !== undefined && !isPidAlive(childPid)) {
            break;
        }
        await delay(100);
    }
    const childAlive = childPid !== undefined && isPidAlive(childPid);
    fs.rmSync(statusPath, { force: true });

    const result = interpretLaunchStatus({ observed, childAlive });
    return result.state === "started" ? { ...result, pid: childPid } : result;
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

function executeServiceCommand(payload: string): Promise<{ success: boolean; message: string; stdout: string; stderr: string }> {
    let template: string;
    try {
        template = buildCommand(payload, config, username);
    } catch (error) {
        return Promise.resolve({
            success: false,
            message: error instanceof Error ? error.message : "Invalid command",
            stdout: "",
            stderr: "",
        });
    }
    const mockResult = runMockCommand(payload);
    if (mockResult !== undefined) {
        return Promise.resolve({
            success: mockResult,
            message: mockResult ? "Mock command completed" : "Mock command rejected",
            stdout: "",
            stderr: "",
        });
    }
    return new Promise((resolve) => {
        exec(template, serviceActionExecOption, (error, stdout, stderr) => {
            resolve({
                success: !error,
                message: error ? (error.killed ? "Service command timed out" : "Service command failed") : "",
                stdout: decodeExecOutput(stdout),
                stderr: decodeExecOutput(stderr),
            });
        });
    });
}

interface ServiceActionPayload {
    requestId?: unknown;
    service?: unknown;
    action?: unknown;
    locale?: unknown;
}

async function serviceActionHandler(payload: unknown, client: Socket) {
    const request = payload !== null && typeof payload === "object" ? payload as ServiceActionPayload : {};
    const response: {
        requestId?: string;
        service: string;
        action: string;
        success: boolean;
        message: string;
        phase?: "action-complete" | "status-confirmed";
        statusError?: string;
        failedOperation?: string;
        completedOperations: string[];
        stdout: string;
        stderr: string;
        enabled?: boolean;
        status?: Awaited<ReturnType<typeof serviceStatusAll>>;
    } = {
        requestId: typeof request.requestId === "string" ? request.requestId : undefined,
        service: typeof request.service === "string" ? request.service : "",
        action: typeof request.action === "string" ? request.action : "",
        success: false,
        message: "Invalid service action",
        completedOperations: [],
        stdout: "",
        stderr: "",
    };

    if (!serviceMap.has(response.service) || !isServiceAction(response.action)) {
        client.emit(Constant.EVENT_SERVICE_ACTION_RESULT, response);
        return;
    }
    const operations = serviceActionOperations[response.action];
    if (serviceActionsInFlight.has(response.service)) {
        response.message = "A service action is already in progress";
        client.emit(Constant.EVENT_SERVICE_ACTION_RESULT, response);
        return;
    }
    if (!tryAcquireExecSlot(client)) {
        response.message = "Too many commands in progress";
        client.emit(Constant.EVENT_SERVICE_ACTION_RESULT, response);
        return;
    }

    serviceActionsInFlight.add(response.service);
    try {
        response.success = true;
        response.message = "Service action completed";
        for (const operation of operations) {
            const result = await executeServiceCommand(`systemctl:${operation}:${response.service}`);
            response.stdout += result.stdout;
            response.stderr += result.stderr;
            if (!result.success) {
                response.success = false;
                response.failedOperation = operation;
                response.message = result.message || `systemctl ${operation} failed`;
                break;
            }
            response.completedOperations.push(operation);
        }
    } catch (error) {
        response.success = false;
        response.message = error instanceof Error ? error.message : "Service action failed";
    }

    response.phase = "action-complete";
    client.emit(Constant.EVENT_SERVICE_ACTION_RESULT, response);

    response.phase = "status-confirmed";
    try {
        await refreshServiceState();
        const detail = serviceMap.get(response.service);
        if (detail) {
            response.enabled = isServiceEnabled(response.service, detail.username);
        }
        const locale = typeof request.locale === "string" && VALID_LOCALES.includes(request.locale) ? request.locale : "en";
        response.status = await withLocale(locale, async () => await serviceStatusAll());
    } catch (error) {
        response.statusError = error instanceof Error ? error.message : "Service status refresh failed";
        console.error(`[quickbox-ws] failed to refresh service state after ${response.action}:${response.service}`, error);
    } finally {
        serviceActionsInFlight.delete(response.service);
        releaseExecSlot(client);
    }
    client.emit(Constant.EVENT_SERVICE_ACTION_RESULT, response);
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
        if (ret.success && payload.startsWith("systemctl:")) {invalidateServiceState();}
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
                    const lines = [
                        `Launcher PID: ${result.pid ?? "unknown"}`,
                        `Lock file: ${getWebLauncherLockPath()}`,
                        `PID file: ${updatePidPath()}`,
                        `Log file: ${outputLogPath()}`,
                    ];
                    if (result.detail) {
                        lines.push(`Note: ${result.detail}`);
                    }
                    ret.stdout = lines.join("\n");
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
    client.on(Constant.EVENT_SERVICE_ACTION, payload => { void serviceActionHandler(payload, client); });
    if (next) {
        next();
    }
};
