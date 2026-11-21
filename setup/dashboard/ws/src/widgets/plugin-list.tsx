// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { RutorrentPlugin } from "../plugins";

/**
 * Sidebar entries for the ruTorrent plugin tab. The toggle markup is inert on
 * the server: js/dashboard.js turns the toggle classes into clickable switches
 * and posts the data-plugin-action to /node/plugin.
 */
export function RutorrentPluginList({ plugins }: { plugins: readonly RutorrentPlugin[] }) {
    return (
        <>
            {plugins.map((plugin) => (
                <li key={plugin.name}>
                    <a href="#">{plugin.label ?? plugin.name}</a>
                    <div className="toggle-wrapper pull-right" style={{ marginRight: "-10px", marginTop: "5px" }}>
                        <div
                            className={plugin.installed ? "toggle-pen toggle-modern" : "toggle-pdis toggle-modern"}
                            data-plugin={plugin.name}
                            data-plugin-action={plugin.installed ? "remove" : "install"}
                        ></div>
                    </div>
                </li>
            ))}
        </>
    );
}
