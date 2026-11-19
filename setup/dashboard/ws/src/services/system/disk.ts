// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync } from "fs";
import fs from "fs/promises";

import { username } from "../../shared/constants";
import type { DiskDataRawData, DiskTorrentRawRow } from "../../shared/disk-data-contract";
import { getProcessList, processExistsIn } from "../../utils/helpers";
import { filterDisplayedFileSystems, getFsSize } from "../../utils/disk";

async function countTorrent(directory: string) {
    try {
        const fileList = await fs.readdir(directory);
        return fileList.filter((file) => file.endsWith(".torrent")).length;
    } catch (error) {
        console.error("Failed to count torrent", error);
        return 0;
    }
}

async function exists(target: string) {
    try {
        await fs.access(target, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function torrentData(): Promise<DiskTorrentRawRow[]> {
    const processList = await getProcessList();
    const checks = [
        {
            key: "rtorrent",
            process: "rtorrent",
            lock: "/install/.rtorrent.lock",
            path: `/home/${username}/.sessions/`,
        },
        {
            key: "deluge",
            process: "deluge-web",
            lock: "/install/.deluge.lock",
            path: `/home/${username}/.config/deluge/state/`,
        },
        {
            key: "transmission",
            process: "transmission-daemon",
            lock: "/install/.transmission.lock",
            path: `/home/${username}/.config/transmission/torrents/`,
        },
        {
            key: "qbittorrent",
            process: "qbittorrent-nox",
            lock: "/install/.qbittorrent.lock",
            path: existsSync(`/home/${username}/.local/share/data/qBittorrent`)
                ? `/home/${username}/.local/share/data/qBittorrent/BT_backup`
                : `/home/${username}/.local/share/qBittorrent/BT_backup`,
        },
    ];

    const lockChecks = await Promise.all(checks.map((check) => exists(check.lock)));
    const activeClients = checks.filter((check, index) => lockChecks[index] &&
        processExistsIn(processList, check.process, username));
    const torrentCounts = await Promise.all(activeClients.map((client) => countTorrent(client.path)));

    return activeClients.map((client, index) => ({
        key: client.key,
        loaded: torrentCounts[index],
    }));
}

export async function diskDataData(): Promise<DiskDataRawData> {
    const fsData = await getFsSize();
    const filteredFileSystems = filterDisplayedFileSystems(fsData);
    const fileSystems = filteredFileSystems.map((filesystem) => ({
        mount: filesystem.mount,
        used: filesystem.used,
        available: filesystem.available,
        size: filesystem.size,
        percent: filesystem.use,
    }));
    const torrents = await torrentData();
    return {
        fileSystems,
        torrents,
    };
}
