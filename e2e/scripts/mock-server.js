// SPDX-License-Identifier: GPL-3.0-or-later

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const wsRoot = path.resolve(__dirname, "../../setup/dashboard/ws");
const tsx = path.join(wsRoot, "node_modules", ".bin", "tsx");
if (!fs.existsSync(tsx)) {
    console.error(`Node dashboard dependencies are missing. Run npm ci in ${wsRoot}`);
    process.exit(1);
}

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-e2e-db-"));
const skinsDir = path.resolve(wsRoot, "../../themes/smoked/skins");
fs.writeFileSync(path.join(dbDir, "master.txt"), `${process.env.E2E_USER || "testuser"}\n`);
fs.writeFileSync(path.join(dbDir, "interface.txt"), `${process.env.E2E_IFACE || "eth0"}\n`);
fs.writeFileSync(path.join(dbDir, "output.log"), "");

const child = spawn(tsx, ["src/server.tsx"], {
    cwd: wsRoot,
    env: {
        ...process.env,
        NODE_ENV: "test",
        MOCK_ENABLED: "1",
        MOCK_PROFILE: process.env.MOCK_PROFILE || "partial-running",
        WS_HOST: process.env.TEST_WS_HOST || "127.0.0.1",
        WS_PORT: process.env.TEST_WS_PORT || "8575",
        QUICKBOX_DASHBOARD_DB_DIR: dbDir,
        QUICKBOX_TEST_SKINS_DIR: skinsDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
});

let cleaned = false;
function cleanup() {
    if (cleaned) return;
    cleaned = true;
    fs.rmSync(dbDir, { recursive: true, force: true });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        if (child.exitCode === null) child.kill(signal);
    });
}

child.stdout.on("data", (data) => {
    const output = data.toString();
    process.stdout.write(output);
    if (process.env.TEST_SERVER_READY_FILE && output.includes("Quickbox-ws running on")) {
        fs.writeFileSync(process.env.TEST_SERVER_READY_FILE, "ready\n");
    }
});
child.stderr.on("data", (data) => {
    const output = data.toString();
    process.stderr.write(output);
    // server.tsx keeps running after its uncaughtException handler logs a bind
    // failure, so stop it explicitly instead of waiting for the startup timeout.
    if (output.includes("EADDRINUSE")) child.kill("SIGTERM");
});
child.on("error", (error) => {
    console.error("Failed to start the mock Node server:", error);
    cleanup();
    process.exitCode = 1;
});
child.on("exit", (code, signal) => {
    cleanup();
    process.exitCode = code ?? (signal ? 1 : 0);
});

process.on("exit", cleanup);
