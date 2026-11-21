// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile } from "child_process";
import { existsSync } from "fs";

export type PluginAction = "install" | "remove";

export const rutorrentPlugins = [
    "_getdir",
    "_noty",
    "_task",
    "autotools",
    "check_port",
    "chunks",
    "cookies",
    "cpuload",
    "create",
    "data",
    "datadir",
    "diskspace",
    "edit",
    "erasedata",
    "extratio",
    "extsearch",
    "feeds",
    "filedrop",
    "filemanager",
    "fileshare",
    "fileupload",
    "geoip",
    "history",
    "httprpc",
    "ipad",
    "loginmgr",
    "logoff",
    "lookat",
    "mediainfo",
    "mobile",
    "pausewebui",
    "ratio",
    "ratiocolor",
    "retrackers",
    "rpc",
    "rss",
    "rssurlrewrite",
    "rutracker_check",
    "scheduler",
    "screenshots",
    "seedingtime",
    "show_peers_like_wtorrent",
    "source",
    "spectrogram",
    "stream",
    "theme",
    "throttle",
    "tracklabels",
    "trafic",
    "unpack",
    "xmpp",
] as const;

export function isRutorrentPlugin(plugin: unknown): plugin is string {
    return typeof plugin === "string" && rutorrentPlugins.some((entry) => entry === plugin);
}

export function isPluginAction(action: unknown): action is PluginAction {
    return action === "install" || action === "remove";
}

export interface RutorrentPlugin {
    name: string;
    label?: string;
    installed: boolean;
}

export function getRutorrentPlugins(): RutorrentPlugin[] {
    const isInstalled = (plugin: string) => existsSync(`/srv/rutorrent/plugins/${plugin}/plugin.info`);
    return rutorrentPlugins.map((plugin) => ({
        name: plugin,
        ...(plugin === "_noty" ? { label: "_noty / _noty2" } : {}),
        installed: isInstalled(plugin) || (plugin === "_noty" && isInstalled("_noty2")),
    }));
}

export function applyRutorrentPluginAction(plugin: unknown, action: unknown) {
    return applyRutorrentPluginActionWithExecFile(plugin, action);
}

export function applyRutorrentPluginActionWithExecFile(
    plugin: unknown,
    action: unknown,
    runExecFile: typeof execFile = execFile,
) {
    if (!isRutorrentPlugin(plugin)) {
        return Promise.reject(new Error("Invalid plugin"));
    }
    if (!isPluginAction(action)) {
        return Promise.reject(new Error("Invalid plugin action"));
    }

    return new Promise<void>((resolve, reject) => {
        runExecFile("sudo", [`/usr/local/bin/quickbox/plugin/${action}/${action}plugin-${plugin}`], (error) => {
            if (error) {
                reject(new Error(error.message));
                return;
            }
            resolve();
        });
    });
}
