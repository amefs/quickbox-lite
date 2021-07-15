<?php

error_reporting(E_ERROR);
if (function_exists("ini_set")) {
    ini_set("display_errors", "0");
    ini_set("log_errors", "1");
    if (file_exists("/install/.debug")) {
        ini_set("display_errors", "1");
        ini_set("display_startup_errors", "1");
        error_reporting(E_ALL | E_STRICT);
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

/**
 * @param array<mixed,mixed> $arr
 * @return void
 */
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

/**
 * @return string
 */
function getLogin() {
    if ($_SERVER['REMOTE_ADDR'] === '127.0.0.1') {
        $master = file_get_contents($_SERVER['DOCUMENT_ROOT'].'/db/master.txt');
        $master = preg_replace('/\s+/', '', $master);

        return $master;
    }

    return (isset($_SERVER['REMOTE_USER']) && !empty($_SERVER['REMOTE_USER'])) ? strtolower($_SERVER['REMOTE_USER']) : '';
}

/**
 * @return string
 */
function getUser() {
    global $forbidUserSettings;

    return !$forbidUserSettings ? getLogin() : '';
}

/**
 * Unit Conversion, KB by default
 * @param int|float $length
 * @param int $decimals
 * @param int $startwith
 * @return string
 */
function formatsize($length, $decimals = 3, $startwith = 1) {
    if ($length < 1e-5) {
        return '0 B';
    }
    $si_prefix = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    $base      = 1024;
    $index     = floor(log($length, $base));

    return number_format($length / pow($base, $index), $decimals).' '.$si_prefix[$index + 1];
}

/**
 * @param int|float $length
 * @param int $decimals
 * @param int $startwith
 * @return string
 */
function formatspeed($length, $decimals = 3, $startwith = 1) {
    if ($length < 1e-5) {
        return '0 B';
    }
    $si_prefix = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps', 'Ebps', 'Zbps', 'Ybps'];
    $base      = 1024;
    $index     = floor(log($length, $base));

    return number_format($length / pow($base, $index), $decimals).' '.$si_prefix[$index + 1];
}

/**
 * Timing
 * @return float
 */
function microtime_float() {
    $mtime = microtime();
    $mtime = explode(' ', $mtime);

    return floatval($mtime[1]) + floatval($mtime[0]);
}
