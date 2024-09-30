<?php

// SPDX-License-Identifier: GPL-3.0-or-later

class SystemInfo {
    /**
     * @return string
     */
    public static function loadavg() {
        $loadavg       = shell_exec("uptime | awk -F ': ' '{ print $2; }'");
        $process_count = shell_exec('ps ax | wc -l');
        if (!is_string($loadavg) || !is_string($process_count)) {
            return '';
        }

        return trim($loadavg).' '.trim($process_count);
    }

    /**
     * @return array<string,string|int>
     */
    public static function cpuinfo() {
        $info = @file('/proc/cpuinfo');
        $res  = [
            'model' => '<h4>Unknown</h4>',
            'count' => '-',
        ];
        if (!is_array($info)) {
            return $res;
        }

        $info = implode('', $info);
        @preg_match_all("/model\s+name\s{0,}\:+\s{0,}([^\:]+)[\r\n]+/s", $info, $model);
        @preg_match_all("/cpu\s+MHz\s{0,}\:+\s{0,}([\d\.]+)[\r\n]+/", $info, $mhz);
        @preg_match_all("/cache\s+size\s{0,}\:+\s{0,}([\d\.]+\s{0,}[A-Z]+[\r\n]+)/", $info, $cache);
        /** @phpstan-ignore-next-line */
        if (is_array($model[1]) !== false) {
            $cpu_count     = count($model[1]);
            $cpu_model     = $model[1][0];
            $cpu_frequency = $mhz[1][0];
            $cpu_cache     = $cache[1][0];

            $model_template     = "<h4>{$cpu_model}</h4>";
            $frequency_template = " <span style=\"color:#999;font-weight:600\">Frequency:</span> {$cpu_frequency}";
            $cahce_template     = " <span style=\"color:#999;font-weight:600\">Secondary cache:</span> {$cpu_cache}";

            $res['model']     = $model_template.$frequency_template.'<br/>'.$cahce_template;
            $res['count']     = $cpu_count;
            $res['frequency'] = $cpu_frequency;
            $res['cache']     = $cpu_cache;
        }

        return $res;
    }

    /**
     * @return array<string,float>
     */
    public static function meminfo() {
        $info = @file('/proc/meminfo');
        $res  = [];
        if (!is_array($info)) {
            return $res;
        }
        foreach ($info as $line) {
            $ar_buf          = explode(':', $line);
            $ar_buf          = array_map('trim', $ar_buf);
            $res[$ar_buf[0]] = (float) $ar_buf[1];
        }
        $res['MemUsed']    = $res['MemTotal'] - $res['MemFree'];
        $res['MemPercent'] = $res['MemUsed'] / $res['MemTotal'] * 100;

        $res['MemRealUsed']    = $res['MemUsed'] - $res['Cached'] - $res['Buffers']; // Real memory usage
        $res['MemRealFree']    = $res['MemTotal'] - $res['MemRealUsed']; // Real idle
        $res['MemRealPercent'] = $res['MemRealUsed'] / $res['MemTotal'] * 100; // Real memory usage
        $res['CachedPercent']  = $res['Cached'] / $res['MemTotal'] * 100; // Cached memory usage

        $res['SwapUsed']    = $res['SwapTotal'] - $res['SwapFree'];
        $res['SwapPercent'] = $res['SwapUsed'] / $res['SwapTotal'] * 100;

        return $res;
    }

    /**
     * @return array<string,array<string,int>>
     */
    public static function netinfo() {
        $interfaces = self::enuminterface();
        $res        = [];
        foreach ($interfaces as $interface) {
            $rx_bytes = (int) @file_get_contents("/sys/class/net/{$interface}/statistics/rx_bytes");
            $tx_bytes = (int) @file_get_contents("/sys/class/net/{$interface}/statistics/tx_bytes");

            $res[$interface] = [
                'rx_bytes' => $rx_bytes, // Receive data in bytes
                'tx_bytes' => $tx_bytes, // Transmit data in bytes
            ];
        }

        return $res;
    }

    /**
     * @return array<int,string>
     */
    public static function enuminterface() {
        $interfaces = net_get_interfaces();
        if ($interfaces === false) {
            return [];
        }
        $ret = [];
        foreach ($interfaces as $key => $value) {
            if ($value['up'] === true) {
                $ret[] = $key;
            }
        }

        return $ret;
    }
}
