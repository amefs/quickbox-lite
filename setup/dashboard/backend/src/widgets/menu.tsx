// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getPackage } from "../info";
import { username } from "../shared/constants";
import { getProcessList, processExistsIn } from "../utils/helpers";
import { isPackageInstalled } from "./panels";

interface MenuEntry {
    package?: string;
    lockfile?: string;
    name: string;
    url: string;
    logo?: string;
}

export interface DashboardMenuState {
    installedMenuEntries: MenuEntry[];
    installedDownloadEntries: MenuEntry[];
    showPluginTab: boolean;
    showWebConsole: boolean;
}

const menuEntries: MenuEntry[] = [
    { package: "rutorrent", name: "ruTorrent", url: "/rutorrent/", logo: "img/brands/rtorrent.png" },
    { package: "flood", name: "Flood", url: "/$username$/flood/", logo: "img/brands/flood.png" },
    { package: "deluge", name: "Deluge Web", url: "/deluge/", logo: "img/brands/deluge.png" },
    { package: "transmission", name: "Transmission Web Control", url: "/transmission", logo: "img/brands/transmission.png" },
    { package: "qbittorrent", name: "qBittorrent", url: "/qbittorrent/", logo: "img/brands/qbittorrent.png" },
    { package: "btsync", name: "BTSync", url: "/$username$.btsync/", logo: "img/brands/btsync.png" },
    { package: "emby", name: "Emby", url: "/emby/", logo: "img/brands/emby.png" },
    { package: "filebrowser", name: "File Browser", url: "/filebrowser/", logo: "img/brands/filebrowser.png" },
    { package: "filebrowser-ee", name: "File Browser Enhanced", url: "/filebrowser-ee/", logo: "img/brands/filebrowser.png" },
    { package: "flexget", name: "FlexGet", url: "/flexget/", logo: "img/brands/flexget.png" },
    { package: "jellyfin", name: "Jellyfin", url: "/jellyfin/", logo: "img/brands/jellyfin.png" },
    { package: "netdata", name: "NetData", url: "/netdata/", logo: "img/brands/netdata.png" },
    { package: "novnc", name: "noVNC", url: "/vnc/", logo: "img/brands/novnc.png" },
    { package: "pbh", name: "PeerBanHelper", url: "/pbh/", logo: "img/brands/peerbanhelper.png" },
    { package: "plex", name: "Plex", url: "/web/", logo: "img/brands/plex.png" },
    { package: "rclone", name: "Rclone", url: "/rclone/", logo: "img/brands/rclone.png" },
    { package: "sabnzbd", name: "SABnzbd", url: "/sabnzbd", logo: "img/brands/sabnzbd.png" },
    { package: "speedtest", name: "SpeedTest", url: "/speedtest/", logo: "img/brands/speedtest.png" },
    { package: "syncthing", name: "Syncthing", url: "/$username$.syncthing/", logo: "img/brands/syncthing.png" },
    { package: "znc", name: "ZNC", url: "/znc/", logo: "img/brands/znc.png" },
];

const downloadEntries: MenuEntry[] = [
    { package: "rtorrent", name: "rTorrent", url: "/$username$.rtorrent.downloads" },
    { package: "deluge", name: "Deluge", url: "/$username$.deluge.downloads" },
    { package: "transmission", name: "Transmission", url: "/$username$.transmission.downloads" },
    { package: "qbittorrent", name: "qBittorrent", url: "/$username$.qbittorrent.downloads" },
    {
        lockfile: "/home/$username$/openvpn/$username$.zip",
        name: "OpenVPN Config",
        url: "/$username$/ovpn.zip",
    },
];

const resolveUsernameTemplate = (value: string) => value.replaceAll("$username$", username);

function isEntryInstalled(entry: MenuEntry) {
    if (entry.package) {
        const pkg = getPackage(entry.package);
        return pkg ? isPackageInstalled(pkg) : false;
    }
    if (entry.lockfile) {
        return isPackageInstalled({ lockfile: resolveUsernameTemplate(entry.lockfile) });
    }
    return false;
}

async function isWebConsoleVisible() {
    const ttyd = getPackage("ttyd");
    if (!ttyd || !isPackageInstalled(ttyd) || !ttyd.services) {
        return false;
    }
    const services = Object.values(ttyd.services);
    if (!services.length) {
        return false;
    }
    const processList = await getProcessList();
    return services.every((service) => processExistsIn(processList, service.process ?? "", service.username));
}

export async function resolveDashboardMenuState(): Promise<DashboardMenuState> {
    const installedMenuEntries = menuEntries.filter(isEntryInstalled);
    const installedDownloadEntries = downloadEntries.filter(isEntryInstalled);
    const showPluginTab = isEntryInstalled({ package: "rutorrent", name: "ruTorrent", url: "/rutorrent/" });
    const showWebConsole = await isWebConsoleVisible();

    return {
        installedMenuEntries,
        installedDownloadEntries,
        showPluginTab,
        showWebConsole,
    };
}

export function DashboardMenu({ menuState }: { menuState: DashboardMenuState }) {
    const { installedMenuEntries, installedDownloadEntries, showWebConsole } = menuState;

    return (
        <>
            {installedMenuEntries.map((entry) => (
                <li key={`menu-${entry.name}`}>
                    <a className="grayscale" href={resolveUsernameTemplate(entry.url)} target="_blank" rel="noopener noreferrer">
                        {entry.logo ? (
                            <img src={entry.logo} className="brand-ico" alt="" aria-hidden="true" />
                        ) : null}
                        <span>{entry.name}</span>
                    </a>
                </li>
            ))}

            {installedDownloadEntries.length ? (
                <li className="nav-parent">
                    <a href="#"><i className="fa fa-download"></i> <span>{i18n.t("DOWNLOADS")}</span></a>
                    <ul className="children">
                        {installedDownloadEntries.map((entry) => (
                            <li key={`download-${entry.name}`}>
                                <a href={resolveUsernameTemplate(entry.url)} target="_blank" rel="noopener noreferrer">
                                    {entry.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </li>
            ) : null}

            {showWebConsole ? (
                <li>
                    <a href={`/${username}.console`} target="_blank" rel="noopener noreferrer">
                        <i className="fa fa-keyboard-o"></i> <span>{i18n.t("WEB_CONSOLE")}</span>
                    </a>
                </li>
            ) : null}
        </>
    );
}

export async function dashboardMenu() {
    const menuState = await resolveDashboardMenuState();
    const mainMenuHtml = ReactDOMServer.renderToString(
        <DashboardMenu menuState={menuState} />,
    );

    return {
        mainMenuHtml,
        showPluginTab: menuState.showPluginTab,
    };
}
