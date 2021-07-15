<?php

require($_SERVER["DOCUMENT_ROOT"]."/inc/localize.php");

// Information obtained depending on the system CPU
switch (PHP_OS) {
    case "Linux":
        $sysLoadInfo = sys_linux_load();
    break;

    default:
        $sysLoadInfo = [];
    break;
}

/**
 * linux system detects
 * @return bool|array<string,mixed>
 */
function sys_linux_load() {
    // LOAD AVG
    if (false === ($str = @file("/proc/loadavg"))) {
        return false;
    }
    $str            = explode(" ", implode("", $str));
    $str            = array_chunk($str, 4);
    $res['loadAvg'] = implode(" ", $str[0]);

    return $res;
}
$load = $sysLoadInfo['loadAvg'];  //System load
echo "{$load}";
