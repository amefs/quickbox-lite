// SPDX-License-Identifier: GPL-3.0-or-later

/* eslint-disable camelcase */
/**
 * Mock profiles for E2E testing.
 * Each profile defines a simulated system state (processes, memory, disk, network, etc.)
 * that the mock adapter injects when NODE_ENV=test and MOCK_PROFILE is set.
 */

export interface MockProcess {
    name: string;
    user: string;
    pid: number;
    cpu: number;
    mem: number;
}

export interface MockMemory {
    total: number;
    free: number;
    used: number;
    active: number;
    available: number;
    buffcache: number;
    buffers: number;
    cached: number;
    slab: number;
    swaptotal: number;
    swapused: number;
    swapfree: number;
}

export interface MockDisk {
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
}

export interface MockNetworkInterface {
    iface: string;
    operstate: string;
    rx_bytes: number;
    tx_bytes: number;
}

export interface MockProfile {
    name: string;
    username: string;
    processes: MockProcess[];
    memory: MockMemory;
    disks: MockDisk[];
    networkInterfaces: MockNetworkInterface[];
    loadavg: [number, number, number];
    uptime: number;
    cpuModel: string;
    cpuCount: number;
    /** Lock files that exist (e.g. "/install/.rtorrent.lock") */
    lockFiles: string[];
    /** Systemd enabled services (e.g. "rtorrent@testuser") */
    enabledServices: string[];
    /** Torrent files per directory: { "/home/user/.sessions/": ["a.torrent", "b.torrent"] } */
    torrentDirs: Record<string, string[]>;
    /** vnstat dump data (JSON string), keyed by interface name */
    vnstatData?: Record<string, string>;
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const TB = 1024 * GB;

const DEFAULT_USERNAME = "testuser";

export const allRunning: MockProfile = {
    name: "all-running",
    username: DEFAULT_USERNAME,
    processes: [
        { name: "rtorrent", user: DEFAULT_USERNAME, pid: 1001, cpu: 2.5, mem: 3.0 },
        { name: "deluge-web", user: DEFAULT_USERNAME, pid: 1002, cpu: 1.0, mem: 2.0 },
        { name: "deluged", user: DEFAULT_USERNAME, pid: 1003, cpu: 0.5, mem: 1.5 },
        { name: "transmission-daemon", user: DEFAULT_USERNAME, pid: 1004, cpu: 0.3, mem: 1.0 },
        { name: "qbittorrent-nox", user: DEFAULT_USERNAME, pid: 1005, cpu: 1.2, mem: 2.5 },
        { name: "flood", user: DEFAULT_USERNAME, pid: 1006, cpu: 0.2, mem: 0.8 },
        { name: "smbd", user: "root", pid: 1007, cpu: 0.1, mem: 0.3 },
        { name: "vsftpd", user: "root", pid: 1008, cpu: 0.0, mem: 0.1 },
        { name: "fail2ban-server", user: "root", pid: 1009, cpu: 0.1, mem: 0.5 },
        { name: "openvpn", user: "root", pid: 1010, cpu: 0.0, mem: 0.2 },
        { name: "netdata", user: "netdata", pid: 1011, cpu: 0.5, mem: 1.0 },
        { name: "filebrowser", user: DEFAULT_USERNAME, pid: 1012, cpu: 0.1, mem: 0.4 },
        { name: "syncthing", user: DEFAULT_USERNAME, pid: 1013, cpu: 0.2, mem: 0.6 },
        { name: "znc", user: DEFAULT_USERNAME, pid: 1014, cpu: 0.0, mem: 0.2 },
        { name: "ttyd", user: DEFAULT_USERNAME, pid: 1015, cpu: 0.0, mem: 0.1 },
    ],
    memory: {
        total: 16 * GB,
        free: 2 * GB,
        used: 14 * GB,
        active: 8 * GB,
        available: 6 * GB,
        buffcache: 6 * GB,
        buffers: 1 * GB,
        cached: 5 * GB,
        slab: 512 * MB,
        swaptotal: 4 * GB,
        swapused: 512 * MB,
        swapfree: 3.5 * GB,
    },
    disks: [
        { fs: "/dev/sda1", type: "ext4", size: 500 * GB, used: 320 * GB, available: 180 * GB, use: 64, mount: "/" },
        { fs: "/dev/sdb1", type: "ext4", size: 2 * TB, used: 1.2 * TB, available: 0.8 * TB, use: 60, mount: "/home" },
    ],
    networkInterfaces: [
        { iface: "eth0", operstate: "up", rx_bytes: 1234567890, tx_bytes: 987654321 },
    ],
    loadavg: [1.52, 1.34, 1.21],
    uptime: 86400 * 15 + 3600 * 7 + 60 * 23, // 15 days 7 hours 23 minutes
    cpuModel: "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz",
    cpuCount: 4,
    lockFiles: [
        "/install/.rtorrent.lock",
        "/install/.deluge.lock",
        "/install/.transmission.lock",
        "/install/.qbittorrent.lock",
        "/install/.flood.lock",
        "/install/.filebrowser.lock",
        "/install/.syncthing.lock",
        "/install/.znc.lock",
        "/install/.ttyd.lock",
        "/install/.fail2ban.lock",
        "/install/.openvpn.lock",
        "/install/.netdata.lock",
        "/install/.smb.lock",
        "/install/.vsftpd.lock",
    ],
    enabledServices: [
        "rtorrent@testuser",
        "deluged@testuser",
        "deluge-web@testuser",
        "transmission@testuser",
        "qbittorrent@testuser",
        "flood@testuser",
        "filebrowser@testuser",
        "syncthing@testuser",
        "znc@testuser",
        "ttyd@testuser",
        "fail2ban",
        "openvpn",
        "netdata",
        "smbd",
        "vsftpd",
    ],
    torrentDirs: {
        [`/home/${DEFAULT_USERNAME}/.sessions/`]: [
            "ubuntu-24.04.torrent",
            "debian-12.torrent",
            "fedora-40.torrent",
        ],
        [`/home/${DEFAULT_USERNAME}/.config/deluge/state/`]: [
            "archlinux.torrent",
            "manjaro.torrent",
        ],
        [`/home/${DEFAULT_USERNAME}/.config/transmission/torrents/`]: [
            "centos-9.torrent",
        ],
        [`/home/${DEFAULT_USERNAME}/.local/share/qBittorrent/BT_backup`]: [
            "opensuse.torrent",
            "mint.torrent",
        ],
    },
    vnstatData: {
        eth0: JSON.stringify({
            vnstatversion: "2.6",
            jsonversion: "2",
            interfaces: [{
                name: "eth0",
                alias: "",
                created: { date: { year: 2025, month: 1, day: 1 }, time: { hour: 0, minute: 0 } },
                updated: { date: { year: 2026, month: 3, day: 24 }, time: { hour: 14, minute: 30 } },
                traffic: {
                    total: { rx: 500 * GB, tx: 200 * GB },
                    fiveminute: [],
                    hour: [
                        { id: 0, date: { year: 2026, month: 3, day: 24 }, time: { hour: 12, minute: 0 }, rx: 100 * MB, tx: 50 * MB },
                        { id: 1, date: { year: 2026, month: 3, day: 24 }, time: { hour: 13, minute: 0 }, rx: 200 * MB, tx: 80 * MB },
                        { id: 2, date: { year: 2026, month: 3, day: 24 }, time: { hour: 14, minute: 0 }, rx: 150 * MB, tx: 60 * MB },
                    ],
                    day: [
                        { id: 0, date: { year: 2026, month: 3, day: 22 }, rx: 5 * GB, tx: 2 * GB },
                        { id: 1, date: { year: 2026, month: 3, day: 23 }, rx: 8 * GB, tx: 3 * GB },
                        { id: 2, date: { year: 2026, month: 3, day: 24 }, rx: 3 * GB, tx: 1 * GB },
                    ],
                    month: [
                        { id: 0, date: { year: 2026, month: 2 }, rx: 100 * GB, tx: 50 * GB },
                        { id: 1, date: { year: 2026, month: 3 }, rx: 80 * GB, tx: 30 * GB },
                    ],
                    tops: [
                        { id: 0, date: { year: 2026, month: 3, day: 15 }, rx: 15 * GB, tx: 8 * GB },
                        { id: 1, date: { year: 2026, month: 2, day: 28 }, rx: 12 * GB, tx: 6 * GB },
                    ],
                    top: [
                        { id: 0, date: { year: 2026, month: 3, day: 15 }, rx: 15 * GB, tx: 8 * GB },
                        { id: 1, date: { year: 2026, month: 2, day: 28 }, rx: 12 * GB, tx: 6 * GB },
                    ],
                },
            }],
        }),
    },
};

export const partialRunning: MockProfile = {
    ...allRunning,
    name: "partial-running",
    processes: [
        { name: "transmission-daemon", user: DEFAULT_USERNAME, pid: 1101, cpu: 0.6, mem: 1.2 },
        { name: "qbittorrent-nox", user: DEFAULT_USERNAME, pid: 1102, cpu: 1.4, mem: 2.8 },
        { name: "fail2ban", user: "root", pid: 1103, cpu: 0.1, mem: 0.4 },
        { name: "netdata", user: "netdata", pid: 1104, cpu: 0.3, mem: 0.9 },
        { name: "ttyd", user: DEFAULT_USERNAME, pid: 1105, cpu: 0.0, mem: 0.1 },
    ],
    memory: {
        total: 8 * GB,
        free: 2.5 * GB,
        used: 5.5 * GB,
        active: 3.5 * GB,
        available: 4.2 * GB,
        buffcache: 1.7 * GB,
        buffers: 256 * MB,
        cached: 1.2 * GB,
        slab: 256 * MB,
        swaptotal: 2 * GB,
        swapused: 128 * MB,
        swapfree: 1.875 * GB,
    },
    disks: [
        { fs: "/dev/sda1", type: "ext4", size: 500 * GB, used: 210 * GB, available: 290 * GB, use: 42, mount: "/" },
        { fs: "/dev/sdb1", type: "ext4", size: 2 * TB, used: 980 * GB, available: 1.02 * TB, use: 49, mount: "/home" },
    ],
    networkInterfaces: [
        { iface: "eth0", operstate: "up", rx_bytes: 2147483648, tx_bytes: 805306368 },
    ],
    loadavg: [0.82, 0.74, 0.69],
    uptime: 86400 * 6 + 3600 * 11 + 60 * 17,
    lockFiles: [
        "/install/.rtorrent.lock",
        "/install/.transmission.lock",
        "/install/.qbittorrent.lock",
        "/install/.filebrowser.lock",
        "/install/.syncthing.lock",
        "/install/.fail2ban.lock",
        "/install/.netdata.lock",
        "/install/.ttyd.lock",
    ],
    enabledServices: [
        "rtorrent@testuser",
        "transmission@testuser",
        "qbittorrent@testuser",
        "filebrowser@testuser",
        "syncthing@testuser",
        "fail2ban",
        "netdata",
        "ttyd@testuser",
    ],
    torrentDirs: {
        [`/home/${DEFAULT_USERNAME}/.sessions/`]: [
            "ubuntu-24.04.torrent",
            "debian-12-netinst.torrent",
        ],
        [`/home/${DEFAULT_USERNAME}/.config/transmission/torrents/`]: [
            "freebsd-14.2.torrent",
        ],
        [`/home/${DEFAULT_USERNAME}/.local/share/qBittorrent/BT_backup`]: [
            "opensuse.torrent",
            "mint.torrent",
            "endeavouros.torrent",
        ],
    },
    vnstatData: {
        eth0: JSON.stringify({
            vnstatversion: "2.6",
            jsonversion: "2",
            interfaces: [{
                name: "eth0",
                alias: "",
                created: { date: { year: 2025, month: 11, day: 10 }, time: { hour: 9, minute: 30 } },
                updated: { date: { year: 2026, month: 3, day: 24 }, time: { hour: 21, minute: 40 } },
                traffic: {
                    total: { rx: 320 * GB, tx: 118 * GB },
                    fiveminute: [],
                    hour: [
                        { id: 0, date: { year: 2026, month: 3, day: 24 }, time: { hour: 18, minute: 0 }, rx: 42 * MB, tx: 18 * MB },
                        { id: 1, date: { year: 2026, month: 3, day: 24 }, time: { hour: 19, minute: 0 }, rx: 96 * MB, tx: 37 * MB },
                        { id: 2, date: { year: 2026, month: 3, day: 24 }, time: { hour: 20, minute: 0 }, rx: 188 * MB, tx: 74 * MB },
                        { id: 3, date: { year: 2026, month: 3, day: 24 }, time: { hour: 21, minute: 0 }, rx: 128 * MB, tx: 51 * MB },
                    ],
                    day: [
                        { id: 0, date: { year: 2026, month: 3, day: 20 }, rx: 6 * GB, tx: 2 * GB },
                        { id: 1, date: { year: 2026, month: 3, day: 21 }, rx: 4 * GB, tx: 1 * GB },
                        { id: 2, date: { year: 2026, month: 3, day: 22 }, rx: 8 * GB, tx: 3 * GB },
                        { id: 3, date: { year: 2026, month: 3, day: 23 }, rx: 11 * GB, tx: 4 * GB },
                        { id: 4, date: { year: 2026, month: 3, day: 24 }, rx: 5 * GB, tx: 2 * GB },
                    ],
                    month: [
                        { id: 0, date: { year: 2026, month: 1 }, rx: 70 * GB, tx: 24 * GB },
                        { id: 1, date: { year: 2026, month: 2 }, rx: 96 * GB, tx: 35 * GB },
                        { id: 2, date: { year: 2026, month: 3 }, rx: 82 * GB, tx: 31 * GB },
                    ],
                    tops: [
                        { id: 0, date: { year: 2026, month: 3, day: 23 }, rx: 11 * GB, tx: 4 * GB },
                        { id: 1, date: { year: 2026, month: 2, day: 14 }, rx: 10 * GB, tx: 3 * GB },
                        { id: 2, date: { year: 2026, month: 1, day: 29 }, rx: 9 * GB, tx: 3 * GB },
                    ],
                    top: [
                        { id: 0, date: { year: 2026, month: 3, day: 23 }, rx: 11 * GB, tx: 4 * GB },
                        { id: 1, date: { year: 2026, month: 2, day: 14 }, rx: 10 * GB, tx: 3 * GB },
                        { id: 2, date: { year: 2026, month: 1, day: 29 }, rx: 9 * GB, tx: 3 * GB },
                    ],
                },
            }],
        }),
    },
};

export const emptySystem: MockProfile = {
    ...allRunning,
    name: "empty-system",
    processes: [],
    memory: {
        total: 4 * GB,
        free: 3 * GB,
        used: 1 * GB,
        active: 512 * MB,
        available: 3.5 * GB,
        buffcache: 512 * MB,
        buffers: 128 * MB,
        cached: 384 * MB,
        slab: 64 * MB,
        swaptotal: 2 * GB,
        swapused: 0,
        swapfree: 2 * GB,
    },
    disks: [
        { fs: "/dev/sda1", type: "ext4", size: 100 * GB, used: 15 * GB, available: 85 * GB, use: 15, mount: "/" },
    ],
    loadavg: [0.05, 0.03, 0.01],
    uptime: 3600 * 2 + 60 * 5, // 2 hours 5 minutes
    lockFiles: [],
    enabledServices: [],
    torrentDirs: {},
};

const profiles: Record<string, MockProfile> = {
    "all-running": allRunning,
    "partial-running": partialRunning,
    "empty-system": emptySystem,
};

export function getProfile(name?: string): MockProfile {
    const profileName = name || process.env.MOCK_PROFILE || "all-running";
    return profiles[profileName] ?? allRunning;
}
