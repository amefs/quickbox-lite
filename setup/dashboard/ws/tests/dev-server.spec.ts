// SPDX-License-Identifier: GPL-3.0-or-later
// Regression: the dev proxy must keep a Socket.IO websocket alive after the
// polling -> websocket upgrade. It also pins dev-server.js to the Node runtime;
// Bun closed the upgraded transport shortly after the probe and the dashboard
// logged "[ws] cleared N pending request(s): socket disconnected".

import "mocha";
import { expect } from "chai";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { io, type Socket } from "socket.io-client";

const packageRoot = path.resolve(__dirname, "..");

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (address === null || typeof address === "string") {
                server.close();
                reject(new Error("could not allocate a test port"));
                return;
            }
            const { port } = address;
            server.close(() => {
                resolve(port);
            });
        });
    });
}

async function twoFreePorts(): Promise<[number, number]> {
    for (;;) {
        const first = await freePort();
        const second = await freePort();
        if (first !== second) {
            return [first, second];
        }
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOutput(read: () => string, needle: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!read().includes(needle)) {
        if (Date.now() > deadline) {
            throw new Error(`timed out waiting for "${needle}"\n${read()}`);
        }
        await delay(50);
    }
}

describe("dev-server", () => {
    it("should keep a Socket.IO websocket connection alive through the proxy", async function() {
        this.timeout(40000);
        const [proxyPort, wsPort] = await twoFreePorts();
        const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-dev-server-"));
        fs.writeFileSync(path.join(dbDir, "master.txt"), "testuser\n");
        fs.writeFileSync(path.join(dbDir, "interface.txt"), "eth0\n");
        fs.writeFileSync(path.join(dbDir, "output.log"), "");

        let child: ChildProcessWithoutNullStreams | undefined;
        let socket: Socket | undefined;
        let output = "";
        try {
            child = spawn(process.execPath, [path.join(packageRoot, "scripts", "dev-server.js")], {
                cwd: packageRoot,
                env: {
                    ...process.env,
                    NODE_ENV: "test",
                    MOCK_ENABLED: "1",
                    MOCK_PROFILE: "partial-running",
                    QUICKBOX_DASHBOARD_DB_DIR: dbDir,
                    QUICKBOX_TEST_SKINS_DIR: path.resolve(packageRoot, "..", "..", "themes", "smoked", "skins"),
                    TEST_SERVER_HOST: "127.0.0.1",
                    TEST_SERVER_PORT: String(proxyPort),
                    TEST_WS_PORT: String(wsPort),
                },
                stdio: "pipe",
            });
            child.stdout.on("data", (chunk: Buffer) => {
                output += chunk.toString();
            });
            child.stderr.on("data", (chunk: Buffer) => {
                output += chunk.toString();
            });

            await waitForOutput(() => output, "Node dashboard proxy listening", 20000);
            await waitForOutput(() => output, "Quickbox-ws running", 20000);

            const client = io(`http://127.0.0.1:${proxyPort}`, {
                path: "/socket.io",
                reconnection: false,
                timeout: 5000,
            });
            socket = client;
            let disconnects = 0;
            client.on("disconnect", () => {
                disconnects += 1;
            });

            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`websocket upgrade timed out\n${output}`));
                }, 10000);
                client.io.engine.once("upgrade", () => {
                    clearTimeout(timer);
                    resolve();
                });
                client.once("connect_error", (error) => {
                    clearTimeout(timer);
                    reject(error);
                });
            });

            expect(client.io.engine.transport.name).to.equal("websocket");
            await delay(1500);
            expect(disconnects).to.equal(0);
            expect(client.connected).to.equal(true);
        } finally {
            socket?.close();
            const runningChild = child;
            if (runningChild && runningChild.exitCode === null && !runningChild.killed) {
                await new Promise<void>((resolve) => {
                    let settled = false;
                    const finish = () => {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        resolve();
                    };
                    runningChild.once("exit", finish);
                    runningChild.kill("SIGTERM");
                    setTimeout(() => {
                        runningChild.kill("SIGKILL");
                        finish();
                    }, 5000).unref();
                });
            }
            fs.rmSync(dbDir, { recursive: true, force: true });
        }
    });
});
