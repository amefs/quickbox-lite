import si from "systeminformation";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { existsSync } from "fs";
import fs from "fs/promises";

import { username } from "../constant";
import i18n from "../i18n";
import { processExists, formatSize } from "../utils";


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
    const fileList = await fs.readdir(path);
    return fileList.filter((file) => file.endsWith(".torrent")).length;
}

async function exists(path: string) {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    } catch (err) {
        return false;
    }
}


function renderFileSystem(data: si.Systeminformation.FsSizeData) {
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
    const torrentElement = (title: string, loaded: number) => (
        <div>
            <h4>{i18n.t(title)}</h4>
            <p className="nomargin">{i18n.t("TORRENTS_LOADED", {loaded})}</p>
        </div>
    );

    const ret: React.JSX.Element[] = [];

    if (await processExists("rtorrent", username) && await exists("/install/.rtorrent.lock")) {
        const rtorrents = await countTorrent(`/home/.${username}/.sessions/`);
        ret.push(torrentElement("RTORRENTS_TITLE", rtorrents));
    }
    if (await processExists("deluged", username) && await exists("/install/.deluge.lock")) {
        const dtorrents = await countTorrent(`/home/.${username}/.config/deluge/state/`);
        ret.push(torrentElement("DTORRENTS_TITLE", dtorrents));
    }
    if (await processExists("transmission", username) && await exists("/install/.transmission.lock")) {
        const transtorrents = await countTorrent(`/home/.${username}/.config/transmission/torrents/`);
        ret.push(torrentElement("TRTORRENTS_TITLE", transtorrents));
    }
    if (await processExists("qbittorrent-nox", username) && await exists("/install/.qbittorrent.lock")) {
        const path = existsSync(`/home/${username}/.local/share/data/qBittorrent`) ?
            `/home/${username}/.local/share/data/qBittorrent/BT_backup` :
            `/home/${username}/.local/share/qBittorrent/BT_backup`;
        const qtorrents = await countTorrent(path);
        ret.push(torrentElement("QTORRENTS_TITLE", qtorrents));
    }

    return (
        <div>
            {ret}
        </div>
    );
}

export async function diskData() {
    const fsData = await si.fsSize();
    return ReactDOMServer.renderToString(
        <div>
            {fsData.filter(data => data.size > 1<<30 && !data.mount.startsWith("/var/lib/docker/overlay")).map(renderFileSystem)}
            {await renderTorrentInfo()}
        </div>
    );
}
