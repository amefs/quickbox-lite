/* eslint-disable @typescript-eslint/no-non-null-assertion */
// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import execHandler, {
    buildUpdateRunnerScript,
    decodeExecOutput,
    getWebLauncherLockPath,
    interpretLaunchStatus,
    isPidAlive,
    isUpdateInProgress,
    probeWebLauncherLock,
    readUpdatePid,
    releaseExecSlot,
    resetExecSlotsForTests,
    tryAcquireExecSlot,
    UPDATE_ACK_BUSY,
    UPDATE_ACK_FAILED,
    UPDATE_ACK_OK,
    UPDATE_ACK_PENDING,
} from "../../src/handlers/exec";
import Constant from "../../src/shared/constants";

/** Helper to build a minimal mock Socket client */
function buildMockClient(onExecCallback?: (data: unknown) => void) {
    return {
        on(event: string, cb: (payload: unknown) => void) {
            if (event === Constant.EVENT_EXEC) {
                this._trigger = cb;
            }
        },
        emit(_event: string, data: unknown) {
            onExecCallback?.(data);
        },
        _trigger: null as ((payload: unknown) => void) | null,
    };
}

describe("handlers/exec", () => {
    describe("decodeExecOutput", () => {
        it("should decode utf8 buffer correctly", () => {
            const output = decodeExecOutput(Buffer.from("hello", "utf8"));
            expect(output).to.equal("hello");
        });

        it("should fallback to gb18030 for non-utf8 buffer", () => {
            const output = decodeExecOutput(Buffer.from([0xd6, 0xd0, 0xce, 0xc4])); // 中文 in GBK/GB18030
            expect(output).to.equal("中文");
        });
    });

    describe("middleware", () => {
        it("should register exec event and call next", () => {
            const mockClient = buildMockClient();
            let nextCalled = false;
            execHandler(mockClient as never, () => { nextCalled = true; });
            expect(mockClient._trigger).to.be.a("function");
            expect(nextCalled).to.equal(true);
        });

        it("should work without next callback", () => {
            const mockClient = buildMockClient();
            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            expect(() => execHandler(mockClient as never)).to.not.throw();
            expect(mockClient._trigger).to.be.a("function");
        });
    });

    describe("execHandler — invalid command", () => {
        it("should emit {success:false} for unknown command payload", (done) => {
            const mockClient = buildMockClient((data) => {
                expect(data).to.have.property("success", false);
                expect(data).to.have.property("cmd", "notexist::");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!("notexist::");
        });

        // C2: non-string payload validation
        it("should emit {success:false} for non-string payload (null)", (done) => {
            const mockClient = buildMockClient((data) => {
                const d = data as Record<string, unknown>;
                expect(d).to.have.property("success", false);
                expect(d).to.have.property("message", "Invalid payload");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!(null);
        });

        it("should emit {success:false} for non-string payload (object)", (done) => {
            const mockClient = buildMockClient((data) => {
                const d = data as Record<string, unknown>;
                expect(d).to.have.property("success", false);
                expect(d).to.have.property("message", "Invalid payload");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!({ command: "ping" });
        });

        it("should emit {success:false} for non-string payload (number)", (done) => {
            const mockClient = buildMockClient((data) => {
                const d = data as Record<string, unknown>;
                expect(d).to.have.property("success", false);
                expect(d).to.have.property("message", "Invalid payload");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!(42);
        });
    });

    describe("concurrency and update lock", () => {
        afterEach(() => {
            resetExecSlotsForTests();
        });

        it("should refuse additional slots beyond the per-socket limit", () => {
            const socket = {} as never;
            expect(tryAcquireExecSlot(socket, 1, 8)).to.equal(true);
            expect(tryAcquireExecSlot(socket, 1, 8)).to.equal(false);
            releaseExecSlot(socket);
            expect(tryAcquireExecSlot(socket, 1, 8)).to.equal(true);
            releaseExecSlot(socket);
        });

        it("should treat a live pid file as an in-progress update", () => {
            const pidPath = path.join(os.tmpdir(), `quickbox-update-test-${process.pid}.pid`);
            fs.writeFileSync(pidPath, `${process.pid}\n`);
            try {
                expect(isUpdateInProgress(pidPath)).to.equal(true);
            } finally {
                fs.unlinkSync(pidPath);
            }
        });

        it("should ignore a stale pid file", () => {
            const pidPath = path.join(os.tmpdir(), `quickbox-update-stale-${process.pid}.pid`);
            fs.writeFileSync(pidPath, "99999999\n");
            try {
                expect(isPidAlive(99999999)).to.equal(false);
                expect(isUpdateInProgress(pidPath)).to.equal(false);
                expect(readUpdatePid(pidPath)).to.equal(99999999);
            } finally {
                fs.unlinkSync(pidPath);
            }
        });

        it("should treat an unreadable pid file as no update in progress", () => {
            expect(isUpdateInProgress(path.join(os.tmpdir(), `quickbox-missing-${process.pid}.pid`))).to.equal(false);
            expect(readUpdatePid(path.join(os.tmpdir(), `quickbox-missing-${process.pid}.pid`))).to.equal(null);
        });
    });

    describe("update launch verdict", () => {
        it("should start when the runner confirms the lock", () => {
            expect(interpretLaunchStatus({ observed: UPDATE_ACK_OK, childAlive: true })).to.deep.equal({ state: "started" });
        });

        it("should report busy when another holder owns the launcher lock", () => {
            const result = interpretLaunchStatus({ observed: UPDATE_ACK_BUSY, childAlive: false });
            expect(result.state).to.equal("busy");
        });

        it("should fail when the runner was refused the update locks", () => {
            const result = interpretLaunchStatus({ observed: UPDATE_ACK_FAILED, childAlive: false });
            expect(result.state).to.equal("failed");
            expect(result.detail).to.contain("refused");
        });

        it("should fail when the runner died without a verdict", () => {
            const result = interpretLaunchStatus({ observed: "", childAlive: false });
            expect(result.state).to.equal("failed");
            expect(result.detail).to.contain("before acquiring the lock");
        });

        it("should fail when the runner died while still pending", () => {
            const result = interpretLaunchStatus({ observed: UPDATE_ACK_PENDING, childAlive: false });
            expect(result.state).to.equal("failed");
            expect(result.detail).to.contain("before confirming");
        });

        // The reported regression: a slow box delays the acknowledgement, the
        // update still runs, and the dashboard used to call that a launch
        // failure next to a task that was in fact running.
        it("should start an unconfirmed but live runner instead of failing it", () => {
            const result = interpretLaunchStatus({ observed: UPDATE_ACK_PENDING, childAlive: true });
            expect(result.state).to.equal("started");
            expect(result.detail).to.contain("alive");
        });

        it("should start a live runner that never wrote a status at all", () => {
            const result = interpretLaunchStatus({ observed: "", childAlive: true });
            expect(result.state).to.equal("started");
        });
    });

    describe("update mutex (flock)", () => {
        const hasFlock = spawnSync("flock", ["--version"], { stdio: "ignore" }).status === 0;
        let sandbox: string;
        let lockPath: string;
        let dbDir: string;
        const savedEnv: Record<string, string | undefined> = {};

        beforeEach(() => {
            sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-update-"));
            lockPath = path.join(sandbox, "update.lock");
            dbDir = path.join(sandbox, "db");
            fs.mkdirSync(dbDir, { recursive: true });
            savedEnv.QUICKBOX_UPDATE_LOCK = process.env.QUICKBOX_UPDATE_LOCK;
            savedEnv.QUICKBOX_DASHBOARD_DB_DIR = process.env.QUICKBOX_DASHBOARD_DB_DIR;
            process.env.QUICKBOX_UPDATE_LOCK = lockPath;
            process.env.QUICKBOX_DASHBOARD_DB_DIR = dbDir;
        });

        afterEach(() => {
            for (const [key, value] of Object.entries(savedEnv)) {
                if (value === undefined) {
                    Reflect.deleteProperty(process.env, key);
                } else {
                    process.env[key] = value;
                }
            }
            fs.rmSync(sandbox, { recursive: true, force: true });
        });

        it("should use a lock location outside the dashboard sync tree", () => {
            Reflect.deleteProperty(process.env, "QUICKBOX_UPDATE_LOCK");
            expect(getWebLauncherLockPath()).to.equal("/run/lock/quickbox-update.lock");
            expect(getWebLauncherLockPath().startsWith("/srv/dashboard")).to.equal(false);
        });

        it("should report a free lock when nothing holds it", function() {
            if (!hasFlock) {
                this.skip();
            }
            expect(probeWebLauncherLock(lockPath)).to.equal("free");
        });

        it("should report busy while another holder keeps the lock", async function() {
            if (!hasFlock) {
                this.skip();
            }
            const holder = spawn("/bin/bash", ["-c", `exec 9>"${lockPath}"; flock -n 9 || exit 1; sleep 5`], {
                stdio: "ignore",
            });
            try {
                const deadline = Date.now() + 3000;
                let state = probeWebLauncherLock(lockPath);
                while (state !== "busy" && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    state = probeWebLauncherLock(lockPath);
                }
                expect(state).to.equal("busy");
            } finally {
                holder.kill("SIGKILL");
            }
        });

        it("should let only one runner enter the critical section", async function() {
            if (!hasFlock) {
                this.skip();
            }
            const marker = path.join(sandbox, "ran");
            const buildScript = (index: number) =>
                buildUpdateRunnerScript(`printf '%s\\n' runner-${index} >> ${JSON.stringify(marker)}; sleep 0.4`, path.join(sandbox, `status-${index}`));

            const runners = [0, 1, 2].map((index) =>
                spawn("/bin/bash", ["-c", buildScript(index)], { stdio: "ignore" }),
            );
            const exits = await Promise.all(
                runners.map(
                    (child) =>
                        new Promise<number | null>((resolve) => {
                            child.on("exit", (code) => {
                                resolve(code);
                            });
                        }),
                ),
            );

            const succeeded = exits.filter((code) => code === 0);
            const rejected = exits.filter((code) => code === 75);
            expect(succeeded).to.have.length(1);
            expect(rejected).to.have.length(2);

            const lines = fs.readFileSync(marker, "utf8").trim().split("\n");
            expect(lines).to.have.length(1);
            // The runner must not leave the display-only pid file behind.
            expect(fs.existsSync(path.join(dbDir, "update.pid"))).to.equal(false);
        });

        it("should leave the previous log intact when a runner is refused by the lock", async function() {
            if (!hasFlock) {
                this.skip();
            }
            const outputPath = path.join(dbDir, "output.log");
            fs.writeFileSync(outputPath, "previous diagnostic log\n");
            const holder = spawn("/bin/bash", ["-c", `exec 9>"${lockPath}"; flock -n 9 || exit 1; sleep 5`], {
                stdio: "ignore",
            });
            try {
                const deadline = Date.now() + 3000;
                while (probeWebLauncherLock(lockPath) !== "busy" && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                const statusPath = path.join(sandbox, "status-busy");
                const child = spawn("/bin/bash", ["-c", buildUpdateRunnerScript("echo should-not-run", statusPath)], {
                    stdio: "ignore",
                });
                const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
                expect(code).to.equal(75);
                expect(fs.readFileSync(outputPath, "utf8")).to.equal("previous diagnostic log\n");
            } finally {
                holder.kill("SIGKILL");
            }
        });

        it("should wait for a new epoch before reporting a successful update launch", async () => {
            const epochPath = path.join(dbDir, "output.log.epoch");
            fs.writeFileSync(epochPath, "epoch-old\n");
            const statusPath = path.join(sandbox, "status-epoch");
            const command = `sleep 0.4; printf 'epoch-new\\n' > ${JSON.stringify(epochPath)}; sleep 0.4`;
            const script = `flock() { return 0; }\n${buildUpdateRunnerScript(command, statusPath)}`;
            const child = spawn("/bin/bash", ["-c", script], { stdio: "ignore" });
            await new Promise((resolve) => setTimeout(resolve, 150));
            // The old epoch must not be acknowledged as a completed launch, but
            // the runner must have announced itself by now: its first write is
            // the liveness marker, not the lock verdict.
            expect(fs.readFileSync(statusPath, "utf8").trim()).to.equal(UPDATE_ACK_PENDING);
            const deadline = Date.now() + 3000;
            while (fs.readFileSync(statusPath, "utf8").trim() !== UPDATE_ACK_OK && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(fs.readFileSync(statusPath, "utf8").trim()).to.equal(UPDATE_ACK_OK);
            const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
            expect(code).to.equal(0);
        });

        it("should announce itself before touching the launcher lock", () => {
            const statusPath = path.join(sandbox, "status-first-write");
            const script = buildUpdateRunnerScript("echo should-not-run", statusPath);
            const firstLine = script.split("\n")[0];
            expect(firstLine.startsWith(`printf '${UPDATE_ACK_PENDING}\\n' >`)).to.equal(true);
            expect(firstLine).to.contain(statusPath);
        });

        it("should report busy when the updater is rejected by the inner lock", async () => {
            const epochPath = path.join(dbDir, "output.log.epoch");
            fs.writeFileSync(epochPath, "epoch-old\n");
            const statusPath = path.join(sandbox, "status-inner-busy");
            const script = `flock() { return 0; }\n${buildUpdateRunnerScript("exit 75", statusPath)}`;
            const child = spawn("/bin/bash", ["-c", script], { stdio: "ignore" });
            const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
            expect(code).to.equal(75);
            expect(fs.readFileSync(statusPath, "utf8").trim()).to.equal("busy");
        });

        it("should report failed when the updater exits before publishing an epoch", async () => {
            const epochPath = path.join(dbDir, "output.log.epoch");
            fs.writeFileSync(epochPath, "epoch-old\n");
            const statusPath = path.join(sandbox, "status-inner-failed");
            const script = `flock() { return 0; }\n${buildUpdateRunnerScript("exit 1", statusPath)}`;
            const child = spawn("/bin/bash", ["-c", script], { stdio: "ignore" });
            const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
            expect(code).to.equal(1);
            expect(fs.readFileSync(statusPath, "utf8").trim()).to.equal("failed");
        });

        it("should keep command exit status and clean the pid without platform flock", async () => {
            const statusPath = path.join(sandbox, "status");
            const script = `flock() { return 0; }\n${buildUpdateRunnerScript("exit 42", statusPath)}`;
            const child = spawn("/bin/bash", ["-c", script], { stdio: "ignore" });
            const code = await new Promise<number | null>((resolve) => {
                child.on("exit", (exitCode) => {
                    resolve(exitCode);
                });
            });
            expect(code).to.equal(42);
            expect(fs.readFileSync(statusPath, "utf8").trim()).to.equal("ok");
            expect(fs.existsSync(path.join(dbDir, "update.pid"))).to.equal(false);
        });
        it("should export a writable persistent TMPDIR for the updater", async () => {
            const statusPath = path.join(sandbox, "status-tmpdir");
            const command = 'test -d "$TMPDIR" && test -w "$TMPDIR" && test "$TMPDIR" = ' +
                JSON.stringify(path.join(dbDir, "tmp"));
            const script = `flock() { return 0; }\n${buildUpdateRunnerScript(command, statusPath)}`;
            const child = spawn("/bin/bash", ["-c", script], { stdio: "ignore" });
            const code = await new Promise<number | null>((resolve) => {
                child.on("exit", (exitCode) => {
                    resolve(exitCode);
                });
            });
            expect(code).to.equal(0);
            expect(fs.readFileSync(statusPath, "utf8").trim()).to.equal("ok");
            expect(fs.existsSync(path.join(dbDir, "tmp"))).to.equal(true);
        });

        it("should clean the pid when the runner receives a termination signal", async () => {
            const statusPath = path.join(sandbox, "status-signal");
            const script = `flock() { return 0; }\n${buildUpdateRunnerScript("sleep 10", statusPath)}`;
            const child = spawn("/bin/bash", ["-c", script], { stdio: "ignore" });
            const pidPath = path.join(dbDir, "update.pid");
            const deadline = Date.now() + 2000;
            while (!fs.existsSync(pidPath) && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(fs.existsSync(pidPath)).to.equal(true);
            child.kill("SIGTERM");
            const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
            expect(code).to.equal(143);
            expect(fs.existsSync(pidPath)).to.equal(false);
        });

        it("should clean the pid and preserve an ordinary command failure", async () => {
            const statusPath = path.join(sandbox, "status-failure");
            const script = `flock() { return 0; }\n${buildUpdateRunnerScript("exit 7", statusPath)}`;
            const child = spawn("/bin/bash", ["-c", script], { stdio: "ignore" });
            const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
            expect(code).to.equal(7);
            expect(fs.existsSync(path.join(dbDir, "update.pid"))).to.equal(false);
        });

    });

});
