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

/**
 * @param array<mixed,mixed> $arr
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
function getLogin() {
    if ($_SERVER['REMOTE_ADDR'] === '127.0.0.1') {
        return getMaster();
    }
    if (isset($_SERVER['REMOTE_USER']) && !empty($_SERVER['REMOTE_USER'])) {
        return $_SERVER['REMOTE_USER'];
    }

    return '';
}

/**
 * @return string
 */
function getUser() {
    global $forbidUserSettings;

    return !$forbidUserSettings ? getLogin() : '';
}

/**
 * @param int    $timeout
 * @param int    $probability
 * @param string $cookie_domain
 *
 * @return void
 */
function session_start_timeout($timeout = 5, $probability = 100, $cookie_domain = '/') {
    ini_set("session.gc_maxlifetime", strval($timeout));
    ini_set("session.cookie_lifetime", strval($timeout));
    $path = join(DIRECTORY_SEPARATOR, [ini_get("session.save_path"), "session_{$timeout}sec"]);
    if (!file_exists($path)) {
        if (!mkdir($path, 600)) {
            trigger_error("Failed to create session save path directory '{$path}'. Check permissions.", E_USER_ERROR);
        }
    }
    ini_set("session.save_path", $path);
    ini_set("session.gc_probability", strval($probability));
    ini_set("session.gc_divisor", "100");
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
 * @param int       $decimals
 * @param int       $startwith
 *
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
 * Timing.
 *
 * @return float
 */
function microtime_float() {
    $mtime = microtime();
    $mtime = explode(' ', $mtime);

    return floatval($mtime[1]) + floatval($mtime[0]);
}

/**
 * @return array<int,mixed>
 */
function GetCoreInformation() {
    $data = file('/proc/stat');
    assert($data !== false);
    $cores = [];
    foreach ($data as $line) {
        if (preg_match('/^cpu[0-9]/', $line)) {
            $info    = explode(' ', $line);
            $cores[] = ['user' => $info[1], 'nice' => $info[2], 'sys' => $info[3], 'idle' => $info[4], 'iowait' => $info[5], 'irq' => $info[6], 'softirq' => $info[7]];
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
 * linux system detects.
 *
 * @return bool|array<string,mixed>
 */
function sys_linux_cpu() {
    // CPU
    if (false === ($str = @file("/proc/cpuinfo"))) {
        return false;
    }
    $str = implode("", $str);
    @preg_match_all("/model\s+name\s{0,}\:+\s{0,}([^\:]+)[\r\n]+/s", $str, $model);
    @preg_match_all("/cpu\s+MHz\s{0,}\:+\s{0,}([\d\.]+)[\r\n]+/", $str, $mhz);
    @preg_match_all("/cache\s+size\s{0,}\:+\s{0,}([\d\.]+\s{0,}[A-Z]+[\r\n]+)/", $str, $cache);
    $res = [];
    if (is_array($model[1]) !== false) {
        $cpu_count     = count($model[1]);
        $cpu_model     = $model[1][0];
        $cpu_frequency = $mhz[1][0];
        $cpu_cache     = $cache[1][0];

        $model_template      = "<h4>{$cpu_model}</h4>";
        $frequency_template  = " <span style=\"color:#999;font-weight:600\">Frequency:</span> {$cpu_frequency}";
        $cahce_template      = " <span style=\"color:#999;font-weight:600\">Secondary cache:</span> {$cpu_cache}";
        $count_template      = $cpu_count > 1 ? " x{$cpu_count}" : "";
        $res['cpu']['model'] = $model_template.$frequency_template."<br/>".$cahce_template.$count_template;
        $res['cpu']['num']   = $cpu_count;
    }

    return $res;
}

/**
 * @param string $processName
 * @param string $username
 *
 * @return bool
 */
function processExists($processName, $username) {
    $exists = false;
    exec("ps axo user:20,pid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm,cmd|grep {$username} | grep -iE {$processName} | grep -v grep", $pids);
    if (count($pids) > 0) {
        $exists = true;
    }

    return $exists;
}

/**
 * @param string $service
 * @param string $username
 *
 * @return string
 */
function isEnabled($service, $username) {
    if (file_exists('/etc/systemd/system/multi-user.target.wants/'.$service.'@'.$username.'.service') || file_exists('/etc/systemd/system/multi-user.target.wants/'.$service.'.service')) {
        return ' <div class="toggle-wrapper text-center"><div onclick="serviceUpdateHandler(event)" class="toggle-en toggle-light primary" data-service="'.$service.'" data-operation="stop,disable"></div></div>';
    } else {
        return ' <div class="toggle-wrapper text-center"><div onclick="serviceUpdateHandler(event)" class="toggle-dis toggle-light primary" data-service="'.$service.'" data-operation="enable,restart"></div></div>';
    }
}
