<?php
require_once ($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');

$username = getUser();

/*
$sample = [
  "package" => "required",
  "name" => "required",
  "description" => "required",
  "lockfile" => "required",
  "package" => "required",
  "install" => "required when box only is true",
  "uninstall" => "required when boxonly is false",
  "skip" => "true for service only package",
  "services" => [
    "$servicename$" => [
      "process" => "required",
      "name" => "required",
      "username" => "required",
      "tooltips" => "optional",
      "tooltipsicon" => "optional"
    ]
  ]// optional
]
 */

$packageList = array(
  [
    "package" => "autodlirssi",
    "name" => "AutoDL-iRSSi",
    "description" => "AUTODL",
    "lockfile" => "/install/.autodlirssi.lock",
    "uninstall" => "UNINSTALL_AUTODL_TXT",
    "boxonly" => false,
    "services" => [
      "irssi" => [
        "process" => "irssi",
        "name" => "iRSSi-AutoDL",
        "username" => $username
      ]
    ]
  ], [
    "package" => "autoremovetorrents",
    "name" => "ART",
    "description" => "ART",
    "lockfile" => "/install/.$username.autoremovetorrents.lock",
    "install" => "BOX_TOOLTIP_ART",
    "boxonly" => true
  ], [
    "package" => "btsync",
    "name" => "BTSync",
    "description" => "BTSYNC",
    "lockfile" => "/install/.btsync.lock",
    "uninstall" => "UNINSTALL_BTSYNC_TXT",
    "boxonly" => false,
    "services" => [
      "resilio-sync" => [
        "process" => "rslsync",
        "name" => "BTSync",
        "username" => $username
      ]
    ]
  ], [
    "package" => "deluge",
    "name" => "Deluge",
    "description" => "DELUGE",
    "lockfile" => "/install/.deluge.lock",
    "uninstall" => "UNINSTALL_DELUGE_TXT",
    "boxonly" => false,
    "services" => [
      "deluged" => [
        "process" => "deluged",
        "name" => "DelugeD",
        "username" => $username
      ],
      "deluge-web" => [
        "process" => "deluge-web",
        "name" => "Deluge Web",
        "username" => $username
      ]
    ]
  ], [
    "package" => "denyhosts",
    "name" => "Denyhosts",
    "description" => "DENYHOSTS",
    "lockfile" => "/install/.denyhosts.lock",
    "install" => "BOX_TOOLTIP_DENYHOSTS",
    "boxonly" => true,
    "services" => [
      "denyhosts" => [
        "process" => "denyhosts",
        "name" => "Denyhosts",
        "username" => "root"
      ]
    ]
  ], [
    "package" => "fail2ban",
    "name" => "Fail2ban",
    "description" => "FAIL2BAN",
    "lockfile" => "/install/.fail2ban.lock",
    "install" => "BOX_TOOLTIP_FAIL2BAN",
    "boxonly" => true,
    "services" => [
      "fail2ban" => [
        "process" => "fail2ban",
        "name" => "Fail2ban",
        "username" => "root"
      ]
    ]
  ], [
    "package" => "filebrowser",
    "name" => "File Browser",
    "description" => "FILEBROWSER",
    "lockfile" => "/install/.filebrowser.lock",
    "uninstall" => "UNINSTALL_FILEBROWSER_TXT",
    "boxonly" => false,
    "services" => [
      "filebrowser" => [
        "process" => "filebrowser",
        "name" => "File Browser",
        "username" => $username
      ]
    ]
  ], [
    "package" => "filebrowser-ee",
    "name" => "FBE",
    "description" => "FILEBROWSEREE",
    "lockfile" => "/install/.filebrowser-ee.lock",
    "uninstall" => "UNINSTALL_FILEBROWSEREE_TXT",
    "boxonly" => false,
    "services" => [
      "filebrowser-ee" => [
        "process" => "filebrowser-ee",
        "name" => "File Browser Enhanced",
        "username" => $username
      ]
    ]
  ], [
    "package" => "flexget",
    "name" => "Flexget",
    "description" => "FLEXGET",
    "lockfile" => "/install/.$username.flexget.lock",
    "uninstall" => "UNINSTALL_FLEXGET_TXT",
    "boxonly" => false,
    "services" => [
      "flexget" => [
        "process" => "flexget",
        "name" => "FlexGet",
        "username" => $username
      ]
    ]
  ], [
    "package" => "flood",
    "name" => "Flood",
    "description" => "FLOOD",
    "lockfile" => "/install/.flood.lock",
    "uninstall" => "UNINSTALL_FLOOD_TXT",
    "boxonly" => false,
    "services" => [
      "flood" => [
        "process" => "flood",
        "name" => "Flood",
        "username" => $username
      ]
    ]
  ], [
    "package" => "lecert",
    "name" => "Let's Encrypt",
    "description" => "LECERT",
    "lockfile" => "/install/.lecert.lock",
    "install" => "BOX_TOOLTIP_LECERT",
    "boxonly" => true
  ], [
    "package" => "netdata",
    "name" => "Netdata",
    "description" => "NETDATA",
    "lockfile" => "/install/.netdata.lock",
    "uninstall" => "UNINSTALL_NETDATA_TXT",
    "boxonly" => false,
    "services" => [
      "netdata" => [
        "process" => "netdata",
        "name" => "Netdata",
        "username" => "netdata"
      ]
    ]
  ], [
    "package" => "novnc",
    "name" => "noVNC",
    "description" => "NOVNC",
    "lockfile" => "/install/.novnc.lock",
    "uninstall" => "UNINSTALL_NOVNC_TXT",
    "boxonly" => false,
    "services" => [
      "tightvnc" => [
        "process" => "Xtightvnc",
        "name" => "noVNC",
        "username" => $username
      ]
    ]
  ], [
    "package" => "plex",
    "name" => "Plex",
    "description" => "PLEX",
    "lockfile" => "/install/.plex.lock",
    "uninstall" => "UNINSTALL_PLEX_TXT",
    "boxonly" => false,
    "services" => [
      "plexmediaserver" => [
        "process" => "plexmediaserver",
        "name" => "Plex",
        "username" => "plex"
      ]
    ]
  ], [
    "package" => "rtorrent",
    "name" => "rTorrent",
    "description" => "RTORRENT",
    "lockfile" => "/install/.rtorrent.lock",
    "uninstall" => "UNINSTALL_RTORRENT_TXT",
    "boxonly" => false,
    "services" => [
        "rtorrent" => [
          "process" => "rtorrent",
          "name" => "rTorrent",
          "username" => $username,
          "tooltips" => "scgi_port: /var/run/".$username."/.rtorrent.sock",
          "tooltipsicon" => "fa-usb"
        ]
    ]
  ], [
    "package" => "rutorrent",
    "name" => "ruTorrent",
    "description" => "RUTORRENT",
    "lockfile" => "/install/.rutorrent.lock",
    "uninstall" => "UNINSTALL_RUTORRENT_TXT",
    "boxonly" => false
  ], [
    "package" => "syncthing",
    "name" => "Syncthing",
    "description" => "SYNCTHING",
    "lockfile" => "/install/.syncthing.lock",
    "uninstall" => "UNINSTALL_SYNCTHING_TXT",
    "boxonly" => false,
    "services" => [
      "syncthing" => [
        "process" => "syncthing",
        "name" => "Syncthing",
        "username" => $username
      ]
    ]
  ], [
    "package" => "transmission",
    "name" => "Transmission",
    "description" => "TRANSMISSION",
    "lockfile" => "/install/.transmission.lock",
    "uninstall" => "UNINSTALL_TRANSMISSION_TXT",
    "boxonly" => false,
    "services" => [
      "transmission" => [
        "process" => "transmission-daemon",
        "name" => "Transmission",
        "username" => $username
      ]
    ]
  ], [
    "package" => "qbittorrent",
    "name" => "qBittorrent",
    "description" => "QBITTORRENT",
    "lockfile" => "/install/.qbittorrent.lock",
    "uninstall" => "UNINSTALL_QBITTORRENT_TXT",
    "boxonly" => false,
    "services" => [
      "qbittorrent" => [
        "process" => "qbittorrent-nox",
        "name" => "qBittorrent",
        "username" => $username
      ]
    ]
  ], [
    "package" => "x2go",
    "name" => "x2go",
    "description" => "X2GO",
    "lockfile" => "/install/.x2go.lock",
    "uninstall" => "UNINSTALL_X2GO_TXT",
    "boxonly" => false
  ], [
    "package" => "znc",
    "name" => "ZNC",
    "description" => "ZNC",
    "lockfile" => "/install/.znc.lock",
    "install" => "BOX_TOOLTIP_ZNC",
    "boxonly" => true,
    "services" => [
      "znc" => [
        "process" => "znc",
        "name" => "ZNC",
        "username" => "znc"
      ]
    ]
  ], [
    "skip" => true,
    "package" => "shellinabox",
    "name" => "Web Console",
    "lockfile" => "/install/.shellinabox.lock",
    "services" => [
      "shellinabox" => [
        "process" => "shellinabox",
        "name" => "Web Console",
        "username" => "shellinabox"
      ]
    ]
  ]
);
?>
