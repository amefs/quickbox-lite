// SPDX-License-Identifier: GPL-3.0-or-later
// Startup behaviour: a fatal condition must terminate the process with a
// non-zero status instead of leaving a half-started service behind (BE-01).

import "mocha";
import { expect } from "chai";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import net from "net";
import path from "path";

const packageRoot = path.resolve(__dirname, "..");

interface RunResult {
    code: number | null;
    signal: NodeJS.Signals | null;
    stderr: string;
    stdout: string;
}

function runServer(env: Record<string, string>, timeoutMs = 20000): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const child: ChildProcessWithoutNullStreams = spawn(
            process.execPath,
            ["--import", "tsx", path.join(packageRoot, "src", "server.tsx")],
            {
                cwd: packageRoot,
                env: {
                    PATH: process.env.PATH ?? "",
                    HOME: process.env.HOME ?? "",
                    ...env,
                },
                stdio: "pipe",
            },
        );
        let stderr = "";
        let stdout = "";
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`server did not exit within ${timeoutMs}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        }, timeoutMs);
        child.on("exit", (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, stderr, stdout });
        });
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

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

describe("server startup", () => {
    it("should exit non-zero when the port is already in use", async function() {
        this.timeout(40000);
        const blocker = net.createServer();
        const port = await new Promise<number>((resolve, reject) => {
            blocker.on("error", reject);
            blocker.listen(0, "127.0.0.1", () => {
                const address = blocker.address();
                if (address === null || typeof address === "string") {
                    reject(new Error("could not allocate a test port"));
                    return;
                }
                resolve(address.port);
            });
        });
        try {
            const result = await runServer({
                NODE_ENV: "development",
                WS_HOST: "127.0.0.1",
                WS_PORT: String(port),
                QUICKBOX_WS_AUTH: "0",
            });
            expect(result.code).to.equal(1);
            expect(result.stderr).to.contain("already in use");
        } finally {
            await new Promise<void>((resolve) => {
                blocker.close(() => {
                    resolve();
                });
            });
        }
    });

    it("should refuse to start in production without a gateway secret", async function() {
        this.timeout(30000);
        const port = await freePort();
        const result = await runServer({
            NODE_ENV: "production",
            WS_HOST: "127.0.0.1",
            WS_PORT: String(port),
            QUICKBOX_WS_GATEWAY_SECRET_FILE: "/nonexistent/quickbox/ws.secret",
        });
        expect(result.code).to.equal(1);
        expect(result.stderr).to.contain("refusing to start");
        expect(result.stderr).not.to.contain("running on");
    });

    it("should refuse to start in production when authentication is disabled", async function() {
        this.timeout(30000);
        const port = await freePort();
        const result = await runServer({
            NODE_ENV: "production",
            WS_HOST: "127.0.0.1",
            WS_PORT: String(port),
            QUICKBOX_WS_AUTH: "0",
            QUICKBOX_WS_GATEWAY_SECRET: "abcdef0123456789abcdef0123456789",
        });
        expect(result.code).to.equal(1);
        expect(result.stderr).to.contain("QUICKBOX_WS_AUTH=0");
    });
});
