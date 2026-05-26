// SPDX-License-Identifier: GPL-3.0-or-later

const path = require("path");
const { spawn } = require("child_process");

const DASHBOARD_ROOT = path.resolve(__dirname, "..");

const DEFAULTS = {
    BACKEND_HOST: "127.0.0.1",
    BACKEND_PORT: 8575,
};

const HELP_TEXT = `
Usage: node scripts/dev-split-runtime.cjs [options]

Options:
  -h, --help           Show this message

Environment overrides:
  TEST_BACKEND_HOST    Backend listen host (default: ${DEFAULTS.BACKEND_HOST})
  TEST_BACKEND_PORT    Backend listen port (default: ${DEFAULTS.BACKEND_PORT})

Legacy aliases:
  TEST_WS_HOST/PORT are accepted for the backend listen address.
`.trim();

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const parsePort = (value, fallback) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

function buildRuntimeConfig(env = process.env) {
    const backendHost = env.TEST_BACKEND_HOST || env.TEST_WS_HOST || DEFAULTS.BACKEND_HOST;
    const backendPort = parsePort(env.TEST_BACKEND_PORT ?? env.TEST_WS_PORT, DEFAULTS.BACKEND_PORT);

    return {
        backendHost,
        backendPort,
        dashboardRoot: DASHBOARD_ROOT,
        frontendBuildDir: path.join(DASHBOARD_ROOT, "frontend", "dist"),
        backendBuildDir: path.join(DASHBOARD_ROOT, "backend", "dist"),
        backendEntry: path.join(DASHBOARD_ROOT, "backend", "dist", "server.js"),
        buildCommands: [
            [npmCommand, ["run", "build", "--workspace", "frontend"]],
            [npmCommand, ["run", "build", "--workspace", "backend"]],
        ],
    };
}

function runCommand(command, args, cwd, spawnImpl = spawn) {
    return new Promise((resolve, reject) => {
        const child = spawnImpl(command, args, {
            cwd,
            env: process.env,
            stdio: "inherit",
        });

        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"} signal ${signal ?? "null"}`));
        });
    });
}

async function buildSplitRuntime(config = buildRuntimeConfig(), spawnImpl = spawn) {
    for (const [command, args] of config.buildCommands) {
        await runCommand(command, args, config.dashboardRoot, spawnImpl);
    }
}

function startSplitRuntime(config = buildRuntimeConfig(), spawnImpl = spawn) {
    let backendProcess;
    let cleaningUp = false;

    const cleanup = () => {
        if (cleaningUp) {
            return;
        }
        cleaningUp = true;
        if (backendProcess) {
            backendProcess.kill();
        }
    };

    const launch = async () => {
        await buildSplitRuntime(config, spawnImpl);
        backendProcess = spawnImpl("node", [config.backendEntry], {
            cwd: config.dashboardRoot,
            env: {
                ...process.env,
                WS_HOST: config.backendHost,
                WS_PORT: String(config.backendPort),
            },
            stdio: "inherit",
        });

        backendProcess.on("error", (error) => {
            console.error("Backend process error:", error);
            cleanup();
        });
        backendProcess.on("exit", (code, signal) => {
            console.log(`backend exited with code ${code} signal ${signal ?? "null"}`);
            cleanup();
        });
    };

    process.on("exit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("uncaughtException", (error) => {
        console.error("Uncaught Exception:", error);
        cleanup();
    });

    return { cleanup, launch };
}

async function main() {
    const args = new Set(process.argv.slice(2));
    if (args.has("-h") || args.has("--help")) {
        console.log(`${HELP_TEXT}\n`);
        return;
    }

    const runtime = startSplitRuntime();
    await runtime.launch();
}

if (require.main === module) {
    void main();
}

module.exports = {
    DEFAULTS,
    HELP_TEXT,
    buildRuntimeConfig,
    buildSplitRuntime,
    parsePort,
    runCommand,
    startSplitRuntime,
};
