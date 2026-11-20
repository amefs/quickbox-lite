// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Trans, useTranslation } from "react-i18next";

import type { DiskDataData, DiskDataPayload, DiskDataRawData, DiskFileSystemRow } from "../../../ws/src/shared/disk-data-contract";
import { formatSize } from "../utils/format";
import { SkeletonText } from "./placeholder";

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

function normalizeDiskData(payload: DiskDataPayload): {
    fileSystems: DiskFileSystemRow[];
    torrents: { key: string; title?: string; loaded: number }[];
} {
    if ("labels" in payload) {
        return payload;
    }
    const raw: DiskDataRawData = payload;
    return {
        fileSystems: raw.fileSystems.map((filesystem) => ({
            mount: filesystem.mount,
            used: formatSize(filesystem.used),
            available: formatSize(filesystem.available),
            size: formatSize(filesystem.size),
            percent: filesystem.percent,
            percentText: "",
            progressClass: getProgressColor(filesystem.percent),
            diskClass: getDiskClass(filesystem.percent),
        })),
        torrents: raw.torrents,
    };
}

function HddIcon({ className }: { className: string }) {
    return (
        <span role="img" aria-hidden="true" className={`anticon ${className}`}>
            <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" focusable="false">
                <path d="M5.5 4h13c.9 0 1.7.6 1.9 1.5l1.6 7.2c0 .2.1.4.1.6v4.2c0 1.4-1.1 2.5-2.5 2.5H4.4C3.1 20 2 18.9 2 17.5v-4.2c0-.2 0-.4.1-.6L3.6 5.5C3.8 4.6 4.6 4 5.5 4zm0 2-1.2 5.5h15.4L18.5 6h-13zM4 13.5v4c0 .3.2.5.5.5h15c.3 0 .5-.2.5-.5v-4H4zm11.2 1.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
            </svg>
        </span>
    );
}

function FileSystemRow({ data, labels }: { data: DiskFileSystemRow | null; labels: DiskDataData["labels"] }) {
    const { t } = useTranslation();
    return (
        <div aria-hidden={data ? undefined : true}>
            <div className="row qb-panel-split">
                <div className="col-sm-8 qb-panel-main">
                    <h3 className="qb-stat-heading">{labels.mountPoint}</h3>
                    <p className="qb-mount-point">{data?.mount ?? <SkeletonText width="65%" />}</p>
                    <h3 className="qb-stat-heading">{labels.diskSpace}</h3>
                    <p className="nomargin qb-disk-metrics">
                        <span className="qb-disk-metric">{labels.free}: {data?.available ?? <SkeletonText width="8ch" />}</span>
                        <span className="qb-disk-metric">{labels.used}: {data?.used ?? <SkeletonText width="8ch" />}</span>
                        <span className="qb-disk-metric">{labels.size}: {data?.size ?? <SkeletonText width="8ch" />}</span>
                    </p>
                    <br />
                    <div className="progress">
                        {data ? <div style={{ width: `${data.percent}%` }} aria-label={`${labels.diskSpace}: ${data.mount}`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={data.percent} role="progressbar" className={`progress-bar ${data.progressClass}`}>
                            <span className="sr-only">{data.percent}% {labels.used}</span>
                        </div> : <div className="qb-skeleton" style={{ height: "100%" }} />}
                    </div>
                    <p style={{ fontSize: "10px" }}>{data ? t("PERCENTAGE_TXT", { used: data.percent }) : <SkeletonText width="45%" />}</p>
                </div>
                <div className="col-sm-4 text-right qb-panel-icon">
                    <HddIcon className={data?.diskClass ?? ""} />
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

export function DiskDataRoot({ data: payload }: { data: DiskDataPayload | null }) {
    const { t } = useTranslation();
    const data = payload ? normalizeDiskData(payload) : null;
    const labels = {
        mountPoint: t("MOUNT_POINT"),
        diskSpace: t("DISK_SPACE"),
        free: t("FREE"),
        used: t("USED"),
        size: t("SIZE"),
    };
    return (
        <div aria-busy={!data}>
            {data ? data.fileSystems.map((filesystem) => (
                <FileSystemRow key={filesystem.mount} data={filesystem} labels={labels} />
            )) : [0, 1].map((index) => <FileSystemRow key={index} data={null} labels={labels} />)}
            <div>
                {!data ? (
                    <div aria-hidden="true">
                        <h3 className="qb-stat-heading"><SkeletonText width="45%" /></h3>
                        <p className="nomargin"><SkeletonText width="36%" /></p>
                    </div>
                ) : data.torrents.map((torrent) => {
                    const titleKey = Object.hasOwn(TORRENT_TITLE_KEYS, torrent.key)
                        ? TORRENT_TITLE_KEYS[torrent.key]
                        : (torrent.title ?? torrent.key);
                    const title = t(titleKey);
                    return (
                        <div key={torrent.key}>
                            <h3 className="qb-stat-heading">{title}</h3>
                            <p className="nomargin"><Trans i18nKey="TORRENTS_LOADED" values={{ loaded: torrent.loaded }} /></p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
