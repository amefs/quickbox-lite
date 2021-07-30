<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');

// Valid values for other parameters you can pass to the script.
// Input parameters will always be limited to one of the values listed here.
// If a parameter is not provided or invalid it will revert to the default,
// the first parameter in the list.

    $page_list = ['s', 'h', 'd', 'm'];

    $page_title['s'] = T('summary');
    $page_title['h'] = T('hours');
    $page_title['d'] = T('days');
    $page_title['m'] = T('months');

    /**
     * @return void
     */
    function validate_input() {
        global $page,  $page_list;
        global $iface, $iface_list;
        //
        // get interface data
        //
        $page  = $_GET['page'] ?? '';
        $iface = $_GET['if'] ?? '';

        if (!in_array($page, $page_list, true)) {
            $page = $page_list[0];
        }

        if (!in_array($iface, $iface_list, true)) {
            $iface = $iface_list[0];
        }
    }

    /**
     * @param bool $use_label
     *
     * @return void
     */
    function get_vnstat_data($use_label = true) {
        global $iface, $vnstat_bin, $data_dir;
        global $hour,$day,$month,$top,$summary;
        $vnstat_data = [];
        if (!isset($vnstat_bin) || $vnstat_bin == '') {
            if (file_exists("{$data_dir}/vnstat_dump_{$iface}")) {
                $vnstat_data = file("{$data_dir}/vnstat_dump_{$iface}");
                assert($vnstat_data !== false);
            }
        } else {
            $fd = popen("{$vnstat_bin} --dumpdb -i {$iface}", 'r');
            if (is_resource($fd)) {
                $buffer = '';
                while (!feof($fd)) {
                    $buffer .= fgets($fd);
                }
                $vnstat_data = explode("\n", $buffer);
                pclose($fd);
            }
        }

        $day   = [];
        $hour  = [];
        $month = [];
        $top   = [];

        if (isset($vnstat_data[0]) && strpos($vnstat_data[0], 'Error') !== false) {
            return;
        }

        //
        // extract data
        //
        foreach ($vnstat_data as $line) {
            $arr  = explode(';', trim($line));
            $type = $arr[0];
            $d    = array_map('intval', $arr);
            if ($type == 'd') {
                $day[$d[1]]['time'] = $d[2];
                $day[$d[1]]['rx']   = $d[3] * 1024 + $d[5];
                $day[$d[1]]['tx']   = $d[4] * 1024 + $d[6];
                $day[$d[1]]['act']  = $d[7];
                if ($d[2] != 0 && $use_label) {
                    $day[$d[1]]['label']     = strftime(T('datefmt_days'), $d[2]);
                    $day[$d[1]]['img_label'] = strftime(T('datefmt_days_img'), $d[2]);
                } elseif ($use_label) {
                    $day[$d[1]]['label']     = '';
                    $day[$d[1]]['img_label'] = '';
                }

                $now     = strtotime('now');
                $zerostr = strftime('%d %B %Y', $now);
                assert($zerostr !== false);
                $diff_time            = $now - strtotime($zerostr);
                $day[$d[1]]['rx_avg'] = round($day[$d[1]]['rx'] / $diff_time) * 8;
                $day[$d[1]]['tx_avg'] = round($day[$d[1]]['tx'] / $diff_time) * 8;
            } elseif ($type == 'm') {
                $month[$d[1]]['time'] = $d[2];
                $month[$d[1]]['rx']   = $d[3] * 1024 + $d[5];
                $month[$d[1]]['tx']   = $d[4] * 1024 + $d[6];
                $month[$d[1]]['act']  = $d[7];
                if ($d[2] != 0 && $use_label) {
                    $month[$d[1]]['label']     = strftime(T('datefmt_months'), $d[2]);
                    $month[$d[1]]['img_label'] = strftime(T('datefmt_months_img'), $d[2]);
                } elseif ($use_label) {
                    $month[$d[1]]['label']     = '';
                    $month[$d[1]]['img_label'] = '';
                }
                $now          = strtotime('now');
                $lastmomthstr = strftime('1 %B %Y', $now);
                assert($lastmomthstr !== false);
                $diff_time              = $now - strtotime($lastmomthstr);
                $month[$d[1]]['rx_avg'] = round($month[$d[1]]['rx'] / $diff_time) * 8;
                $month[$d[1]]['tx_avg'] = round($month[$d[1]]['tx'] / $diff_time) * 8;
            } elseif ($type == 'h') {
                $hour[$d[1]]['time'] = $d[2];
                $hour[$d[1]]['rx']   = $d[3];
                $hour[$d[1]]['tx']   = $d[4];
                $hour[$d[1]]['act']  = 1;
                if ($d[2] != 0 && $use_label) {
                    $st                       = $d[2] - ($d[2] % 3600);
                    $et                       = $st + 3600;
                    $hour[$d[1]]['label']     = strftime(T('datefmt_hours'), $st).' - '.strftime(T('datefmt_hours'), $et);
                    $hour[$d[1]]['img_label'] = strftime(T('datefmt_hours_img'), $d[2]);
                } elseif ($use_label) {
                    $hour[$d[1]]['label']     = '';
                    $hour[$d[1]]['img_label'] = '';
                }
                $now         = intval($d[2]);
                $lasthourstr = strftime('%d %B %Y %H:00:00', $now);
                assert($lasthourstr !== false);
                $diff_time = $now - strtotime($lasthourstr);
                if ($diff_time === 0) {
                    $diff_time = INF;
                }
                $hour[$d[1]]['rx_avg'] = round($hour[$d[1]]['rx'] / $diff_time) * 8;
                $hour[$d[1]]['tx_avg'] = round($hour[$d[1]]['tx'] / $diff_time) * 8;
            } elseif ($type == 't') {
                $top[$d[1]]['time'] = $d[2];
                $top[$d[1]]['rx']   = $d[3] * 1024 + $d[5];
                $top[$d[1]]['tx']   = $d[4] * 1024 + $d[6];
                $top[$d[1]]['act']  = $d[7];
                if ($use_label) {
                    $top[$d[1]]['label']     = strftime(T('datefmt_top'), $d[2]);
                    $top[$d[1]]['img_label'] = '';
                }
                $top[$d[1]]['rx_avg'] = round($top[$d[1]]['rx'] / 86400) * 8;
                $top[$d[1]]['tx_avg'] = round($top[$d[1]]['tx'] / 86400) * 8;
            } else {
                $summary[$type] = $arr[1] ?? '';
            }
        }

        rsort($day);
        rsort($month);
        rsort($hour);
    }
