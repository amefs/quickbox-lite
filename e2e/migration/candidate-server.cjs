// SPDX-License-Identifier: GPL-3.0-or-later
// Start a private copy of the current worktree's migrated dashboard against mock data.
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const sourceDashboard = path.join(root, "setup/dashboard");
const tsx = path.join(sourceDashboard, "ws/node_modules/.bin/tsx");
const themes = ["defaulted", "smoked"];
const fixedEpoch = Date.UTC(2026, 2, 24, 14, 30, 0);

function buildCandidateRuntime(runtime, theme) {
    const dashboard = path.join(runtime, "setup/dashboard");
    fs.cpSync(sourceDashboard, dashboard, {
        recursive: true,
        filter(source) {
            const relative = path.relative(sourceDashboard, source).split(path.sep);
            return !relative.includes("node_modules") && !(relative[0] === "ws" && relative[1] === "dist");
        },
    });
    const ws = path.join(dashboard, "ws");
    fs.symlinkSync(path.join(sourceDashboard, "ws/node_modules"), path.join(ws, "node_modules"), "dir");
    const dashboardDb = path.join(dashboard, "db");
    fs.mkdirSync(dashboardDb, { recursive: true });
    if (theme === "smoked") fs.writeFileSync(path.join(dashboardDb, ".smoked.lock"), "");

    // The shared mock bootstrap already normalizes vnstat dump paths through
    // mockVnstatInterface, so the isolated runtime needs no source rewrite.
    const bootstrap = path.join(ws, "src/testing/bootstrap.ts");
    let bootstrapSource = fs.readFileSync(bootstrap, "utf8");
    if (!bootstrapSource.includes("mockVnstatInterface(filePath)")) {
        throw new Error("Unexpected mock bootstrap layout; vnstat fixture adapter is unavailable");
    }

    // Fix time and disk/systemctl inputs in this temporary runtime so captures do not depend on the host.
    const fixedDate = `const MigrationNativeDate = Date;\nclass MigrationFixedDate extends MigrationNativeDate { constructor(...args) { if (args.length) super(...args); else super(${fixedEpoch}); } static now() { return ${fixedEpoch}; } }\n(globalThis).Date = MigrationFixedDate;\n`;
    const diskFixture = `\n    si.fsSize = async () => getActiveProfile().disks.map((disk) => ({ ...disk }));\n`;
    const systemInformationImport = 'const si  = require("systeminformation");';
    const getPrimaryInterface = 'const getPrimaryInterface = () => getActiveProfile().networkInterfaces[0]?.iface ?? "eth0";';
    if (!bootstrapSource.includes(systemInformationImport) || !bootstrapSource.includes(getPrimaryInterface)) {
        throw new Error("Unexpected mock bootstrap layout; refusing an incomplete candidate disk fixture");
    }
    bootstrapSource = bootstrapSource.replace(getPrimaryInterface, `${getPrimaryInterface}${diskFixture}`);
    const promiseImport = 'const fsp = require("fs/promises");';
    const dfFixture = `
    const q05ChildProcess = require("node:child_process");
    const q05Util = require("node:util");
    const q05NativeExec = q05ChildProcess.exec;
    const q05NativePromisifiedExec = q05Util.promisify(q05NativeExec);
    const q05NativeExecFile = q05ChildProcess.execFile;
    const q05NativePromisifiedExecFile = q05Util.promisify(q05NativeExecFile);
    const q05StableDf = process.platform === "darwin"
        ? "Filesystem 1024-blocks Used Available Capacity Mounted-on\\n/dev/q05 100000000 50000000 50000000 50% /System/Volumes/Data\\n/dev/q05-recovery 2000000 100000 1900000 5% /Volumes/Recovery\\n"
        : "Filesystem Type 1024-blocks Used Available Capacity Mounted-on\\n/dev/q05 ext4 100000000 50000000 50000000 50% /\\n/dev/q05-home ext4 200000000 100000000 100000000 50% /home\\n";
    const q05Exec = ((command, options, callback) => {
        const cb = typeof options === "function" ? options : callback;
        if (String(command).includes("df ")) { queueMicrotask(() => cb?.(null, q05StableDf, "")); return {}; }
        return typeof options === "function" ? q05NativeExec(command, options) : q05NativeExec(command, options, callback);
    });
    q05Exec[q05Util.promisify.custom] = async (command, options) => {
        if (String(command).includes("df ")) return { stdout: q05StableDf, stderr: "" };
        return q05NativePromisifiedExec(command, options);
    };
    const q05ExecFile = ((file, args, options, callback) => {
        const cb = typeof options === "function" ? options : callback;
        const themeMatch = file === "sudo" && Array.isArray(args) && args.length === 1
            ? /^\\/usr\\/local\\/bin\\/quickbox\\/system\\/theme\\/themeSelect-(defaulted|smoked)$/.exec(args[0]) : null;
        if (themeMatch) {
            const db = require("node:path").resolve(__dirname, "../../../db");
            const next = themeMatch[1];
            const other = next === "smoked" ? "defaulted" : "smoked";
            fs.rmSync(require("node:path").join(db, "." + other + ".lock"), { force: true });
            fs.writeFileSync(require("node:path").join(db, "." + next + ".lock"), "");
            queueMicrotask(() => cb?.(null, "", ""));
            return {};
        }
        if (file === "systemctl" && Array.isArray(args) && args[0] === "is-active") {
            const active = getActiveProfile().enabledServices.includes(String(args[1]));
            queueMicrotask(() => active ? cb?.(null, "active\\n", "") : cb?.(Object.assign(new Error("inactive"), { code: "1" }), "", "inactive\\n"));
            return {};
        }
        return typeof options === "function" ? q05NativeExecFile(file, args, options) : q05NativeExecFile(file, args, options, callback);
    });
    q05ExecFile[q05Util.promisify.custom] = async (file, args, options) => {
        if (file === "systemctl" && Array.isArray(args) && args[0] === "is-active") {
            if (getActiveProfile().enabledServices.includes(String(args[1]))) return { stdout: "active\\n", stderr: "" };
            throw Object.assign(new Error("inactive"), { code: "1" });
        }
        return q05NativePromisifiedExecFile(file, args, options);
    };
    q05ChildProcess.exec = q05Exec;
    q05ChildProcess.execFile = q05ExecFile;
`;
    if (!bootstrapSource.includes(promiseImport)) throw new Error("Unexpected mock bootstrap layout; refusing an incomplete candidate df fixture");
    bootstrapSource = `${fixedDate}${bootstrapSource.replace(promiseImport, `${promiseImport}${dfFixture}`)}`;
    fs.writeFileSync(bootstrap, bootstrapSource);

    // Match the process owner and command allowlist's standalone service units.
    const mockProfiles = path.join(ws, "src/testing/mock-profiles.ts");
    const profileSource = fs.readFileSync(mockProfiles, "utf8");
    const processEntry = '{ name: "znc", user: DEFAULT_USERNAME, pid: 1014, cpu: 0.0, mem: 0.2 },';
    if (!profileSource.includes(processEntry) || !profileSource.includes('"znc@testuser"') || !profileSource.includes('"ttyd@testuser"')) {
        throw new Error("Unexpected all-running ZNC fixture shape; refusing an incomplete candidate fixture");
    }
    fs.writeFileSync(mockProfiles, profileSource.replace(processEntry, '{ name: "znc", user: "znc", pid: 1014, cpu: 0.0, mem: 0.2 },').replace('"znc@testuser"', '"znc"').replaceAll('"ttyd@testuser"', '"ttyd"'));
    return { dashboard, ws };
}

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
}

function waitForReady(child, port) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Candidate server did not start on ${port}`)), 20_000);
        const onOutput = (chunk) => {
            const line = chunk.toString();
            if (line.includes("Quickbox-ws running on")) {
                clearTimeout(timer);
                resolve();
            } else if (line.includes("EADDRINUSE")) {
                clearTimeout(timer);
                reject(new Error(`Candidate port ${port} became occupied`));
            }
        };
        child.stdout.on("data", onOutput);
        child.stderr.on("data", onOutput);
        child.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`Candidate server on ${port} exited with code ${code}`));
        });
    });
}

function waitForRoot(port) {
    return new Promise((resolve, reject) => {
        const request = http.get(`http://127.0.0.1:${port}/`, (response) => {
            response.resume();
            response.statusCode === 200 ? resolve() : reject(new Error(`Candidate returned HTTP ${response.statusCode}`));
        });
        request.on("error", reject);
    });
}

async function setup() {
    const ports = {
        defaulted: Number(process.env.QB_MIGRATION_PORT_DEFAULTED || 18756),
        smoked: Number(process.env.QB_MIGRATION_PORT_SMOKED || 18757),
    };
    for (const port of Object.values(ports)) {
        if (!Number.isInteger(port) || port < 1 || port > 65535 || !(await isPortAvailable(port))) {
            throw new Error(`Candidate port ${port} is invalid or occupied; set QB_MIGRATION_PORT_DEFAULTED and QB_MIGRATION_PORT_SMOKED`);
        }
    }
    if (!fs.existsSync(tsx)) throw new Error(`Workspace tsx executable not found: ${tsx}`);

    const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-migration-candidate-"));
    const children = [];
    try {
        const instances = themes.map((theme) => ({ id: theme, theme, profile: "all-running", port: ports[theme] }));
        for (const instance of instances) {
            const instanceRuntime = path.join(runtime, instance.id);
            fs.mkdirSync(instanceRuntime, { recursive: true });
            const { ws } = buildCandidateRuntime(instanceRuntime, instance.theme);
            const { port } = instance;
            const dbDir = path.join(runtime, `${instance.id}-db`);
            fs.mkdirSync(dbDir, { recursive: true });
            fs.writeFileSync(path.join(dbDir, "master.txt"), "testuser\n");
            fs.writeFileSync(path.join(dbDir, "interface.txt"), "eth0\n");
            fs.writeFileSync(path.join(dbDir, "output.log"), "");
            const child = spawn(tsx, ["src/server.tsx"], {
                cwd: ws,
                env: {
                    ...process.env,
                    TZ: "UTC",
                    NODE_ENV: "test",
                    MOCK_ENABLED: "1",
                    MOCK_PROFILE: instance.profile,
                    QUICKBOX_TEST_SKINS_DIR: path.join(root, `setup/themes/${instance.theme}/skins`),
                    QUICKBOX_DASHBOARD_DB_DIR: dbDir,
                    QUICKBOX_UPDATE_LOCK: path.join(dbDir, "update.lock"),
                    WS_HOST: "127.0.0.1",
                    WS_PORT: String(port),
                },
                stdio: ["ignore", "pipe", "pipe"],
            });
            children.push(child);
            await waitForReady(child, port);
            await waitForRoot(port);
        }
        process.env.QB_MIGRATION_ORIGINS = JSON.stringify(Object.fromEntries(themes.map((theme) => [theme, `http://127.0.0.1:${ports[theme]}`])));
    } catch (error) {
        for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
        fs.rmSync(runtime, { recursive: true, force: true });
        throw error;
    }

    return async () => {
        for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
        await Promise.all(children.map((child) => new Promise((resolve) => {
            if (child.exitCode !== null) return resolve();
            child.once("exit", resolve);
            setTimeout(() => {
                if (child.exitCode === null) child.kill("SIGKILL");
                resolve();
            }, 2_000).unref();
        })));
        fs.rmSync(runtime, { recursive: true, force: true });
    };
}

module.exports = setup;
