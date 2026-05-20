// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Test environment bootstrap — monkey-patches system-level modules
 * when MOCK_ENABLED=1 so that **all** downstream consumers transparently
 * receive mock data.  No source-file modifications are needed.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  MUST be the very first import in server.tsx.            │
 * │  In production (MOCK_ENABLED unset) this file is a       │
 * │  zero-cost no-op — the if-block is never entered.        │
 * └──────────────────────────────────────────────────────────┘
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return,
   @typescript-eslint/require-await, camelcase */

if (process.env.NODE_ENV === "test" && process.env.MOCK_ENABLED === "1") {
    const si  = require("systeminformation");
    const os  = require("os");
    const fs  = require("fs");
    const fsp = require("fs/promises");

    const { getActiveProfile } = require("./mock-adapter") as {
        getActiveProfile: () => import("./mock-profiles").MockProfile;
    };
    const getPrimaryInterface = () => getActiveProfile().networkInterfaces[0]?.iface ?? "eth0";

    // ── systeminformation ──────────────────────────────────

    si.mem = async () => {
        return getActiveProfile().memory;
    };

    si.processes = async () => {
        const p = getActiveProfile();
        return {
            all:      p.processes.length,
            running:  p.processes.length,
            blocked:  0,
            sleeping: 0,
            unknown:  0,
            list: p.processes.map((proc: { pid: number; name: string; cpu: number; mem: number; user: string }) => ({
                pid: proc.pid, parentPid: 1,
                name: proc.name, cpu: proc.cpu, cpuu: proc.cpu, cpus: 0,
                mem: proc.mem, priority: 20, memVsz: 0, memRss: 0,
                nice: 0, started: "2026-01-01 00:00:00", state: "running",
                tty: "", user: proc.user, command: proc.name,
                params: "", path: `/usr/bin/${proc.name}`,
            })),
        };
    };

    si.networkInterfaces = async () => {
        const p = getActiveProfile();
        return p.networkInterfaces.map((ni: { iface: string; operstate: string }) => ({
            iface: ni.iface, ifaceName: ni.iface,
            default: ni.iface === getPrimaryInterface(),
            ip4: "10.0.0.2", ip4subnet: "255.255.255.0",
            ip6: "", ip6subnet: "",
            mac: "00:11:22:33:44:55",
            internal: false, virtual: false,
            operstate: ni.operstate, type: "wired",
            duplex: "full", mtu: 1500, speed: 1000,
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
        return [{
            iface: nd.iface, operstate: nd.operstate,
            rx_bytes: nd.rx_bytes, rx_dropped: 0, rx_errors: 0,
            tx_bytes: nd.tx_bytes, tx_dropped: 0, tx_errors: 0,
            rx_sec: 1024 * 100, tx_sec: 1024 * 50, ms: 1000,
        }];
    };

    si.time = () => ({
        current: Date.now(),
        uptime: getActiveProfile().uptime,
        timezone: "UTC",
        timezoneName: "Coordinated Universal Time",
    });

    // ── os ──────────────────────────────────────────────────

    os.loadavg = () => getActiveProfile().loadavg;

    // ── fs (sync) ───────────────────────────────────────────

    const origExistsSync   = fs.existsSync.bind(fs);
    const origReadFileSync = fs.readFileSync.bind(fs);

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
        if (filePath.startsWith("./dumps/vnstat_dump_")) {
            const iface = filePath.replace("./dumps/vnstat_dump_", "");
            return p.vnstatData?.[iface] !== undefined;
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

    fs.readFileSync = (filePath: unknown, options?: unknown): unknown => {
        if (typeof filePath === "string") {
            const p = getActiveProfile();

            if (filePath === "/srv/dashboard/db/master.txt") {
                return p.username + "\n";
            }

            if (filePath === "/srv/dashboard/db/interface.txt") {
                return getPrimaryInterface() + "\n";
            }

            // Vnstat dump files
            if (filePath.startsWith("./dumps/vnstat_dump_")) {
                const iface = filePath.replace("./dumps/vnstat_dump_", "");
                const data = p.vnstatData?.[iface];
                if (data) {
                    return data;
                }
            }
        }
        return origReadFileSync(filePath, options);
    };

    // ── fs/promises ─────────────────────────────────────────

    const origReaddir = fsp.readdir.bind(fsp);
    const origAccess  = fsp.access.bind(fsp);

    fsp.readdir = async (dirPath: unknown, ...args: unknown[]): Promise<unknown> => {
        const pathStr = String(dirPath);
        const p = getActiveProfile();

        for (const [dir, files] of Object.entries(p.torrentDirs)) {
            if (pathStr === dir || pathStr === dir.replace(/\/$/, "")) {
                return files;
            }
        }
        return origReaddir(dirPath, ...args);
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

    console.log("[bootstrap] Mock environment active");
}
