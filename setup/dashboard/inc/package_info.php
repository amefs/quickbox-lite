<?php
require_once ($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');

$username = getUser();

$packageList = array(
  [
    "package" => "autodlirssi",
    "name" => "AutoDL-iRSSi",
    "description" => "AUTODL",
    "lockfile" => "/install/.autodlirssi.lock",
    "uninstall" => "UNINSTALL_AUTODL_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "irssi" => "iRSSi-AutoDL"
      ],
      "username" => $username
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
    "service" => [
      "process" => [
        "btsync" => "BTSync"
      ],
      "username" => $username
    ]
  ], [
    "package" => "deluge",
    "name" => "Deluge",
    "description" => "DELUGE",
    "lockfile" => "/install/.deluge.lock",
    "uninstall" => "UNINSTALL_DELUGE_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "deluged" => "DelugeD",
        "deluge-web" => "Deluge Web"
      ],
      "username" => $username
    ]
  ], [
    "package" => "denyhosts",
    "name" => "Denyhosts",
    "description" => "DENYHOSTS",
    "lockfile" => "/install/.denyhosts.lock",
    "install" => "BOX_TOOLTIP_DENYHOSTS",
    "boxonly" => true,
    "service" => [
      "process" => [
        "denyhosts" => "Denyhosts"
      ],
      "username" => "root"
    ]
  ], [
    "package" => "fail2ban",
    "name" => "Fail2ban",
    "description" => "FAIL2BAN",
    "lockfile" => "/install/.fail2ban.lock",
    "install" => "BOX_TOOLTIP_FAIL2BAN",
    "boxonly" => true,
    "service" => [
      "process" => [
        "fail2ban" => "Fail2ban"
      ],
      "username" => "root"
    ]
  ], [
    "package" => "filebrowser",
    "name" => "File Browser",
    "description" => "FILEBROWSER",
    "lockfile" => "/install/.filebrowser.lock",
    "uninstall" => "UNINSTALL_FILEBROWSER_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "filebrowser" => "File Browser"
      ],
      "username" => $username
    ]
  ], [
    "package" => "filebrowser-ee",
    "name" => "File Browser Enhanced",
    "description" => "FILEBROWSEREE",
    "lockfile" => "/install/.filebrowser-ee.lock",
    "uninstall" => "UNINSTALL_FILEBROWSEREE_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "filebrowser-ee" => "File Browser Enhanced"
      ],
      "username" => $username
    ]
  ], [
    "package" => "flexget",
    "name" => "Flexget",
    "description" => "FLEXGET",
    "lockfile" => "/install/.$username.flexget.lock",
    "uninstall" => "UNINSTALL_FLEXGET_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "flexget" => "FlexGet"
      ],
      "username" => $username
    ]
  ], [
    "package" => "flood",
    "name" => "Flood",
    "description" => "FLOOD",
    "lockfile" => "/install/.flood.lock",
    "uninstall" => "UNINSTALL_FLOOD_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "flood" => "Flood"
      ],
      "username" => $username
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
    "service" => [
      "process" => [
        "netdata" => "Netdata"
      ],
      "username" => $username
    ]
  ], [
    "package" => "novnc",
    "name" => "noVNC",
    "description" => "NOVNC",
    "lockfile" => "/install/.novnc.lock",
    "uninstall" => "UNINSTALL_NOVNC_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "novnc" => "noVNC"
      ],
      "username" => $username
    ]
  ], [
    "package" => "plex",
    "name" => "Plex",
    "description" => "PLEX",
    "lockfile" => "/install/.plex.lock",
    "uninstall" => "UNINSTALL_PLEX_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "plexmediaserver" => "Plex"
      ],
      "username" => $username
    ]
  ], [
    "package" => "rtorrent",
    "name" => "rTorrent",
    "description" => "RTORRENT",
    "lockfile" => "/install/.rtorrent.lock",
    "uninstall" => "UNINSTALL_RTORRENT_TXT",
    "boxonly" => false,
    "service" => [
        "list" => ["rtorrent"],
        "username" => $username,
        "tooltips" => "scgi_port: /var/run/".$username."/.rtorrent.sock",
        "tooltipsicon" => "fa-usb"
    ]
  ], [
    "package" => "rutorrent",
    "name" => "ruTorrent",
    "description" => "RUTORRENT",
    "lockfile" => "/install/.rutorrent.lock",
    "uninstall" => "UNINSTALL_RUTORRENT_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "netdata" => "Netdata"
      ],
      "username" => "netdata"
    ]
  ], [
    "package" => "syncthing",
    "name" => "Syncthing",
    "description" => "SYNCTHING",
    "lockfile" => "/install/.syncthing.lock",
    "uninstall" => "UNINSTALL_SYNCTHING_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "syncthing" => "Syncthing"
      ],
      "username" => $username
    ]
  ], [
    "package" => "transmission",
    "name" => "Transmission",
    "description" => "TRANSMISSION",
    "lockfile" => "/install/.transmission.lock",
    "uninstall" => "UNINSTALL_TRANSMISSION_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "transmission" => "Transmission"
      ]
    ]
  ], [
    "package" => "qbittorrent",
    "name" => "qBittorrent",
    "description" => "QBITTORRENT",
    "lockfile" => "/install/.qbittorrent.lock",
    "uninstall" => "UNINSTALL_QBITTORRENT_TXT",
    "boxonly" => false,
    "service" => [
      "process" => [
        "qbittorrent" => "qBittorrent"
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
    "uninstall" => "UNINSTALL_ZNC_TXT",
    "boxonly" => false
  ], [
    "skip" => true,
    "package" => "shellinabox",
    "name" => "Web Console",
    "lockfile" => "/install/.shellinabox.lock",
    "service" => [
      "process" => [
        "shellinabox" => "Web Console"
      ],
      "username" => "shellinabox"
    ]
  ]
);
?>
