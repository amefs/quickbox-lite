<?php

if (isset($_SESSION)) {
    session_destroy();
}

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/widgets/class.php');

$version = "v1.4.6";
$branch  = file_exists('/install/.developer.lock') ? "development" : "master";
error_reporting(E_ERROR);
$username = getUser();
$master   = file_get_contents($_SERVER['DOCUMENT_ROOT'].'/db/master.txt');
$master   = preg_replace('/\s+/', '', $master);

// Network Interface
$interface               = INETFACE;
$iface_list              = ['INETFACE'];
$iface_title['INETFACE'] = 'External';
$vnstat_bin              = '/usr/bin/vnstat';
$data_dir                = './dumps';
$byte_notation           = null;

define('HTTP_HOST', preg_replace('~^www\.~i', '', $_SERVER['HTTP_HOST']));

$panel = [
    'name'        => 'QuickBox Lite',
    'author'      => 'Everyone that contributes to the open QuickBox project!',
    'robots'      => 'noindex, nofollow',
    'title'       => 'Quickbox Dashboard',
    'description' => 'QuickBox is an open-source seedbox project that is developed and maintained by anyone who so choses to provide time and energy.',
    'active_page' => basename($_SERVER['PHP_SELF']),
];

$time_start = microtime_float();

//NIC flow
$strs = @file("/proc/net/dev");
// only index start from 0 will be encoded as an array
$NetInputSpeed = [0 => null, 1 => null];
$NetOutSpeed   = [0 => null, 1 => null];

for ($i = 2; $i < count($strs); ++$i) {
    preg_match_all("/(?<name>[^\s]+):[\s]{0,}(?<rx_bytes>\d+)\s+(?:\d+\s+){7}(?<tx_bytes>\d+)\s+/", $strs[$i], $info);
    $NetInputSpeed[$i] = $info["rx_bytes"][0]; // Receive data in bytes
  $NetOutSpeed[$i]     = $info["tx_bytes"][0]; // Transmit data in bytes
}

//Real-time refresh ajax calls
if ($_GET["act"] == "rt") {
    $arr = [
        "NetOutSpeed"    => $NetOutSpeed,
        "NetInputSpeed"  => $NetInputSpeed,
        "NetTimeStamp"   => microtime(true),
        "InterfaceIndex" => count($strs),
    ];
    $jarr = json_encode($arr);
    echo htmlspecialchars($_GET["callback"])."(".$jarr.")";
    exit;
}

function GetCoreInformation() {
    $data  = file('/proc/stat');
    $cores = [];
    foreach ($data as $line) {
        if (preg_match('/^cpu[0-9]/', $line)) {
            $info    = explode(' ', $line);
            $cores[] = ['user' => $info[1], 'nice' => $info[2], 'sys' => $info[3], 'idle' => $info[4], 'iowait' => $info[5], 'irq' => $info[6], 'softirq' => $info[7]];
        }
    }

    return $cores;
}
function GetCpuPercentages($stat1, $stat2) {
    if (count($stat1) !== count($stat2)) {
        return;
    }
    $cpus = [];
    for ($i = 0, $l = count($stat1); $i < $l; ++$i) {
        $dif            = [];
        $dif['user']    = $stat2[$i]['user'] - $stat1[$i]['user'];
        $dif['nice']    = $stat2[$i]['nice'] - $stat1[$i]['nice'];
        $dif['sys']     = $stat2[$i]['sys'] - $stat1[$i]['sys'];
        $dif['idle']    = $stat2[$i]['idle'] - $stat1[$i]['idle'];
        $dif['iowait']  = $stat2[$i]['iowait'] - $stat1[$i]['iowait'];
        $dif['irq']     = $stat2[$i]['irq'] - $stat1[$i]['irq'];
        $dif['softirq'] = $stat2[$i]['softirq'] - $stat1[$i]['softirq'];
        $total          = array_sum($dif);
        $cpu            = [];
        foreach ($dif as $x => $y) {
            $cpu[$x] = round($y / $total * 100, 2);
        }
        $cpus['cpu'.$i] = $cpu;
    }

    return $cpus;
}
$stat1    = GetCoreInformation(); sleep(1); $stat2    = GetCoreInformation(); $data    = GetCpuPercentages($stat1, $stat2);
$cpu_show = $data['cpu0']['user']."%us,  ".$data['cpu0']['idle']."%id,  ";

// Information obtained depending on the system CPU
switch (PHP_OS) {
  case "Linux":
    $sysCpuInfo = sys_linux_cpu();
  break;

  default:
    $sysCpuInfo = [];
  break;
}

//linux system detects
function sys_linux_cpu() {
    // CPU
    if (false === ($str = @file("/proc/cpuinfo"))) {
        return false;
    }
    $str = implode("", $str);
    @preg_match_all("/model\s+name\s{0,}\:+\s{0,}([^\:]+)([\r\n]+)/s", $str, $model);
    @preg_match_all("/cpu\s+MHz\s{0,}\:+\s{0,}([\d\.]+)[\r\n]+/", $str, $mhz);
    @preg_match_all("/cache\s+size\s{0,}\:+\s{0,}([\d\.]+\s{0,}[A-Z]+[\r\n]+)/", $str, $cache);
    if (is_array($model[1]) !== false) {
        $res['cpu']['num'] = sizeof($model[1]);

        if ($res['cpu']['num'] == 1) {
            $x1 = '';
        } else {
            $x1 = ' ×'.$res['cpu']['num'];
        }
        $mhz[1][0]             = ' <span style="color:#999;font-weight:600">Frequency:</span> '.$mhz[1][0];
        $cache[1][0]           = ' <br /> <span style="color:#999;font-weight:600">Secondary cache:</span> '.$cache[1][0];
        $res['cpu']['model'][] = '<h4>'.$model[1][0].'</h4>'.$mhz[1][0].$cache[1][0].$x1;
        if (is_array($res['cpu']['model']) !== false) {
            $res['cpu']['model'] = implode("<br />", $res['cpu']['model']);
        }
        if (is_array($res['cpu']['mhz']) !== false) {
            $res['cpu']['mhz'] = implode("<br />", $res['cpu']['mhz']);
        }
        if (is_array($res['cpu']['cache']) !== false) {
            $res['cpu']['cache'] = implode("<br />", $res['cpu']['cache']);
        }
    }

    return $res;
}

function session_start_timeout($timeout = 5, $probability = 100, $cookie_domain = '/') {
    ini_set("session.gc_maxlifetime", strval($timeout));
    ini_set("session.cookie_lifetime", strval($timeout));
    $seperator = strstr(strtoupper(substr(PHP_OS, 0, 3)), "WIN") ? "\\" : "/";
    $path      = ini_get("session.save_path").$seperator."session_".$timeout."sec";
    if (!file_exists($path)) {
        if (!mkdir($path, 600)) {
            trigger_error("Failed to create session save path directory '{$path}'. Check permissions.", E_USER_ERROR);
        }
    }
    ini_set("session.save_path", $path);
    ini_set("session.gc_probability", strval($probability));
    ini_set("session.gc_divisor", "100");
    session_start();
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), $_COOKIE[session_name()], time() + $timeout, $cookie_domain);
    }
}

session_start_timeout(5);
$MSGFILE = session_id();

function processExists($processName, $username) {
    $exists = false;
    exec("ps axo user:20,pid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm,cmd|grep {$username} | grep -iE {$processName} | grep -v grep", $pids);
    if (count($pids) > 0) {
        $exists = true;
    }

    return $exists;
}

function isEnabled($service, $username) {
    if (file_exists('/etc/systemd/system/multi-user.target.wants/'.$service.'@'.$username.'.service') || file_exists('/etc/systemd/system/multi-user.target.wants/'.$service.'.service')) {
        return ' <div class="toggle-wrapper text-center"><div onclick="serviceUpdateHandler(event)" class="toggle-en toggle-light primary" data-service="'.$service.'" data-operation="stop,disable"></div></div>';
    } else {
        return ' <div class="toggle-wrapper text-center"><div onclick="serviceUpdateHandler(event)" class="toggle-dis toggle-light primary" data-service="'.$service.'" data-operation="enable,restart"></div></div>';
    }
}

if (file_exists($_SERVER['DOCUMENT_ROOT'].'/custom/url.override.php')) {
    // BEGIN CUSTOM URL OVERRIDES //
    require($_SERVER['DOCUMENT_ROOT'].'/custom/url.override.php');
// END CUSTOM URL OVERRIDES ////
} else {
    $btsyncURL         = "https://".$_SERVER['HTTP_HOST']."/{$username}.btsync/";
    $dwURL             = "https://".$_SERVER['HTTP_HOST']."/deluge/";
    $delugedlURL       = "https://".$_SERVER['HTTP_HOST']."/{$username}.deluge.downloads";
    $filebrowserURL    = "https://".$_SERVER['HTTP_HOST']."/filebrowser/";
    $filebrowsereeURL  = "https://".$_SERVER['HTTP_HOST']."/filebrowser-ee/";
    $flexgetURL        = "https://".$_SERVER['HTTP_HOST']."/flexget/";
    $floodURL          = "https://".$_SERVER['HTTP_HOST']."/{$username}/flood/";
    $netdataURL        = "https://".$_SERVER['HTTP_HOST']."/netdata/";
    $novncURL          = "https://".$_SERVER['HTTP_HOST']."/vnc/";
    $plexURL           = "https://".$_SERVER['HTTP_HOST']."/web/";
    $qbittorrentURL    = "https://".$_SERVER['HTTP_HOST']."/qbittorrent/";
    $qbittorrentdlURL  = "https://".$_SERVER['HTTP_HOST']."/{$username}.qbittorrent.downloads";
    $rtorrentdlURL     = "https://".$_SERVER['HTTP_HOST']."/{$username}.rtorrent.downloads";
    $rutorrentURL      = "https://".$_SERVER['HTTP_HOST']."/rutorrent/";
    $speedtestURL      = "https://".$_SERVER['HTTP_HOST']."/speedtest/";
    $syncthingURL      = "https://".$_SERVER['HTTP_HOST']."/{$username}.syncthing/";
    $transmissionURL   = "https://".$_SERVER['HTTP_HOST']."/transmission";
    $transmissiondlURL = "https://".$_SERVER['HTTP_HOST']."/{$username}.transmission.downloads";
    $openvpndlURL      = "https://".$_SERVER['HTTP_HOST']."/{$username}/ovpn.zip";
    $zncURL            = "https://".$_SERVER['HTTP_HOST']."/znc/";
}

require($_SERVER['DOCUMENT_ROOT'].'/widgets/plugin_data.php');
require($_SERVER['DOCUMENT_ROOT'].'/widgets/package_data.php');
require($_SERVER['DOCUMENT_ROOT'].'/widgets/theme_select.php');
$base     = 1024;
$location = "/home";
