<?php

if (isset($_SESSION)) {
    session_destroy();
}

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');

session_start_timeout(5);

$version = 'v1.5.0';
$panel   = [
    'name'        => 'QuickBox Lite',
    'author'      => 'Everyone that contributes to the open QuickBox project!',
    'robots'      => 'noindex, nofollow',
    'title'       => 'Quickbox Dashboard',
    'description' => 'QuickBox is an open-source seedbox project that is developed and maintained by anyone who so choses to provide time and energy.',
    'active_page' => basename($_SERVER['PHP_SELF']),
];
$username   = getMaster();
$iface_list = ['INETFACE'];
$branch     = 'master';

if (file_exists('/install/.developer.lock')) {
    $branch = 'developer';
    if (file_exists('/install/.debug.lock')) {
        $branch_info = @file('/install/.debug.lock');
        if ($branch_info !== false) {
            $branch = trim($branch_info[0]);
        }
    }
}

if (!isset($locale)) {
    $locale = 'UTF8';
}
setlocale(\LC_CTYPE, $locale, 'UTF-8', 'en_US.UTF-8', 'en_US.UTF8');
setlocale(\LC_COLLATE, $locale, 'UTF-8', 'en_US.UTF-8', 'en_US.UTF8');
