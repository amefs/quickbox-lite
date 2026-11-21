// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Mock bootstrap — monkey-patches system-level modules when `--env=mock` (or
 * `QUICKBOX_ENV=mock`) is selected, so that **all** downstream consumers
 * transparently receive fixture data.  No source-file modifications are needed.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  MUST be the very first import in src/server.ts.          │
 * │  In prod (the default) this file is a zero-cost no-op —   │
 * │  the if-block is never entered.                           │
 * └──────────────────────────────────────────────────────────┘
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return,
   @typescript-eslint/require-await, camelcase */

import { isMockMode } from "./mode";

if (isMockMode()) {
    // The fixtures describe a Linux server, which is where QuickBox runs. The
    // collectors choose their data source by platform before reading anything,
    // so the switch has to happen before the business modules are loaded.
    if (process.platform !== "linux") {
        Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    }

    const si  = require("systeminformation");
    const os  = require("os");
    const fs  = require("fs");
    const fsp = require("fs/promises");
    const cp  = require("child_process");

    const { getActiveProfile } = require("./adapter") as {
        getActiveProfile: () => import("./data/profiles").MockProfile;
    };
    const { MOCK_HOST } = require("./data/profiles") as typeof import("./data/profiles");
    const { mockVnstatInterface } = require("./vnstat") as {
        mockVnstatInterface: (filePath: string) => string | undefined;
    };
    const {
        baselineRates,
        fluctuateDisks,
        fluctuateLoad,
        fluctuateMemory,
        fluctuateVnstat,
        networkRate,
        trafficCounters,
    } = require("./fluctuation") as typeof import("./fluctuation");
    const { dfOutput, procNetDev } = require("./virtual-system") as typeof import("./virtual-system");
    const getPrimaryInterface = () => getActiveProfile().networkInterfaces[0]?.iface ?? "eth0";

    /** Current counters and rate of one interface, shared by every reader. */
    const interfaceCounters = (iface: string, now = Date.now()) => {
        const profile = getActiveProfile();
        const networkInterface = profile.networkInterfaces.find((entry: { iface: string }) => entry.iface === iface);
        const baseline = baselineRates(profile);
        const key = `network:${profile.name}:${iface}`;
        const rate = {
            rx: networkRate(`${key}:rx`, baseline.rx, now),
            tx: networkRate(`${key}:tx`, baseline.tx, now),
        };
        const counters = trafficCounters(
            key,
            { rx: networkInterface?.rx_bytes ?? 0, tx: networkInterface?.tx_bytes ?? 0 },
            rate,
            now,
        );
        return { ...counters, rate };
    };

    // ── systeminformation ──────────────────────────────────

    si.mem = async () => {
        return fluctuateMemory(getActiveProfile().memory);
    };

    si.fsSize = async () => {
        return fluctuateDisks(getActiveProfile().disks).map((disk: {
            fs: string; type: string; size: number; used: number; available: number; use: number; mount: string;
        }) => ({
            fs: disk.fs,
            type: disk.type,
            size: disk.size,
            used: disk.used,
            available: disk.available,
            use: disk.use,
            mount: disk.mount,
        }));
    };

    si.cpu = async () => {
        const profile = getActiveProfile();
        return {
            brand: profile.cpuModel,
            manufacturer: MOCK_HOST.cpuManufacturer,
            cores: profile.cpuCount,
            speed: MOCK_HOST.cpuSpeedGhz,
        };
    };

    si.processes = async () => {
        const p = getActiveProfile();
        return {
            all:      p.processes.length,
            running:  p.processes.length,
            blocked:  0,
            sleeping: 0,
            unknown:  0,
            list: p.processes.map((proc: { pid: number; name: string; cpu: number; mem: number; user: string; params?: string }) => ({
                pid: proc.pid, parentPid: 1,
                name: proc.name, cpu: proc.cpu, cpuu: proc.cpu, cpus: 0,
                mem: proc.mem, priority: 20, memVsz: 0, memRss: 0,
                nice: 0, started: MOCK_HOST.processStartedAt, state: "running",
                tty: "", user: proc.user, command: proc.name,
                params: proc.params ?? "", path: `/usr/bin/${proc.name}`,
            })),
        };
    };

    si.networkInterfaces = async () => {
        const p = getActiveProfile();
        return p.networkInterfaces.map((ni: { iface: string; operstate: string }) => ({
            iface: ni.iface, ifaceName: ni.iface,
            default: ni.iface === getPrimaryInterface(),
            ip4: MOCK_HOST.ipv4, ip4subnet: MOCK_HOST.ipv4Subnet,
            ip6: "", ip6subnet: "",
            mac: MOCK_HOST.mac,
            internal: false, virtual: false,
            operstate: ni.operstate, type: "wired",
            duplex: "full", mtu: MOCK_HOST.mtu, speed: MOCK_HOST.linkSpeedMbps,
            dhcp: false, dnsSuffix: "",
            ieee8021xAuth: "", ieee8021xState: "",
            carrier_changes: 0,
        }));
    };

    si.networkStats = async (iface: string) => {
        const p = getActiveProfile();
        const nd = p.networkInterfaces.find((i: { iface: string }) => i.iface === iface);
        if (!nd) {
            return [];
        }
        const now = Date.now();
        const current = interfaceCounters(iface, now);
        return [{
            iface: nd.iface, operstate: nd.operstate,
            rx_bytes: current.total.rx, rx_dropped: 0, rx_errors: 0,
            tx_bytes: current.total.tx, tx_dropped: 0, tx_errors: 0,
            rx_sec: Math.round(current.rate.rx), tx_sec: Math.round(current.rate.tx), ms: 1000,
        }];
    };

    si.time = () => ({
        current: Date.now(),
        uptime: getActiveProfile().uptime,
        timezone: MOCK_HOST.timezone,
        timezoneName: MOCK_HOST.timezoneName,
    });

    // ── os ──────────────────────────────────────────────────

    os.loadavg = () => fluctuateLoad(getActiveProfile().loadavg);

    // ── fs (sync) ───────────────────────────────────────────

    const origExistsSync   = fs.existsSync.bind(fs);
    const origReadFileSync = fs.readFileSync.bind(fs);
    const origReaddirSync  = fs.readdirSync.bind(fs);
    const MOCK_OPERATION_PID = "4242";

    fs.existsSync = (filePath: unknown): boolean => {
        if (typeof filePath !== "string") {
            return origExistsSync(filePath);
        }
        const p = getActiveProfile();

        // Lock files
        if (filePath.startsWith("/install/.") && filePath.endsWith(".lock")) {
            return p.lockFiles.includes(filePath);
        }

        // Systemd enabled-service symlinks
        if (filePath.startsWith("/etc/systemd/system/multi-user.target.wants/")) {
            return p.enabledServices.includes(
                filePath.replace("/etc/systemd/system/multi-user.target.wants/", "")
                    .replace(".service", ""),
            );
        }

        // Force file-based vnstat loading
        if (filePath === "/usr/bin/vnstat") {
            return false;
        }

        // Vnstat dump files
        const vnstatIface = mockVnstatInterface(filePath);
        if (vnstatIface !== undefined) {
            return p.vnstatData?.[vnstatIface] !== undefined;
        }

        // Config files that the mock provides in-memory
        if (filePath === "/srv/dashboard/db/master.txt") {
            return true;
        }
        if (filePath === "/srv/dashboard/db/interface.txt") {
            return true;
        }

        return origExistsSync(filePath);
    };

    // /proc is faked just far enough for the running-task widget: one process
    // whose cmdline is the lifecycle script of the active profile, which is how
    // production tells an install from a removal.
    fs.readdirSync = (dir: unknown, options?: unknown): unknown => {
        if (dir === "/proc") {
            return getActiveProfile().installLockOperation ? [MOCK_OPERATION_PID] : [];
        }
        return origReaddirSync(dir, options);
    };

    fs.readFileSync = (filePath: unknown, options?: unknown): unknown => {
        if (typeof filePath === "string") {
            const p = getActiveProfile();

            if (filePath === `/proc/${MOCK_OPERATION_PID}/cmdline`) {
                const operation = p.installLockOperation;
                if (operation) {
                    return `/bin/bash\0/usr/local/bin/quickbox/package/${operation}/${operation}package-jellyfin\0`;
                }
            }

            if (filePath === "/install/.debug.lock" && p.branch) {
                return p.branch + "\n";
            }

            // The install lock carries the running operation's title.
            if (filePath === "/install/.install.lock") {
                if (p.lockFiles.includes("/install/.install.lock")) {
                    return `${p.installLockTitle ?? "QuickBox"}\n`;
                }
                const missing: NodeJS.ErrnoException = new Error(`ENOENT: no such file, open '${filePath}'`);
                missing.code = "ENOENT";
                throw missing;
            }

            if (filePath === "/srv/dashboard/db/master.txt") {
                return p.username + "\n";
            }

            if (filePath === "/srv/dashboard/db/interface.txt") {
                return getPrimaryInterface() + "\n";
            }

            // Vnstat dump files
            const vnstatIface = mockVnstatInterface(filePath);
            if (vnstatIface !== undefined) {
                const data = p.vnstatData?.[vnstatIface];
                if (data) {
                    return fluctuateVnstat(
                        data,
                        `vnstat:${p.name}:${vnstatIface}`,
                        baselineRates(p),
                    );
                }
            }
        }
        return origReadFileSync(filePath, options);
    };

    // ── fs/promises ─────────────────────────────────────────

    const origReaddir  = fsp.readdir.bind(fsp);
    const origOpendir  = fsp.opendir.bind(fsp);
    const origReadFile = fsp.readFile.bind(fsp);
    const origAccess   = fsp.access.bind(fsp);

    fsp.readdir = async (dirPath: unknown, ...args: unknown[]): Promise<unknown> => {
        if (String(dirPath) === "/proc") {
            return getActiveProfile().installLockOperation ? [MOCK_OPERATION_PID] : [];
        }
        return origReaddir(dirPath, ...args);
    };

    fsp.opendir = async (dirPath: unknown, ...args: unknown[]): Promise<unknown> => {
        const pathStr = String(dirPath).replace(/\/$/, "");
        const directories: Partial<Record<string, string[]>> = getActiveProfile().torrentDirs;
        const files = directories[pathStr] ?? directories[`${pathStr}/`];
        if (files) {
            return {
                async *[Symbol.asyncIterator]() {
                    for (const name of files) {yield { name };}
                },
            };
        }
        return origOpendir(dirPath, ...args);
    };

    fsp.readFile = async (filePath: unknown, ...args: unknown[]): Promise<unknown> => {
        if (typeof filePath === "string") {
            const p = getActiveProfile();
            if (filePath === `/proc/${MOCK_OPERATION_PID}/cmdline`) {
                const operation = p.installLockOperation;
                if (operation) {
                    return `/bin/bash\0/usr/local/bin/quickbox/package/${operation}/${operation}package-jellyfin\0`;
                }
            }
            if (filePath === "/proc/net/dev") {
                return procNetDev(p.networkInterfaces.map((entry: { iface: string }) => {
                    const current = interfaceCounters(entry.iface);
                    return { iface: entry.iface, rx_bytes: current.total.rx, tx_bytes: current.total.tx };
                }));
            }
        }
        return origReadFile(filePath, ...args);
    };

    fsp.access = async (filePath: unknown, mode?: number): Promise<void> => {
        const pathStr = String(filePath);
        const p = getActiveProfile();

        // Lock files
        if (pathStr.startsWith("/install/.") && pathStr.endsWith(".lock")) {
            if (p.lockFiles.includes(pathStr)) {
                return;
            }
            const err: NodeJS.ErrnoException = new Error(
                `ENOENT: no such file, access '${pathStr}'`,
            );
            err.code = "ENOENT";
            throw err;
        }

        // Torrent directories
        for (const dir of Object.keys(p.torrentDirs)) {
            if (pathStr === dir || pathStr === dir.replace(/\/$/, "")) {
                return;
            }
        }

        return origAccess(filePath, mode);
    };

    // ── child_process ───────────────────────────────────────

    // Disk usage shells out to `df`. Answering the command keeps the collector
    // on its normal path, so the service itself needs no mock branch.
    const origExecFile = cp.execFile.bind(cp) as (...callArgs: unknown[]) => unknown;
    cp.execFile = (...callArgs: unknown[]): unknown => {
        const [file, args, options, callback] = callArgs;
        const done = typeof callback === "function"
            ? callback as (error: Error | null, stdout: string, stderr: string) => void
            : typeof options === "function"
                ? options as (error: Error | null, stdout: string, stderr: string) => void
                : undefined;
        if (file === "df" && done !== undefined) {
            const output = dfOutput(
                fluctuateDisks(getActiveProfile().disks),
                Array.isArray(args) ? args.map(String) : [],
            );
            setImmediate(() => { done(null, output, ""); });
            return { kill: () => undefined };
        }
        return origExecFile(...callArgs);
    };

    console.log(`[mock] fixture environment active (profile: ${getActiveProfile().name})`);
}
