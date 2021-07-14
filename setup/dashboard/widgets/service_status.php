<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/package_info.php');
assert(isset($packageList));

function processExists($processName, $username) {
    $exists = false;
    exec("ps axo user:20,pid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm,cmd|grep {$username} | grep -iE {$processName} | grep -v grep", $pids);
    if (count($pids) > 0) {
        $exists = true;
    }

    return $exists;
}
$service = $_GET["service"];

$packageWithService = array_filter($packageList, function ($package) {
    return isset($package["services"]);
});

$status = false;

foreach ($packageWithService as $package) {
    $matched = false;
    foreach ($package["services"] as $k => $info) {
        if ($k === $service) {
            $process  = $info["process"];
            $username = $info["username"];
            $status   = processExists($process, $username);
            $matched  = true;
            break;
        }
    }
    if ($matched) {
        break;
    }
}

if ($status) {
    $val = '<span class="badge badge-service-running-dot"></span><span class="badge badge-service-running-pulse"></span>';
} else {
    $val = '<span class="badge badge-service-disabled-dot"></span><span class="badge badge-service-disabled-pulse"></span>';
}

echo "{$val}";
