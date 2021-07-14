<?php

if (function_exists("ini_set")) {
    ini_set("display_errors", "0");
    ini_set("log_errors", "1");
    if (file_exists("/install/.developer.lock")) {
        ini_set("display_errors", "1");
    }
}

if (!isset($_SERVER["REMOTE_USER"])) {
    if (isset($_SERVER["PHP_AUTH_USER"])) {
        $_SERVER["REMOTE_USER"] = $_SERVER["PHP_AUTH_USER"];
    } elseif (isset($_SERVER["REDIRECT_REMOTE_USER"])) {
        $_SERVER["REMOTE_USER"] = $_SERVER["REDIRECT_REMOTE_USER"];
    }
}

if (!isset($profileMask)) {
    $profileMask = 0777;
}
if (!isset($localhosts) || !count($localhosts)) {
    $localhosts = ["127.0.0.1", "localhost"];
}
if (!isset($locale)) {
    $locale = "UTF8";
}

function stripSlashesFromArray(&$arr) {
    if (is_array($arr)) {
        foreach ($arr as $k => $v) {
            if (is_array($v)) {
                stripSlashesFromArray($v);
                $arr[$k] = $v;
            } else {
                $arr[$k] = stripslashes($v);
            }
        }
    }
}

setlocale(LC_CTYPE, $locale, "UTF-8", "en_US.UTF-8", "en_US.UTF8");
setlocale(LC_COLLATE, $locale, "UTF-8", "en_US.UTF-8", "en_US.UTF8");

function getLogin() {
    if ($_SERVER['REMOTE_ADDR'] === '127.0.0.1') {
        $master = file_get_contents($_SERVER['DOCUMENT_ROOT'].'/db/master.txt');
        $master = preg_replace('/\s+/', '', $master);

        return $master;
    }

    return (isset($_SERVER['REMOTE_USER']) && !empty($_SERVER['REMOTE_USER'])) ? strtolower($_SERVER['REMOTE_USER']) : '';
}

function getUser() {
    global $forbidUserSettings;

    return !$forbidUserSettings ? getLogin() : '';
}

@ini_set('precision', '16');
@define('PHP_INT_MIN', ~PHP_INT_MAX);
@define('XMLRPC_MAX_I4', 2147483647);
@define('XMLRPC_MIN_I4', ~XMLRPC_MAX_I4);
@define('XMLRPC_MIN_I8', -9.999999999999999E+15);
@define('XMLRPC_MAX_I8', 9.999999999999999E+15);

function iclamp($val, $min = 0, $max = XMLRPC_MAX_I8) {
    $val = floatval($val);
    if ($val < $min) {
        $val = $min;
    }
    if ($val > $max) {
        $val = $max;
    }

    return ((PHP_INT_SIZE > 4) || (($val >= PHP_INT_MIN) && ($val <= PHP_INT_MAX))) ? intval($val) : $val;
}

//Unit Conversion, KB by default
function formatsize($length, $decimals = 3, $startwith = 1) {
    if ($length < 1e-5) {
        return '0 B';
    }
    $si_prefix = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    $base      = 1024;
    $index     = floor(log($length, $base));

    return number_format($length / pow($base, $index), $decimals).' '.$si_prefix[$index + 1];
}

function formatspeed($length, $decimals = 3, $startwith = 1) {
    if ($length < 1e-5) {
        return '0 B';
    }
    $si_prefix = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps', 'Ebps', 'Zbps', 'Ybps'];
    $base      = 1024;
    $index     = floor(log($length, $base));

    return number_format($length / pow($base, $index), $decimals).' '.$si_prefix[$index + 1];
}

// Timing
function microtime_float() {
    $mtime = microtime();
    $mtime = explode(' ', $mtime);

    return floatval($mtime[1]) + floatval($mtime[0]);
}
