<?php

// SPDX-License-Identifier: GPL-3.0-or-later

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');

$username = getMaster();

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
        'package'     => 'autodlirssi',
        'name'        => 'AutoDL-iRSSi',
        'description' => 'AUTODL',
        'lockfile'    => '/install/.autodlirssi.lock',
        'uninstall'   => 'UNINSTALL_AUTODL_TXT',
        'boxonly'     => false,
        'services'    => [
            'irssi' => [
                'process'  => 'irssi',
                'name'     => 'iRSSi-AutoDL',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'autoremovetorrents',
        'name'        => 'ART',
        'description' => 'ART',
        'lockfile'    => "/install/.{$username}.autoremovetorrents.lock",
        'install'     => 'BOX_TOOLTIP_ART',
        'boxonly'     => true,
    ], [
        'package'     => 'btsync',
        'name'        => 'BTSync',
        'description' => 'BTSYNC',
        'lockfile'    => '/install/.btsync.lock',
        'uninstall'   => 'UNINSTALL_BTSYNC_TXT',
        'boxonly'     => false,
        'services'    => [
            'resilio-sync' => [
                'process'  => 'rslsync',
                'name'     => 'BTSync',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'cifs',
        'name'        => 'CIFS',
        'description' => 'CIFS',
        'lockfile'    => '/install/.samba.lock',
        'uninstall'   => 'UNINSTALL_CIFS_TXT',
        'boxonly'     => false,
        'services'    => [
            'smbd' => [
                'process'  => 'smbd',
                'name'     => 'CIFS',
                'username' => 'root',
            ],
        ],
    ], [
        'package'     => 'deluge',
        'name'        => 'Deluge',
        'description' => 'DELUGE',
        'lockfile'    => '/install/.deluge.lock',
        'uninstall'   => 'UNINSTALL_DELUGE_TXT',
        'boxonly'     => false,
        'services'    => [
            'deluged' => [
                'process'  => 'deluged',
                'name'     => 'DelugeD',
                'username' => $username,
            ],
            'deluge-web' => [
                'process'  => 'deluge-web',
                'name'     => 'Deluge Web',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'denyhosts',
        'name'        => 'Denyhosts',
        'description' => 'DENYHOSTS',
        'lockfile'    => '/install/.denyhosts.lock',
        'install'     => 'BOX_TOOLTIP_DENYHOSTS',
        'boxonly'     => true,
        'services'    => [
            'denyhosts' => [
                'process'  => 'denyhosts',
                'name'     => 'Denyhosts',
                'username' => 'root',
            ],
        ],
    ], [
        'package'     => 'emby',
        'name'        => 'Emby',
        'description' => 'EMBY',
        'lockfile'    => '/install/.emby.lock',
        'uninstall'   => 'UNINSTALL_EMBY_TXT',
        'boxonly'     => false,
        'services'    => [
            'emby-server' => [
                'process'  => 'emby-server',
                'name'     => 'Emby',
                'username' => 'emby',
            ],
        ],
    ], [
        'package'     => 'fail2ban',
        'name'        => 'Fail2ban',
        'description' => 'FAIL2BAN',
        'lockfile'    => '/install/.fail2ban.lock',
        'install'     => 'BOX_TOOLTIP_FAIL2BAN',
        'boxonly'     => true,
        'services'    => [
            'fail2ban' => [
                'process'  => 'fail2ban',
                'name'     => 'Fail2ban',
                'username' => 'root',
            ],
        ],
    ], [
        'package'     => 'filebrowser',
        'name'        => 'File Browser',
        'description' => 'FILEBROWSER',
        'lockfile'    => '/install/.filebrowser.lock',
        'uninstall'   => 'UNINSTALL_FILEBROWSER_TXT',
        'boxonly'     => false,
        'services'    => [
            'filebrowser' => [
                'process'  => 'filebrowser',
                'name'     => 'File Browser',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'filebrowser-ee',
        'name'        => 'FBE',
        'description' => 'FILEBROWSEREE',
        'lockfile'    => '/install/.filebrowser-ee.lock',
        'uninstall'   => 'UNINSTALL_FILEBROWSEREE_TXT',
        'boxonly'     => false,
        'services'    => [
            'filebrowser-ee' => [
                'process'  => 'filebrowser',
                'name'     => 'File Browser Enhanced',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'flexget',
        'name'        => 'Flexget',
        'description' => 'FLEXGET',
        'lockfile'    => "/install/.{$username}.flexget.lock",
        'uninstall'   => 'UNINSTALL_FLEXGET_TXT',
        'boxonly'     => false,
        'services'    => [
            'flexget' => [
                'process'  => 'flexget',
                'name'     => 'FlexGet',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'flood',
        'name'        => 'Flood',
        'description' => 'FLOOD',
        'lockfile'    => '/install/.flood.lock',
        'uninstall'   => 'UNINSTALL_FLOOD_TXT',
        'boxonly'     => false,
        'services'    => [
            'flood' => [
                'process'  => 'flood',
                'name'     => 'Flood',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'h5ai',
        'name'        => 'h5ai',
        'description' => 'H5AI',
        'lockfile'    => '/install/.h5ai.lock',
        'install'     => 'BOX_TOOLTIP_H5AI',
        'boxonly'     => true,
    ], [
        'package'     => 'jellyfin',
        'name'        => 'Jellyfin',
        'description' => 'JELLYFIN',
        'lockfile'    => '/install/.jellyfin.lock',
        'uninstall'   => 'UNINSTALL_JELLYFIN_TXT',
        'boxonly'     => false,
        'services'    => [
            'jellyfin' => [
                'process'  => 'jellyfin',
                'name'     => 'Jellyfin',
                'username' => 'jellyfin',
            ],
        ],
    ], [
        'package'     => 'lecert',
        'name'        => "Let's Encrypt",
        'description' => 'LECERT',
        'lockfile'    => '/install/.lecert.lock',
        'install'     => 'BOX_TOOLTIP_LECERT',
        'boxonly'     => true,
    ], [
        'package'     => 'netdata',
        'name'        => 'Netdata',
        'description' => 'NETDATA',
        'lockfile'    => '/install/.netdata.lock',
        'uninstall'   => 'UNINSTALL_NETDATA_TXT',
        'boxonly'     => false,
        'services'    => [
            'netdata' => [
                'process'  => 'netdata',
                'name'     => 'Netdata',
                'username' => 'netdata',
            ],
        ],
    ], [
        'package'     => 'nfs',
        'name'        => 'NFS',
        'description' => 'NFS',
        'lockfile'    => '/install/.nfs.lock',
        'uninstall'   => 'UNINSTALL_NFS_TXT',
        'boxonly'     => false,
        'services'    => [
            'nfs-server' => [
                'process'  => 'nfsd',
                'name'     => 'NFS',
                'username' => 'root',
            ],
        ],
    ], [
        'package'     => 'novnc',
        'name'        => 'noVNC',
        'description' => 'NOVNC',
        'lockfile'    => '/install/.novnc.lock',
        'uninstall'   => 'UNINSTALL_NOVNC_TXT',
        'boxonly'     => false,
        'services'    => [
            'tightvnc' => [
                'process'  => 'Xtightvnc',
                'name'     => 'noVNC',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'openvpn',
        'name'        => 'OpenVPN',
        'description' => 'OPENVPN',
        'lockfile'    => "/install/.{$username}.openvpn.lock",
        'uninstall'   => 'UNINSTALL_OPENVPN_TXT',
        'boxonly'     => false,
        'services'    => [
            'openvpn' => [
                'process'  => 'openvpn',
                'name'     => 'OpenVPN',
                'username' => 'nobody',
            ],
        ],
    ], [
        'package'     => 'plex',
        'name'        => 'Plex',
        'description' => 'PLEX',
        'lockfile'    => '/install/.plex.lock',
        'uninstall'   => 'UNINSTALL_PLEX_TXT',
        'boxonly'     => false,
        'services'    => [
            'plexmediaserver' => [
                'process'  => 'plexmediaserver',
                'name'     => 'Plex',
                'username' => 'plex',
            ],
        ],
    ], [
        'package'     => 'rclone',
        'name'        => 'Rclone',
        'description' => 'RCLONE',
        'lockfile'    => "/install/.{$username}.rclone.lock",
        'uninstall'   => 'UNINSTALL_RCLONE_TXT',
        'boxonly'     => false,
        'services'    => [
            'rclone-web' => [
                'process'  => 'rcd',
                'name'     => 'Rclone',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'rtorrent',
        'name'        => 'rTorrent',
        'description' => 'RTORRENT',
        'lockfile'    => '/install/.rtorrent.lock',
        'uninstall'   => 'UNINSTALL_RTORRENT_TXT',
        'boxonly'     => false,
        'services'    => [
            'rtorrent' => [
                'process'      => 'rtorrent',
                'name'         => 'rTorrent',
                'username'     => $username,
                'tooltips'     => 'scgi_port: /var/run/'.$username.'/.rtorrent.sock',
                'tooltipsicon' => 'fa-usb',
            ],
        ],
    ], [
        'package'     => 'rutorrent',
        'name'        => 'ruTorrent',
        'description' => 'RUTORRENT',
        'lockfile'    => '/install/.rutorrent.lock',
        'uninstall'   => 'UNINSTALL_RUTORRENT_TXT',
        'boxonly'     => false,
    ], [
        'package'     => 'sabnzbd',
        'name'        => 'SABnzbd',
        'description' => 'SABNZBD',
        'lockfile'    => "/install/.{$username}.sabnzbd.lock",
        'uninstall'   => 'UNINSTALL_SABNZBD_TXT',
        'boxonly'     => false,
        'services'    => [
            'sabnzbd' => [
                'process'  => 'sabnzbd',
                'name'     => 'SABnzbd',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'speedtest',
        'name'        => 'SpeedTest',
        'description' => 'SPEEDTEST',
        'lockfile'    => '/install/.speedtest.lock',
        'uninstall'   => 'UNINSTALL_SPEEDTEST_TXT',
        'boxonly'     => false,
    ], [
        'package'     => 'syncthing',
        'name'        => 'Syncthing',
        'description' => 'SYNCTHING',
        'lockfile'    => '/install/.syncthing.lock',
        'uninstall'   => 'UNINSTALL_SYNCTHING_TXT',
        'boxonly'     => false,
        'services'    => [
            'syncthing' => [
                'process'  => 'syncthing',
                'name'     => 'Syncthing',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'transmission',
        'name'        => 'Transmission',
        'description' => 'TRANSMISSION',
        'lockfile'    => '/install/.transmission.lock',
        'uninstall'   => 'UNINSTALL_TRANSMISSION_TXT',
        'boxonly'     => false,
        'services'    => [
            'transmission' => [
                'process'  => 'transmission-daemon',
                'name'     => 'Transmission',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'qbittorrent',
        'name'        => 'qBittorrent',
        'description' => 'QBITTORRENT',
        'lockfile'    => '/install/.qbittorrent.lock',
        'uninstall'   => 'UNINSTALL_QBITTORRENT_TXT',
        'boxonly'     => false,
        'services'    => [
            'qbittorrent' => [
                'process'  => 'qbittorrent-nox',
                'name'     => 'qBittorrent',
                'username' => $username,
            ],
        ],
    ], [
        'package'     => 'x2go',
        'name'        => 'x2go',
        'description' => 'X2GO',
        'lockfile'    => '/install/.x2go.lock',
        'uninstall'   => 'UNINSTALL_X2GO_TXT',
        'boxonly'     => false,
    ], [
        'package'     => 'znc',
        'name'        => 'ZNC',
        'description' => 'ZNC',
        'lockfile'    => '/install/.znc.lock',
        'install'     => 'BOX_TOOLTIP_ZNC',
        'boxonly'     => true,
        'services'    => [
            'znc' => [
                'process'  => 'znc',
                'name'     => 'ZNC',
                'username' => 'znc',
            ],
        ],
    ], [
        'package'     => 'webdav',
        'name'        => 'WebDAV',
        'description' => 'WEBDAV',
        'lockfile'    => "/install/.{$username}.webdav.lock",
        'uninstall'   => 'UNINSTALL_WEBDAV_TXT',
        'boxonly'     => false,
        'services'    => [
            'webdav' => [
                'process'  => 'webdav',
                'name'     => 'WebDAV',
                'username' => $username,
            ],
        ],
    ], [
        'skip'     => true,
        'package'  => 'vsftpd',
        'name'     => 'vsFTPD',
        'lockfile' => '/etc/vsftpd.conf',
        'services' => [
            'vsftpd' => [
                'process'  => 'vsftpd',
                'name'     => 'vsFTPD',
                'username' => 'root',
            ],
        ],
    ], [
        'skip'     => true,
        'package'  => 'ttyd',
        'name'     => 'Web Console',
        'lockfile' => '/install/.ttyd.lock',
        'services' => [
            'ttyd' => [
                'process'  => 'ttyd',
                'name'     => 'Web Console',
                'username' => $username,
            ],
        ],
    ],
];

$packageMap = [];
foreach ($packageList as $package) {
    if (array_key_exists($package['package'], $packageMap)) {
        error_log("package '{$package['package']}' duplicated in package list!", 0);
    }
    $packageName              = (string) $package['package'];
    $packageMap[$packageName] = $package;
}

/**
 * @param string $packageName
 *
 * @return array<string,mixed>|null
 */
function getPackage($packageName) {
    global $packageMap;
    if (array_key_exists($packageName, $packageMap)) {
        return $packageMap[$packageName];
    }

    return null;
}

$menuList = [
    [
        'name'    => 'ruTorrent',
        'service' => true,
        'ref'     => getPackage('rutorrent'),
        'url'     => '/rutorrent/',
        'logo'    => 'img/brands/rtorrent.png',
    ], [
        'name'    => 'Flood',
        'service' => true,
        'ref'     => getPackage('flood'),
        'url'     => "/{$username}/flood/",
        'logo'    => 'img/brands/flood.png',
    ], [
        'name'    => 'Deluge Web',
        'service' => true,
        'ref'     => getPackage('deluge'),
        'url'     => '/deluge/',
        'logo'    => 'img/brands/deluge.png',
    ], [
        'name'    => 'Transmission Web Control',
        'service' => true,
        'ref'     => getPackage('transmission'),
        'url'     => '/transmission',
        'logo'    => 'img/brands/transmission.png',
    ], [
        'name'    => 'qBittorrent',
        'service' => true,
        'ref'     => getPackage('qbittorrent'),
        'url'     => '/qbittorrent/',
        'logo'    => 'img/brands/qbittorrent.png',
    ], [
        'name'    => 'BTSync',
        'service' => true,
        'ref'     => getPackage('btsync'),
        'url'     => "/{$username}.btsync/",
        'logo'    => 'img/brands/btsync.png',
    ], [
        'name'    => 'Emby',
        'service' => true,
        'ref'     => getPackage('emby'),
        'url'     => '/emby/',
        'logo'    => 'img/brands/emby.png',
    ], [
        'name'    => 'File Browser',
        'service' => true,
        'ref'     => getPackage('filebrowser'),
        'url'     => '/filebrowser/',
        'logo'    => 'img/brands/filebrowser.png',
    ], [
        'name'    => 'File Browser Enhanced',
        'service' => true,
        'ref'     => getPackage('filebrowser-ee'),
        'url'     => '/filebrowser-ee/',
        'logo'    => 'img/brands/filebrowser.png',
    ], [
        'name'    => 'FlexGet',
        'service' => true,
        'ref'     => getPackage('flexget'),
        'url'     => '/flexget/',
        'logo'    => 'img/brands/flexget.png',
    ], [
        'name'    => 'Jellyfin',
        'service' => true,
        'ref'     => getPackage('jellyfin'),
        'url'     => '/jellyfin/',
        'logo'    => 'img/brands/jellyfin.png',
    ], [
        'name'    => 'NetData',
        'service' => true,
        'ref'     => getPackage('netdata'),
        'url'     => '/netdata/',
        'logo'    => 'img/brands/netdata.png',
    ], [
        'name'    => 'noVNC',
        'service' => true,
        'ref'     => getPackage('novnc'),
        'url'     => '/vnc/',
        'logo'    => 'img/brands/novnc.png',
    ], [
        'name'    => 'Plex',
        'service' => true,
        'ref'     => getPackage('plex'),
        'url'     => '/web/',
        'logo'    => 'img/brands/plex.png',
    ], [
        'name'    => 'Rclone',
        'service' => true,
        'ref'     => getPackage('rclone'),
        'url'     => '/rclone/',
        'logo'    => 'img/brands/rclone.png',
    ], [
        'name'    => 'SABnzbd',
        'service' => true,
        'ref'     => getPackage('sabnzbd'),
        'url'     => '/sabnzbd',
        'logo'    => 'img/brands/sabnzbd.png',
    ], [
        'name'    => 'SpeedTest',
        'service' => false,
        'ref'     => getPackage('speedtest'),
        'url'     => '/speedtest/',
        'logo'    => 'img/brands/speedtest.png',
    ], [
        'name'    => 'Syncthing',
        'service' => true,
        'ref'     => getPackage('syncthing'),
        'url'     => "/{$username}.syncthing/",
        'logo'    => 'img/brands/syncthing.png',
    ], [
        'name'    => 'ZNC',
        'service' => true,
        'ref'     => getPackage('znc'),
        'url'     => '/znc/',
        'logo'    => 'img/brands/znc.png',
    ],
];

$downloadList = [
    [
        'name' => 'rTorrent',
        'ref'  => getPackage('rtorrent'),
        'url'  => "/{$username}.rtorrent.downloads",
    ], [
        'name' => 'Deluge',
        'ref'  => getPackage('deluge'),
        'url'  => "/{$username}.deluge.downloads",
    ], [
        'name' => 'Transmission',
        'ref'  => getPackage('transmission'),
        'url'  => "/{$username}.transmission.downloads",
    ], [
        'name' => 'qBittorrent',
        'ref'  => getPackage('qbittorrent'),
        'url'  => "/{$username}.qbittorrent.downloads",
    ], [
        'name'     => 'OpenVPN Config',
        'ref'      => null,
        'lockfile' => "/home/{$username}/openvpn/{$username}.zip",
        'url'      => "/{$username}/ovpn.zip",
    ],
];

/**
 * @param array<string,mixed> $menu_or_package
 *
 * @return bool
 */
function is_package_installed($menu_or_package) {
    $lockfile = null;
    if (array_key_exists('lockfile', $menu_or_package)) {
        $lockfile = $menu_or_package['lockfile'];
    } else {
        if (array_key_exists('ref', $menu_or_package)) {
            $ref = $menu_or_package['ref'];
            if (array_key_exists('lockfile', $ref)) {
                $lockfile = $ref['lockfile'];
            }
        }
    }
    if ($lockfile !== null) {
        return file_exists($lockfile);
    }

    return false;
}

/**
 * @param array<string,mixed> $package
 *
 * @return bool
 */
function is_package_running($package) {
    if (!is_package_installed($package)) {
        return false;
    }
    $valid = true;
    if (array_key_exists('services', $package)) {
        $services = $package['services'];
        foreach ($services as $service) {
            $valid = $valid && processExists($service['process'], $service['username']);
        }
    }

    return $valid;
}

/**
 * @param array<string,mixed> $package
 *
 * @return void
 */
function __check_package_config($package) {
    assert(array_key_exists('package', $package));
    assert(array_key_exists('name', $package));
    $skip = array_key_exists('skip', $package) ? $package['skip'] : false;
    if ($skip === false) {
        assert(array_key_exists('description', $package));
        assert(array_key_exists('lockfile', $package));
        assert(array_key_exists('boxonly', $package));
        $boxonly = $package['boxonly'];
        if ($boxonly === true) {
            assert(array_key_exists('install', $package));
        } else {
            assert(array_key_exists('uninstall', $package));
        }
    } else {
        assert(array_key_exists('services', $package));
    }
    if (array_key_exists('services', $package)) {
        foreach ($package['services'] as $service) {
            assert(array_key_exists('process', $service));
            assert(array_key_exists('name', $service));
            assert(array_key_exists('username', $service));
        }
    }
}

/**
 * @return void
 */
function __check_package() {
    global $packageList;
    foreach ($packageList as $package) {
        echo "checking for package {$package['package']}\n";
        __check_package_config($package);
    }
}

/**
 * @return void
 */
function __check_menu_ref() {
    global $menuList;
    global $downloadList;
    foreach ($menuList as $menu) {
        /** @var bool $status */
        $status = true;
        $status = $status && $menu['ref'] !== null;
        if ($status === false) {
            echo 'menu item misconfigured: ';
            print_r($menu);
        }
    }
    foreach ($downloadList as $download) {
        /** @var bool $status */
        $status = true;
        if (array_key_exists('ref', $download)) {
            $status = $status && ($download['ref'] !== null || $download['lockfile'] !== null);
        }
        if ($status === false) {
            echo 'download item misconfigured: ';
            print_r($download);
        }
    }
}

/*
__check_package();
__check_menu_ref();
*/
