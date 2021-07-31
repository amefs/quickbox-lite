<?php

$plugins = [
    '_getdir',
    '_noty',
    '_noty2',
    '_task',
    'autotools',
    'check_port',
    'chunks',
    'cookies',
    'cpuload',
    'create',
    'data',
    'datadir',
    'diskspace',
    'edit',
    'erasedata',
    'extratio',
    'extsearch',
    'feeds',
    'filedrop',
    'filemanager',
    'fileshare',
    'fileupload',
    'geoip',
    'history',
    'httprpc',
    'ipad',
    'loginmgr',
    'logoff',
    'lookat',
    'mediainfo',
    'mobile',
    'pausewebui',
    'ratio',
    'ratiocolor',
    'retrackers',
    'rpc',
    'rss',
    'rssurlrewrite',
    'rutracker_check',
    'scheduler',
    'screenshots',
    'seedingtime',
    'show_peers_like_wtorrent',
    'source',
    'spectrogram',
    'stream',
    'theme',
    'throttle',
    'tracklabels',
    'trafic',
    'unpack',
    'uploadeta',
    'xmpp',
];

if (count($_GET) > 0) {
    foreach ($plugins as $plugin) {
        if (isset($_GET["installplugin-{$plugin}"])) {
            header('Location: /');
            shell_exec("sudo /usr/local/bin/quickbox/plugin/install/installplugin-{$plugin}");
            break;
        }
        if (isset($_GET["removeplugin-{$plugin}"])) {
            header('Location: /');
            shell_exec("sudo /usr/local/bin/quickbox/plugin/remove/removeplugin-{$plugin}");
            break;
        }
    }
}
