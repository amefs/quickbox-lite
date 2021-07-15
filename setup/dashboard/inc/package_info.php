<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');

$username = getUser();

/*
$sample = [
    "package"     => "required",
    "name"        => "required",
    "description" => "required|optional(skip!=true)",
    "lockfile"    => "required|optional(skip!=true)",
    "boxonly"     => "required|optional(skip!=true)",
    "install"     => "required|optional(boxonly==true)",
    "uninstall"   => "required|optional(boxonly==false)",
    "skip"        => "optional(set true for service only package)",
    "services"    => [
        "$servicename$" => [
            "process"      => "required",
            "name"         => "required",
            "username"     => "required",
            "tooltips"     => "optional",
            "tooltipsicon" => "optional",
        ],
    ], // (optional|required(boxonly==true))
];
*/

$packageList = [
    [
        "package"     => "autodlirssi",
        "name"        => "AutoDL-iRSSi",
        "description" => "AUTODL",
        "lockfile"    => "/install/.autodlirssi.lock",
        "uninstall"   => "UNINSTALL_AUTODL_TXT",
        "boxonly"     => false,
        "services"    => [
            "irssi" => [
                "process"  => "irssi",
                "name"     => "iRSSi-AutoDL",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "autoremovetorrents",
        "name"        => "ART",
        "description" => "ART",
        "lockfile"    => "/install/.{$username}.autoremovetorrents.lock",
        "install"     => "BOX_TOOLTIP_ART",
        "boxonly"     => true,
    ], [
        "package"     => "btsync",
        "name"        => "BTSync",
        "description" => "BTSYNC",
        "lockfile"    => "/install/.btsync.lock",
        "uninstall"   => "UNINSTALL_BTSYNC_TXT",
        "boxonly"     => false,
        "services"    => [
            "resilio-sync" => [
                "process"  => "rslsync",
                "name"     => "BTSync",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "cifs",
        "name"        => "CIFS",
        "description" => "CIFS",
        "lockfile"    => "/install/.samba.lock",
        "uninstall"   => "UNINSTALL_CIFS_TXT",
        "boxonly"     => false,
        "services"    => [
            "smbd" => [
                "process"  => "smbd",
                "name"     => "CIFS",
                "username" => "root",
            ],
        ],
    ], [
        "package"     => "deluge",
        "name"        => "Deluge",
        "description" => "DELUGE",
        "lockfile"    => "/install/.deluge.lock",
        "uninstall"   => "UNINSTALL_DELUGE_TXT",
        "boxonly"     => false,
        "services"    => [
            "deluged" => [
                "process"  => "deluged",
                "name"     => "DelugeD",
                "username" => $username,
            ],
            "deluge-web" => [
                "process"  => "deluge-web",
                "name"     => "Deluge Web",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "denyhosts",
        "name"        => "Denyhosts",
        "description" => "DENYHOSTS",
        "lockfile"    => "/install/.denyhosts.lock",
        "install"     => "BOX_TOOLTIP_DENYHOSTS",
        "boxonly"     => true,
        "services"    => [
            "denyhosts" => [
                "process"  => "denyhosts",
                "name"     => "Denyhosts",
                "username" => "root",
            ],
        ],
    ], [
        "package"     => "fail2ban",
        "name"        => "Fail2ban",
        "description" => "FAIL2BAN",
        "lockfile"    => "/install/.fail2ban.lock",
        "install"     => "BOX_TOOLTIP_FAIL2BAN",
        "boxonly"     => true,
        "services"    => [
            "fail2ban" => [
                "process"  => "fail2ban",
                "name"     => "Fail2ban",
                "username" => "root",
            ],
        ],
    ], [
        "package"     => "filebrowser",
        "name"        => "File Browser",
        "description" => "FILEBROWSER",
        "lockfile"    => "/install/.filebrowser.lock",
        "uninstall"   => "UNINSTALL_FILEBROWSER_TXT",
        "boxonly"     => false,
        "services"    => [
            "filebrowser" => [
                "process"  => "filebrowser",
                "name"     => "File Browser",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "filebrowser-ee",
        "name"        => "FBE",
        "description" => "FILEBROWSEREE",
        "lockfile"    => "/install/.filebrowser-ee.lock",
        "uninstall"   => "UNINSTALL_FILEBROWSEREE_TXT",
        "boxonly"     => false,
        "services"    => [
            "filebrowser-ee" => [
                "process"  => "filebrowser-ee",
                "name"     => "File Browser Enhanced",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "flexget",
        "name"        => "Flexget",
        "description" => "FLEXGET",
        "lockfile"    => "/install/.{$username}.flexget.lock",
        "uninstall"   => "UNINSTALL_FLEXGET_TXT",
        "boxonly"     => false,
        "services"    => [
            "flexget" => [
                "process"  => "flexget",
                "name"     => "FlexGet",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "flood",
        "name"        => "Flood",
        "description" => "FLOOD",
        "lockfile"    => "/install/.flood.lock",
        "uninstall"   => "UNINSTALL_FLOOD_TXT",
        "boxonly"     => false,
        "services"    => [
            "flood" => [
                "process"  => "flood",
                "name"     => "Flood",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "lecert",
        "name"        => "Let's Encrypt",
        "description" => "LECERT",
        "lockfile"    => "/install/.lecert.lock",
        "install"     => "BOX_TOOLTIP_LECERT",
        "boxonly"     => true,
    ], [
        "package"     => "netdata",
        "name"        => "Netdata",
        "description" => "NETDATA",
        "lockfile"    => "/install/.netdata.lock",
        "uninstall"   => "UNINSTALL_NETDATA_TXT",
        "boxonly"     => false,
        "services"    => [
            "netdata" => [
                "process"  => "netdata",
                "name"     => "Netdata",
                "username" => "netdata",
            ],
        ],
    ], [
        "package"     => "nfs",
        "name"        => "NFS",
        "description" => "NFS",
        "lockfile"    => "/install/.nfs.lock",
        "uninstall"   => "UNINSTALL_NFS_TXT",
        "boxonly"     => false,
        "services"    => [
            "nfs-server" => [
                "process"  => "nfsd",
                "name"     => "NFS",
                "username" => "root",
            ],
        ],
    ], [
        "package"     => "novnc",
        "name"        => "noVNC",
        "description" => "NOVNC",
        "lockfile"    => "/install/.novnc.lock",
        "uninstall"   => "UNINSTALL_NOVNC_TXT",
        "boxonly"     => false,
        "services"    => [
            "tightvnc" => [
                "process"  => "Xtightvnc",
                "name"     => "noVNC",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "openvpn",
        "name"        => "OpenVPN",
        "description" => "OPENVPN",
        "lockfile"    => "/install/.{$username}.openvpn.lock",
        "uninstall"   => "UNINSTALL_OPENVPN_TXT",
        "boxonly"     => false,
        "services"    => [
            "openvpn" => [
                "process"  => "openvpn",
                "name"     => "OpenVPN",
                "username" => "nobody",
            ],
        ],
    ], [
        "package"     => "plex",
        "name"        => "Plex",
        "description" => "PLEX",
        "lockfile"    => "/install/.plex.lock",
        "uninstall"   => "UNINSTALL_PLEX_TXT",
        "boxonly"     => false,
        "services"    => [
            "plexmediaserver" => [
                "process"  => "plexmediaserver",
                "name"     => "Plex",
                "username" => "plex",
            ],
        ],
    ], [
        "package"     => "rtorrent",
        "name"        => "rTorrent",
        "description" => "RTORRENT",
        "lockfile"    => "/install/.rtorrent.lock",
        "uninstall"   => "UNINSTALL_RTORRENT_TXT",
        "boxonly"     => false,
        "services"    => [
            "rtorrent" => [
                "process"      => "rtorrent",
                "name"         => "rTorrent",
                "username"     => $username,
                "tooltips"     => "scgi_port: /var/run/".$username."/.rtorrent.sock",
                "tooltipsicon" => "fa-usb",
            ],
        ],
    ], [
        "package"     => "rutorrent",
        "name"        => "ruTorrent",
        "description" => "RUTORRENT",
        "lockfile"    => "/install/.rutorrent.lock",
        "uninstall"   => "UNINSTALL_RUTORRENT_TXT",
        "boxonly"     => false,
    ], [
        "package"     => "speedtest",
        "name"        => "SpeedTest",
        "description" => "SPEEDTEST",
        "lockfile"    => "/install/.speedtest.lock",
        "uninstall"   => "UNINSTALL_SPEEDTEST_TXT",
        "boxonly"     => false,
    ], [
        "package"     => "syncthing",
        "name"        => "Syncthing",
        "description" => "SYNCTHING",
        "lockfile"    => "/install/.syncthing.lock",
        "uninstall"   => "UNINSTALL_SYNCTHING_TXT",
        "boxonly"     => false,
        "services"    => [
            "syncthing" => [
                "process"  => "syncthing",
                "name"     => "Syncthing",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "transmission",
        "name"        => "Transmission",
        "description" => "TRANSMISSION",
        "lockfile"    => "/install/.transmission.lock",
        "uninstall"   => "UNINSTALL_TRANSMISSION_TXT",
        "boxonly"     => false,
        "services"    => [
            "transmission" => [
                "process"  => "transmission-daemon",
                "name"     => "Transmission",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "qbittorrent",
        "name"        => "qBittorrent",
        "description" => "QBITTORRENT",
        "lockfile"    => "/install/.qbittorrent.lock",
        "uninstall"   => "UNINSTALL_QBITTORRENT_TXT",
        "boxonly"     => false,
        "services"    => [
            "qbittorrent" => [
                "process"  => "qbittorrent-nox",
                "name"     => "qBittorrent",
                "username" => $username,
            ],
        ],
    ], [
        "package"     => "x2go",
        "name"        => "x2go",
        "description" => "X2GO",
        "lockfile"    => "/install/.x2go.lock",
        "uninstall"   => "UNINSTALL_X2GO_TXT",
        "boxonly"     => false,
    ], [
        "package"     => "znc",
        "name"        => "ZNC",
        "description" => "ZNC",
        "lockfile"    => "/install/.znc.lock",
        "install"     => "BOX_TOOLTIP_ZNC",
        "boxonly"     => true,
        "services"    => [
            "znc" => [
                "process"  => "znc",
                "name"     => "ZNC",
                "username" => "znc",
            ],
        ],
    ], [
        "skip"     => true,
        "package"  => "vsftpd",
        "name"     => "vsFTPD",
        "lockfile" => "/etc/vsftpd.conf",
        "services" => [
            "vsftpd" => [
                "process"  => "vsftpd",
                "name"     => "vsFTPD",
                "username" => "root",
            ],
        ],
    ], [
        "skip"     => true,
        "package"  => "shellinabox",
        "name"     => "Web Console",
        "lockfile" => "/install/.shellinabox.lock",
        "services" => [
            "shellinabox" => [
                "process"  => "shellinabox",
                "name"     => "Web Console",
                "username" => "shellinabox",
            ],
        ],
    ],
];

$packageMap = [];
foreach ($packageList as $package) {
    $packageMap[$package["package"]] = $package;
}

$menuList = [
    [
        "name"        => "ruTorrent",
        "service_ref" => "rtorrent",
        "lock_ref"    => "rutorrent",
        "url"         => "/rutorrent/",
        "logo"        => "img/brands/rtorrent.png",
    ], [
        "name"        => "Flood",
        "service_ref" => "flood",
        "lock_ref"    => "flood",
        "url"         => "/{$username}/flood/",
        "logo"        => "img/brands/flood.png",
    ], [
        "name"        => "Deluge Web",
        "service_ref" => "deluge",
        "lock_ref"    => "deluge",
        "url"         => "/deluge/",
        "logo"        => "img/brands/deluge.png",
    ], [
        "name"        => "Transmission Web Control",
        "service_ref" => "transmission",
        "lock_ref"    => "transmission",
        "url"         => "/transmission",
        "logo"        => "img/brands/transmission.png",
    ], [
        "name"        => "qBittorrent",
        "service_ref" => "qbittorrent",
        "lock_ref"    => "qbittorrent",
        "url"         => "/qbittorrent/",
        "logo"        => "img/brands/qbittorrent.png",
    ], [
        "name"        => "BTSync",
        "service_ref" => "btsync",
        "lock_ref"    => "btsync",
        "url"         => "/{$username}.btsync/",
        "logo"        => "img/brands/btsync.png",
    ], [
        "name"        => "File Browser",
        "service_ref" => "filebrowser",
        "lock_ref"    => "filebrowser",
        "url"         => "/filebrowser/",
        "logo"        => "img/brands/filebrowser.png",
    ], [
        "name"        => "File Browser Enhanced",
        "service_ref" => "filebrowser-ee",
        "lock_ref"    => "filebrowser-ee",
        "url"         => "/filebrowser-ee/",
        "logo"        => "img/brands/filebrowser.png",
    ], [
        "name"        => "FlexGet",
        "service_ref" => "flexget",
        "lock_ref"    => "flexget",
        "url"         => "/flexget/",
        "logo"        => "img/brands/flexget.png",
    ], [
        "name"        => "NetData",
        "service_ref" => "netdata",
        "lock_ref"    => "netdata",
        "url"         => "/netdata/",
        "logo"        => "img/brands/netdata.png",
    ], [
        "name"        => "noVNC",
        "service_ref" => "novnc",
        "lock_ref"    => "novnc",
        "url"         => "/vnc/",
        "logo"        => "img/brands/novnc.png",
    ], [
        "name"        => "Plex",
        "service_ref" => "plex",
        "lock_ref"    => "plex",
        "url"         => "/web/",
        "logo"        => "img/brands/plex.png",
    ], [
        "name"     => "SpeedTest",
        "lock_ref" => "speedtest",
        "url"      => "/speedtest/",
        "logo"     => "img/brands/speedtest.png",
    ], [
        "name"     => "Syncthing",
        "lock_ref" => "syncthing",
        "url"      => "/{$username}.syncthing/",
        "logo"     => "img/brands/syncthing.png",
    ], [
        "name"     => "ZNC",
        "lock_ref" => "znc",
        "url"      => "/znc/",
        "logo"     => "img/brands/znc.png",
    ],
];

$downloadList = [
    [
        "name"     => "rTorrent",
        "lock_ref" => "rtorrent",
        "url"      => "/{$username}.rtorrent.downloads",
    ], [
        "name"     => "Deluge",
        "lock_ref" => "deluge",
        "url"      => "/{$username}.deluge.downloads",
    ], [
        "name"     => "Transmission",
        "lock_ref" => "transmission",
        "url"      => "/{$username}.transmission.downloads",
    ], [
        "name"     => "qBittorrent",
        "lock_ref" => "qbittorrent",
        "url"      => "/{$username}.qbittorrent.downloads",
    ], [
        "name"     => "OpenVPN Config",
        "lock_ref" => null,
        "lock_url" => "/home/{$username}/openvpn/{$username}.zip",
        "url"      => "/{$username}/ovpn.zip",
    ],
];

function get_package_ref($package) {
    global $packageMap;
    if ($package === null) {
        return null;
    }
    if (array_key_exists($package, $packageMap)) {
        return $packageMap[$package];
    }
    error_log("package ref to '{$package}' not found!", 0);

    return false;
}

function __check_package_config($package) {
    assert(array_key_exists("package", $package));
    assert(array_key_exists("name", $package));
    $skip = array_key_exists("skip", $package) ? $package["skip"] : false;
    if (!$skip) {
        assert(array_key_exists("description", $package));
        assert(array_key_exists("lockfile", $package));
        assert(array_key_exists("boxonly", $package));
        $boxonly = $package["boxonly"];
        if ($boxonly) {
            assert(array_key_exists("install", $package));
        } else {
            assert(array_key_exists("uninstall", $package));
        }
    } else {
        assert(array_key_exists("services", $package));
    }
    if (array_key_exists("services", $package)) {
        foreach ($package["services"] as $service) {
            assert(array_key_exists("process", $service));
            assert(array_key_exists("name", $service));
            assert(array_key_exists("username", $service));
        }
    }
}

function __check_package() {
    global $packageList;
    foreach ($packageList as $package) {
        echo "checking for package {$package['package']}\n";
        __check_package_config($package);
    }
}

function __check_menu_ref() {
    global $menuList;
    global $downloadList;
    foreach ($menuList as $menu) {
        /** @var bool $status */
        $status = true;
        if (array_key_exists("service_ref", $menu)) {
            $status = $status && (get_package_ref($menu["service_ref"]) !== false);
        }
        if (array_key_exists("lock_ref", $menu)) {
            $status = $status && (get_package_ref($menu["lock_ref"]) !== false);
        }
        if ($status === false) {
            echo "menu item misconfigured: ";
            print_r($menu);
        }
    }
    foreach ($downloadList as $download) {
        /** @var bool $status */
        $status = true;
        if (array_key_exists("lock_ref", $download)) {
            $status = $status && (get_package_ref($download["lock_ref"]) !== false);
        }
        if ($status === false) {
            echo "download item misconfigured: ";
            print_r($download);
        }
    }
}

/*
__check_package();
__check_menu_ref();
*/
