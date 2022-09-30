<?php

// SPDX-License-Identifier: GPL-3.0-or-later

error_reporting(\E_ERROR);
if (function_exists('ini_set')) {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
    if (file_exists('/install/.debug.lock') || (isset($_GET['debug']) && $_GET['debug'] === '1')) {
        ini_set('display_errors', '1');
        ini_set('display_startup_errors', '1');
        error_reporting(\E_ALL | \E_STRICT);
    }
}

if (!isset($_SERVER['REMOTE_USER'])) {
    if (isset($_SERVER['PHP_AUTH_USER'])) {
        $_SERVER['REMOTE_USER'] = $_SERVER['PHP_AUTH_USER'];
    } elseif (isset($_SERVER['REDIRECT_REMOTE_USER'])) {
        $_SERVER['REMOTE_USER'] = $_SERVER['REDIRECT_REMOTE_USER'];
    }
}

/**
 * @param mixed $arr
 *
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

/**
 * @return string
 */
function getMaster() {
    $master = file_get_contents($_SERVER['DOCUMENT_ROOT'].'/db/master.txt');
    assert($master !== false);
    $master = preg_replace('/\s+/', '', $master);
    assert($master !== null);

    return $master;
}

/**
 * @return string
 */
function getUser() {
    $remote_addr = $_SERVER['REMOTE_ADDR'];
    if ($remote_addr === '127.0.0.1' || $remote_addr === '::1' || $remote_addr === '::ffff:127.0.0.1') {
        return getMaster();
    }
    foreach (['REMOTE_USER', 'PHP_AUTH_USER', 'REDIRECT_REMOTE_USER'] as $key) {
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
            return $_SERVER[$key];
        }
    }

    return '';
}

/**
 * @param int    $timeout
 * @param int    $probability
 * @param string $cookie_domain
 *
 * @return void
 */
function session_start_timeout($timeout = 5, $probability = 100, $cookie_domain = '/') {
    ini_set('session.gc_maxlifetime', (string) $timeout);
    ini_set('session.cookie_lifetime', (string) $timeout);
    $save_path = ini_get('session.save_path');
    if ($save_path === '') {
        $save_path = $_SERVER['DOCUMENT_ROOT'].'/db';
    }
    $path = implode(\DIRECTORY_SEPARATOR, [$save_path, "session_{$timeout}sec"]);
    if (!file_exists($path)) {
        if (!mkdir($path, 0700)) {
            trigger_error("Failed to create session save path directory '{$path}'. Check permissions.", \E_USER_ERROR);
        }
    }
    ini_set('session.save_path', $path);
    ini_set('session.gc_probability', (string) $probability);
    ini_set('session.gc_divisor', '100');
    session_start();
    $session_name = session_name();
    assert($session_name !== false);
    if (isset($_COOKIE[$session_name])) {
        setcookie($session_name, $_COOKIE[$session_name], time() + $timeout, $cookie_domain);
    }
}

/**
 * Unit Conversion, KB by default.
 *
 * @param int|float $length
 * @param int       $decimals
 * @param int       $startwith
 *
 * @return string
 */
function formatsize($length, $decimals = 3, $startwith = 0) {
    if ($length < 1e-5) {
        return '0 B';
    }
    $si_prefix = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    $base      = 1024;
    $index     = floor(log($length, $base));

    return number_format($length / $base ** $index, $decimals).' '.$si_prefix[$index + $startwith];
}

/**
 * @param int|float $length
 * @param int       $decimals
 * @param int       $startwith
 *
 * @return string
 */
function formatspeed($length, $decimals = 3, $startwith = 0) {
    if ($length < 1e-5) {
        return '0 B';
    }
    $si_prefix = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps', 'Ebps', 'Zbps', 'Ybps'];
    $base      = 1024;
    $index     = floor(log($length, $base));

    return number_format($length / $base ** $index, $decimals).' '.$si_prefix[$index + $startwith];
}

/**
 * Timing.
 *
 * @return float
 */
function microtime_float() {
    $mtime = microtime();
    $mtime = explode(' ', $mtime);

    return (float) $mtime[1] + (float) $mtime[0];
}

/**
 * @return array<int,mixed>
 */
function GetCoreInformation() {
    $data = file('/proc/stat');
    assert($data !== false);
    $cores = [];
    foreach ($data as $line) {
        if (preg_match('/^cpu[0-9]/', $line) === 1) {
            $info    = explode(' ', $line);
            $cores[] = [
                'user'    => $info[1],
                'nice'    => $info[2],
                'sys'     => $info[3],
                'idle'    => $info[4],
                'iowait'  => $info[5],
                'irq'     => $info[6],
                'softirq' => $info[7],
            ];
        }
    }

    return $cores;
}

/**
 * @param array<int,mixed> $stat1
 * @param array<int,mixed> $stat2
 *
 * @return array<string,mixed>
 */
function GetCpuPercentages($stat1, $stat2) {
    if (count($stat1) !== count($stat2)) {
        return [];
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

/**
 * @param string $processName
 * @param string $username
 *
 * @return bool
 */
function processExists($processName, $username) {
    $exists = false;
    exec("ps axo user:20,pid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm,cmd | grep {$username} | grep -iE {$processName} | grep -v grep", $pids);
    if (count($pids) > 0) {
        $exists = true;
    }

    return $exists;
}
