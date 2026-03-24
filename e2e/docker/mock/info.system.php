<?php

// SPDX-License-Identifier: GPL-3.0-or-later
// Override for E2E testing: reads from /mock/proc instead of /proc

class SystemInfo {
    /**
     * @return string
     */
    public static function loadavg() {
        return '1.52 1.34 1.21 15';
    }

    /**
     * @return array<string,string|int>
     */
    public static function cpuinfo() {
        $cpuInfoPath = '/mock/proc/cpuinfo';
        $info = @file($cpuInfoPath);
        $res  = [
            'model' => '<h4>Unknown</h4>',
            'count' => '-',
        ];
        if (!is_array($info)) {
            // Fallback to hardcoded mock data
            $res['model'] = '<h4>Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz</h4> <span style="color:#999;font-weight:600">Frequency:</span> 2400.000<br/> <span style="color:#999;font-weight:600">Secondary cache:</span> 35840 KB';
            $res['count'] = 4;
            return $res;
        }

        $info = implode('', $info);
        @preg_match_all("/model\s+name\s{0,}\:+\s{0,}([^\:]+)[\r\n]+/s", $info, $model);
        @preg_match_all("/cpu\s+MHz\s{0,}\:+\s{0,}([\d\.]+)[\r\n]+/", $info, $mhz);
        @preg_match_all("/cache\s+size\s{0,}\:+\s{0,}([\d\.]+\s{0,}[A-Z]+[\r\n]+)/", $info, $cache);
        /* @phpstan-ignore-next-line */
        if (is_array($model[1]) !== false && count($model[1]) > 0) {
            $cpu_count     = count($model[1]);
            $cpu_model     = $model[1][0];
            $cpu_frequency = $mhz[1][0] ?? '2400.000';
            $cpu_cache     = $cache[1][0] ?? '35840 KB';

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
        // Return mock memory data
        $GB = 1024 * 1024; // in KB
        return [
            'MemTotal'       => 16 * $GB,
            'MemFree'        => 2 * $GB,
            'MemUsed'        => 14 * $GB,
            'MemPercent'     => 87.5,
            'Cached'         => 5 * $GB,
            'Buffers'        => 1 * $GB,
            'MemRealUsed'    => 8 * $GB,
            'MemRealFree'    => 8 * $GB,
            'MemRealPercent' => 50.0,
            'CachedPercent'  => 31.25,
            'SwapTotal'      => 4 * $GB,
            'SwapFree'       => 3.5 * $GB,
            'SwapUsed'       => 0.5 * $GB,
            'SwapPercent'    => 12.5,
        ];
    }

    /**
     * @return array<string,array<string,int>>
     */
    public static function netinfo() {
        return [
            'eth0' => [
                'rx_bytes' => 1234567890,
                'tx_bytes' => 987654321,
            ],
        ];
    }

    /**
     * @return array<int,string>
     */
    public static function enuminterface() {
        return ['eth0'];
    }
}
