// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Trans, useTranslation } from "react-i18next";

import type { DiskDataData, DiskFileSystemRow } from "../../../ws/src/shared/disk-data-contract";
import { DiskStatusPlaceholder } from "./placeholder";

function HddIcon({ className }: { className: string }) {
    return (
        <span role="img" aria-hidden="true" className={`anticon ${className}`}>
            <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" focusable="false">
                <path d="M5.5 4h13c.9 0 1.7.6 1.9 1.5l1.6 7.2c0 .2.1.4.1.6v4.2c0 1.4-1.1 2.5-2.5 2.5H4.4C3.1 20 2 18.9 2 17.5v-4.2c0-.2 0-.4.1-.6L3.6 5.5C3.8 4.6 4.6 4 5.5 4zm0 2-1.2 5.5h15.4L18.5 6h-13zM4 13.5v4c0 .3.2.5.5.5h15c.3 0 .5-.2.5-.5v-4H4zm11.2 1.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
            </svg>
        </span>
    );
}

function FileSystemRow({ data, labels }: { data: DiskFileSystemRow; labels: DiskDataData["labels"] }) {
    const { t } = useTranslation();
    const percentText = t("PERCENTAGE_TXT", { used: data.percent });
    return (
        <div>
            <div className="row qb-panel-split">
                <div className="col-sm-8 qb-panel-main">
                    <h4>{labels.mountPoint}</h4>
                    <p className="qb-mount-point">{data.mount}</p>
                    <h4>{labels.diskSpace}</h4>
                    <p className="nomargin qb-disk-metrics">
                        <span className="qb-disk-metric">{labels.free}: {data.available}</span>
                        <span className="qb-disk-metric">{labels.used}: {data.used}</span>
                        <span className="qb-disk-metric">{labels.size}: {data.size}</span>
                    </p>
                    <br />
                    <div className="progress">
                        <div style={{ width: `${data.percent}%` }} aria-valuemax={100} aria-valuemin={0} aria-valuenow={data.percent} role="progressbar" className={`progress-bar ${data.progressClass}`}>
                            <span className="sr-only">{data.percent}% {labels.used}</span>
                        </div>
                    </div>
                    <p style={{ fontSize: "10px" }}>{percentText}</p>
                </div>
                <div className="col-sm-4 text-right qb-panel-icon">
                    <HddIcon className={data.diskClass} />
                </div>
            </div>
            <hr />
        </div>
    );
}

const TORRENT_TITLE_KEYS: Record<string, string> = {
    rtorrent: "RTORRENTS_TITLE",
    deluge: "DTORRENTS_TITLE",
    transmission: "TRTORRENTS_TITLE",
    qbittorrent: "QTORRENTS_TITLE",
};

function DiskDataView({ data }: { data: DiskDataData }) {
    const { t } = useTranslation();
    const labels = {
        mountPoint: t("MOUNT_POINT"),
        diskSpace: t("DISK_SPACE"),
        free: t("FREE"),
        used: t("USED"),
        size: t("SIZE"),
    };
    return (
        <div>
            {data.fileSystems.map((filesystem) => (
                <FileSystemRow key={filesystem.mount} data={filesystem} labels={labels} />
            ))}
            <div>
                {data.torrents.map((torrent) => {
                    const title = t(TORRENT_TITLE_KEYS[torrent.key] ?? torrent.title);
                    return (
                        <div key={torrent.key}>
                            <h4>{title}</h4>
                            <p className="nomargin"><Trans i18nKey="TORRENTS_LOADED" values={{ loaded: torrent.loaded }} /></p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function DiskDataRoot({ data }: { data: DiskDataData | null }) {
    return data ? <DiskDataView data={data} /> : <DiskStatusPlaceholder />;
}
