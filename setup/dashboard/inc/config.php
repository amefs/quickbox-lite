<?php

if (isset($_SESSION)) {
    session_destroy();
}

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');

session_start_timeout(5);

$version   = 'v1.4.6';
$branch    = file_exists('/install/.developer.lock') ? 'development' : 'master';
$username  = getUser();
$master    = getMaster();
$is_master = $username === $master;
if (!isset($locale)) {
    $locale = 'UTF8';
}

$panel = [
    'name'        => 'QuickBox Lite',
    'author'      => 'Everyone that contributes to the open QuickBox project!',
    'robots'      => 'noindex, nofollow',
    'title'       => 'Quickbox Dashboard',
    'description' => 'QuickBox is an open-source seedbox project that is developed and maintained by anyone who so choses to provide time and energy.',
    'active_page' => basename($_SERVER['PHP_SELF']),
];

if (file_exists($_SERVER['DOCUMENT_ROOT'].'/custom/url.override.php')) {
    // CUSTOM URL OVERRIDES //
    require($_SERVER['DOCUMENT_ROOT'].'/custom/url.override.php');
} else {
    $http_host         = $_SERVER['HTTP_HOST'];
    $btsyncURL         = "https://{$http_host}/{$username}.btsync/";
    $dwURL             = "https://{$http_host}/deluge/";
    $delugedlURL       = "https://{$http_host}/{$username}.deluge.downloads";
    $filebrowserURL    = "https://{$http_host}/filebrowser/";
    $filebrowsereeURL  = "https://{$http_host}/filebrowser-ee/";
    $flexgetURL        = "https://{$http_host}/flexget/";
    $floodURL          = "https://{$http_host}/{$username}/flood/";
    $netdataURL        = "https://{$http_host}/netdata/";
    $novncURL          = "https://{$http_host}/vnc/";
    $plexURL           = "https://{$http_host}/web/";
    $qbittorrentURL    = "https://{$http_host}/qbittorrent/";
    $qbittorrentdlURL  = "https://{$http_host}/{$username}.qbittorrent.downloads";
    $rtorrentdlURL     = "https://{$http_host}/{$username}.rtorrent.downloads";
    $rutorrentURL      = "https://{$http_host}/rutorrent/";
    $speedtestURL      = "https://{$http_host}/speedtest/";
    $syncthingURL      = "https://{$http_host}/{$username}.syncthing/";
    $transmissionURL   = "https://{$http_host}/transmission";
    $transmissiondlURL = "https://{$http_host}/{$username}.transmission.downloads";
    $openvpndlURL      = "https://{$http_host}/{$username}/ovpn.zip";
    $zncURL            = "https://{$http_host}/znc/";
}

setlocale(\LC_CTYPE, $locale, 'UTF-8', 'en_US.UTF-8', 'en_US.UTF8');
setlocale(\LC_COLLATE, $locale, 'UTF-8', 'en_US.UTF-8', 'en_US.UTF8');
