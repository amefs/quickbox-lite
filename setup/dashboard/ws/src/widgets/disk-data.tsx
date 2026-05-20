// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import ReactDOMServer from "react-dom/server";
import { existsSync } from "fs";
import fs from "fs/promises";

import { username } from "../shared/constants";
import i18n from "../i18n";
import { getProcessList, processExistsIn, formatSize } from "../utils/helpers";
import { type FsSizeData, filterDisplayedFileSystems, getFsSize } from "../utils/disk";


function getProgressColor(percent: number) {
    if (percent >= 90) {
        return "progress-bar-danger";
    }
    if (percent >= 70) {
        return "progress-bar-warning";
    }

    return "progress-bar-success";
}

function getDiskClass(percent: number) {
    if (percent >= 90) {
        return "disk-danger";
    }
    if (percent >= 70) {
        return "disk-warning";
    }

    return "disk-good";
}

async function countTorrent(path: string) {
    try {
        const fileList = await fs.readdir(path);
        return fileList.filter((file) => file.endsWith(".torrent")).length;
    } catch (ex) {
        console.error("Failed to count torrent", ex);
        return 0;
    }
}

async function exists(path: string) {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
        return false;
    }
}

function renderFileSystem(data: FsSizeData) {
    const diskcolor = getProgressColor(data.use);
    const diskclass = getDiskClass(data.use);
    return (
        <div key={data.mount}>
            <div className="row">
                <div className="col-sm-8">
                    <h4>{i18n.t("MOUNT_POINT")}</h4>
                    <p style={{color:"#eb4549", fontWeight:"normal", fontSize: "14px"}}>{data.mount}</p>
                    <h4>{i18n.t("DISK_SPACE")}</h4>
                    <p className="nomargin" style={{fontSize: "14px"}}>
                        {i18n.t("FREE")}: {formatSize(data.available)}&nbsp;丨&nbsp;
                        {i18n.t("USED")}: {formatSize(data.used)}&nbsp;丨&nbsp;
                        {i18n.t("SIZE")}: {formatSize(data.size)}
                    </p>
                    <br/>
                    <div className="progress">
                        <div style={{width: `${data.use}%`}} aria-valuemax={100} aria-valuemin={0} aria-valuenow={data.use} role="progressbar" className={`progress-bar ${diskcolor}`}>
                            <span className="sr-only">{data.use}% {i18n.t("USED")}</span>
                        </div>
                    </div>
                    <p style={{fontSize: "10px"}}>{i18n.t("PERCENTAGE_TXT", {used: data.use})}</p>
                </div>
                <div className="col-sm-4 text-right">
                    <i className={`fa fa-hdd-o ${diskclass}`} style={{fontSize: "90px"}}></i>
                </div>
            </div>
            <hr/>
        </div>);
}

async function renderTorrentInfo() {
    const torrentElement = (key: string, title: string, loaded: number) => (
        <div key={key}>
            <h4>{i18n.t(title)}</h4>
            <p className="nomargin" dangerouslySetInnerHTML={{__html: i18n.t("TORRENTS_LOADED", {loaded})}}></p>
        </div>
    );

    const ret: React.JSX.Element[] = [];
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

    const lockChecks = await Promise.all(checks.map(c => exists(c.lock)));
    const activeClients = checks.filter((c, i) => lockChecks[i] && processExistsIn(processList, c.process, username));
    const torrentCounts = await Promise.all(activeClients.map(c => countTorrent(c.path)));

    for (let i = 0; i < activeClients.length; i++) {
        ret.push(torrentElement(activeClients[i].key, activeClients[i].title, torrentCounts[i]));
    }

    return (
        <div>
            {ret}
        </div>
    );
}

export async function diskData() {
    const fsData = await getFsSize();
    const filteredFsData = filterDisplayedFileSystems(fsData);
    
    return ReactDOMServer.renderToString(
        <div>
            {filteredFsData.map(renderFileSystem)}
            {await renderTorrentInfo()}
        </div>,
    );
}
