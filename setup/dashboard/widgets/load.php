<?php

include("../inc/localize.php");

// Information obtained depending on the system CPU
switch (PHP_OS) {
  case "Linux":
    $sysReShow = (false !== ($sysInfo = sys_linux())) ? "show" : "none";
  break;

  case "FreeBSD":
    $sysReShow = (false !== ($sysInfo = sys_freebsd())) ? "show" : "none";
  break;

  default:
  break;
}

//linux system detects
function sys_linux() {
    // LOAD AVG
    if (false === ($str = @file("/proc/loadavg"))) {
        return false;
    }
    $str            = explode(" ", implode("", $str));
    $str            = array_chunk($str, 4);
    $res['loadAvg'] = implode(" ", $str[0]);

    return $res;
}
$load = $sysInfo['loadAvg'];  //System load
echo "{$load}";
