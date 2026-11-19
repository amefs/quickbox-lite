// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync } from "fs";
import fs from "fs/promises";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { username } from "../shared/constants";
import type { DiskDataData, DiskFileSystemRow } from "../shared/disk-data-contract";
import i18n from "../i18n";
import { getProcessList, processExistsIn, formatSize } from "../utils/helpers";
import { filterDisplayedFileSystems, getFsSize } from "../utils/disk";
import { DiskDataRoot } from "./disk-data-island";

function getProgressColor(percent: number): DiskFileSystemRow["progressClass"] {
    if (percent >= 90) {
        return "progress-bar-danger";
    }
    if (percent >= 70) {
        return "progress-bar-warning";
    }
    return "progress-bar-success";
}

function getDiskClass(percent: number): DiskFileSystemRow["diskClass"] {
    if (percent >= 90) {
        return "disk-danger";
    }
    if (percent >= 70) {
        return "disk-warning";
    }
    return "disk-good";
}

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

async function torrentData(): Promise<DiskDataData["torrents"]> {
    const processList = await getProcessList();
    const checks = [
        {
            key: "rtorrent",
            process: "rtorrent",
            lock: "/install/.rtorrent.lock",
            title: "RTORRENTS_TITLE",
            path: `/home/${username}/.sessions/`,
        },
        {
            key: "deluge",
            process: "deluge-web",
            lock: "/install/.deluge.lock",
            title: "DTORRENTS_TITLE",
            path: `/home/${username}/.config/deluge/state/`,
        },
        {
            key: "transmission",
            process: "transmission-daemon",
            lock: "/install/.transmission.lock",
            title: "TRTORRENTS_TITLE",
            path: `/home/${username}/.config/transmission/torrents/`,
        },
        {
            key: "qbittorrent",
            process: "qbittorrent-nox",
            lock: "/install/.qbittorrent.lock",
            title: "QTORRENTS_TITLE",
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
        title: i18n.t(client.title),
        loadedHtml: i18n.t("TORRENTS_LOADED", { loaded: torrentCounts[index] }),
        loaded: torrentCounts[index],
    }));
}

export async function diskDataData(): Promise<DiskDataData> {
    const fsData = await getFsSize();
    const filteredFileSystems = filterDisplayedFileSystems(fsData);
    const fileSystems = filteredFileSystems.map((filesystem) => ({
        mount: filesystem.mount,
        used: formatSize(filesystem.used),
        available: formatSize(filesystem.available),
        size: formatSize(filesystem.size),
        percent: filesystem.use,
        percentText: i18n.t("PERCENTAGE_TXT", { used: filesystem.use }),
        progressClass: getProgressColor(filesystem.use),
        diskClass: getDiskClass(filesystem.use),
    }));
    const torrents = await torrentData();
    return {
        labels: {
            mountPoint: i18n.t("MOUNT_POINT"),
            diskSpace: i18n.t("DISK_SPACE"),
            free: i18n.t("FREE"),
            used: i18n.t("USED"),
            size: i18n.t("SIZE"),
        },
        fileSystems,
        torrents,
    };
}

export async function diskData() {
    return ReactDOMServer.renderToString(<DiskDataRoot data={await diskDataData()} />);
}
