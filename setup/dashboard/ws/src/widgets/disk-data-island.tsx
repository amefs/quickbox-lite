// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { DiskDataData, DiskFileSystemRow } from "../shared/disk-data-contract";
import { DiskStatusPlaceholder } from "./placeholder";

function FileSystemRow({ data, labels }: { data: DiskFileSystemRow; labels: DiskDataData["labels"] }) {
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
                    <p style={{ fontSize: "10px" }}>{data.percentText}</p>
                </div>
                <div className="col-sm-4 text-right qb-panel-icon">
                    <i className={`fa fa-hdd-o ${data.diskClass}`}></i>
                </div>
            </div>
            <hr />
        </div>
    );
}

function DiskDataView({ data }: { data: DiskDataData }) {
    return (
        <div>
            {data.fileSystems.map((filesystem) => (
                <FileSystemRow key={filesystem.mount} data={filesystem} labels={data.labels} />
            ))}
            <div>
                {data.torrents.map((torrent) => (
                    <div key={torrent.key}>
                        <h4>{torrent.title}</h4>
                        <p className="nomargin" dangerouslySetInnerHTML={{ __html: torrent.loadedHtml }}></p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DiskDataRoot({ data }: { data: DiskDataData | null }) {
    return data ? <DiskDataView data={data} /> : <DiskStatusPlaceholder />;
}
