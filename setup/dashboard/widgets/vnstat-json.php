<?php

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

        if (!in_array($page, $page_list)) {
            $page = $page_list[0];
        }

        if (!in_array($iface, $iface_list)) {
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
                $file_data = file_get_contents("{$data_dir}/vnstat_dump_{$iface}");
                assert($file_data !== false);
                $vnstat_data = json_decode($file_data, true);
            }
        } else {
            // FIXME: use mode and limit parameter to reduce data that needs to be parsed
            $fd = popen("{$vnstat_bin} --json -i {$iface}", "r");
            if (is_resource($fd)) {
                $buffer = '';
                while (!feof($fd)) {
                    $buffer .= fgets($fd);
                }
                pclose($fd);
                $vnstat_data = json_decode($buffer, true);
            }
        }

        $day   = [];
        $hour  = [];
        $month = [];
        $top   = [];

        if (!isset($vnstat_data) || !isset($vnstat_data['vnstatversion'])) {
            return;
        }

        $iface_data   = $vnstat_data['interfaces'][0];
        $traffic_data = $iface_data['traffic'];

        // data are grouped for hour, day, month, ... and a data entry looks like this:
        // [0] => Array
        //   (
        //     [id] => 48032
        //     [date] => Array
        //       (
        //         [year] => 2020
        //         [month] => 8
        //         [day] => 23
        //       )
        //     [time] => Array
        //       (
        //         [hour] => 16
        //         [minute] => 0
        //       )
        //     [rx] => 2538730
        //     [tx] => 2175640
        //   )

        // per-day data
        // FIXME: instead of using array_reverse, sorting by date/time keys would be more reliable
        $day_data = array_reverse($traffic_data['day']);
        for ($i = 0; $i < min(30, count($day_data)); ++$i) {
            $d  = $day_data[$i];
            $ts = mktime(0, 0, 0, $d['date']['month'], $d['date']['day'], $d['date']['year']);
            assert($ts !== false);

            $day[$i]['time'] = $ts;
            $day[$i]['rx']   = $d['rx'] / 1024;
            $day[$i]['tx']   = $d['tx'] / 1024;
            $day[$i]['act']  = 1;

            if ($use_label) {
                $day[$i]['label']     = strftime(T('datefmt_days'), $ts);
                $day[$i]['img_label'] = strftime(T('datefmt_days_img'), $ts);
            }

            $now     = strtotime("now");
            $zerostr = strftime("%d %B %Y", $now);
            assert($zerostr !== false);
            $diff_time         = $now - strtotime($zerostr);
            $day[$i]['rx_avg'] = round($day[$i]['rx'] / $diff_time) * 8;
            $day[$i]['tx_avg'] = round($day[$i]['tx'] / $diff_time) * 8;
        }

        // per-month data
        $month_data = array_reverse($traffic_data['month']);
        for ($i = 0; $i < min(12, count($month_data)); ++$i) {
            $d  = $month_data[$i];
            $ts = mktime(0, 0, 0, $d['date']['month'] + 1, 0, $d['date']['year']);
            assert($ts !== false);

            $month[$i]['time'] = $ts;
            $month[$i]['rx']   = $d['rx'] / 1024;
            $month[$i]['tx']   = $d['tx'] / 1024;
            $month[$i]['act']  = 1;

            if ($use_label) {
                $month[$i]['label']     = strftime(T('datefmt_months'), $ts);
                $month[$i]['img_label'] = strftime(T('datefmt_months_img'), $ts);
            }

            $now          = strtotime("now");
            $lastmomthstr = strftime("1 %B %Y", $now);
            assert($lastmomthstr !== false);
            $diff_time = $now - strtotime($lastmomthstr);

            $month[$i]['rx_avg'] = round($month[$i]['rx'] / $diff_time) * 8;
            $month[$i]['tx_avg'] = round($month[$i]['tx'] / $diff_time) * 8;
        }

        // per-hour data
        $hour_data = array_reverse($traffic_data['hour']);
        for ($i = 0; $i < min(24, count($hour_data)); ++$i) {
            $d  = $hour_data[$i];
            $ts = mktime($d['time']['hour'], $d['time']['minute'], 0, $d['date']['month'], $d['date']['day'], $d['date']['year']);
            assert($ts !== false);

            $hour[$i]['time'] = $ts;
            $hour[$i]['rx']   = $d['rx'] / 1024;
            $hour[$i]['tx']   = $d['tx'] / 1024;
            $hour[$i]['act']  = 1;

            if ($use_label) {
                $hour[$i]['label']     = strftime(T('datefmt_hours'), $ts);
                $hour[$i]['img_label'] = strftime(T('datefmt_hours_img'), $ts);
            }

            $now         = strtotime("now");
            $lasthourstr = strftime("%d %B %Y %H:00:00", $now);
            assert($lasthourstr !== false);
            $diff_time = $now - strtotime($lasthourstr);
            if ($diff_time <= 300) {
                $diff_time = 3600;
            }
            $hour[$i]['rx_avg'] = round($hour[$i]['rx'] / $diff_time) * 8;
            $hour[$i]['tx_avg'] = round($hour[$i]['tx'] / $diff_time) * 8;
        }

        // top10 days data
        $top10_data = $traffic_data['top'];
        for ($i = 0; $i < min(10, count($top10_data)); ++$i) {
            $d  = $top10_data[$i];
            $ts = mktime(0, 0, 0, $d['date']['month'], $d['date']['day'], $d['date']['year']);
            assert($ts !== false);

            $top[$i]['time'] = $ts;
            $top[$i]['rx']   = $d['rx'] / 1024;
            $top[$i]['tx']   = $d['tx'] / 1024;
            $top[$i]['act']  = 1;

            if ($use_label) {
                $top[$i]['label']     = strftime(T('datefmt_top'), $ts);
                $top[$i]['img_label'] = '';
            }

            $top[$i]['rx_avg'] = round($top[$i]['rx'] / 86400) * 8;
            $top[$i]['tx_avg'] = round($top[$i]['tx'] / 86400) * 8;
        }

        // summary data from old dumpdb command
        // all time total received/transmitted MB
        $summary['totalrx'] = $traffic_data['total']['rx'] / 1024 / 1024;
        $summary['totaltx'] = $traffic_data['total']['tx'] / 1024 / 1024;
        // FIXME: used to be "total rx kB counter" from dumpdb, no idea how to get those
        $summary['totalrxk']  = 0;
        $summary['totaltxk']  = 0;
        $summary['interface'] = $iface_data['name'];
        $created              = $iface_data['created'];
        $summary['created']   = mktime(0, 0, 0, $created['date']['month'], $created['date']['day'], $created['date']['year']);
    }
