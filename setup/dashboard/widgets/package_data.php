<?php
# Gobal install
$mpackages = array(
        'autodlirssi',
        'btsync',
        'deluge',
        'filebrowser',
	'flood',
        'netdata',
        'novnc',
        'plex',
        'qbittorrent',
        'rtorrent',
        'rutorrent',
        'syncthing',
        'transmission',
        'x2go',
        'znc'
);

foreach ($mpackages as $ipackage) {
if (isset($_GET['installpackage-'.$ipackage.''])) {
        header('Location: //');
        shell_exec("sudo /usr/local/bin/quickbox/package/install/installpackage-$ipackage");
}}

foreach ($mpackages as $rpackage) {
if (isset($_GET['removepackage-'.$rpackage.''])) {
        header('Location: /');
        shell_exec("sudo /usr/local/bin/quickbox/package/remove/removepackage-$rpackage");
        exec("sleep 3");
}}

# Single User install
$spackages = array(
        'flexget',
);

foreach ($spackages as $ipackage) {
if (isset($_GET['installpackage-'.$ipackage.''])) {
        header('Location: //');
        shell_exec("sudo /usr/local/bin/quickbox/package/install/installpackage-$ipackage -u $username");
}}

foreach ($spackages as $rpackage) {
if (isset($_GET['removepackage-'.$rpackage.''])) {
        header('Location: /');
        shell_exec("sudo /usr/local/bin/quickbox/package/remove/removepackage-$rpackage -u $username");
        exec("sleep 3");
}}

?>