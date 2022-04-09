<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');

// Valid values for other parameters you can pass to the script.
// Input parameters will always be limited to one of the values listed here.
// If a parameter is not provided or invalid it will revert to the default,
// the first parameter in the list.
$page  = null;
$iface = null;

$page_list = ['s', 'h', 'd', 'm'];

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
    if (!isset($vnstat_bin) || $vnstat_bin === '') {
        if (file_exists("{$data_dir}/vnstat_dump_{$iface}")) {
            $file_data = file_get_contents("{$data_dir}/vnstat_dump_{$iface}");
            assert($file_data !== false);
            $vnstat_data = json_decode($file_data, true);
        }
    } else {
        // FIXME: use mode and limit parameter to reduce data that needs to be parsed
        $fd = popen("{$vnstat_bin} --json -i {$iface}", 'r');
        if (is_resource($fd)) {
            $buffer = '';
            while (!feof($fd)) {
                $buffer .= fgets($fd);
            }
            $vnstat_data = json_decode($buffer, true);
            pclose($fd);
        }
    }

    $day   = [];
    $hour  = [];
    $month = [];
    $top   = [];

    if (!isset($vnstat_data) || !isset($vnstat_data['vnstatversion'])) {
        return;
    }

    $iface_index = array_search($iface, array_column($vnstat_data['interfaces'], 'name'), true);
    if (!$iface_index) {
        $iface_index = 0;
    }

    $iface_data   = $vnstat_data['interfaces'][$iface_index];
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
        $diff_time = max(time() - $ts, 86400); // at most one day
        $rx        = $d['rx'];
        $tx        = $d['tx'];

        $day[$i] = [
            'time'   => $ts,
            'label'  => date(T('datefmt_days'), $ts),
            'rx'     => $rx, // in bytes
            'tx'     => $tx, // int bytes
            'rx_avg' => round($rx / $diff_time) * 8, // in bits/s
            'tx_avg' => round($tx / $diff_time) * 8, // in bits/s
            'act'    => 1,
        ];
    }

    // per-month data
    $month_data = array_reverse($traffic_data['month']);
    for ($i = 0; $i < min(12, count($month_data)); ++$i) {
        $d = $month_data[$i];

        $first_day = mktime(0, 0, 0, $d['date']['month'], 1, $d['date']['year']);
        $last_day  = mktime(0, 0, 0, $d['date']['month'] + 1, 1, $d['date']['year']);
        assert($first_day !== false);
        assert($last_day !== false);
        $full_month_diff = $last_day - $first_day;
        $diff_time       = max(time() - $first_day, $full_month_diff); // at most one month
        $rx              = $d['rx'];
        $tx              = $d['tx'];

        $month[$i] = [
            'time'   => $first_day,
            'label'  => date(T('datefmt_months'), $first_day),
            'rx'     => $rx, // in bytes
            'tx'     => $tx, // int bytes
            'rx_avg' => round($rx / $diff_time) * 8, // in bits/s
            'tx_avg' => round($tx / $diff_time) * 8, // in bits/s
            'act'    => 1,
        ];
    }

    // per-hour data
    $hour_data = array_reverse($traffic_data['hour']);
    for ($i = 0; $i < min(24, count($hour_data)); ++$i) {
        $d  = $hour_data[$i];
        $ts = mktime($d['time']['hour'], 0, 0, $d['date']['month'], $d['date']['day'], $d['date']['year']);
        assert($ts !== false);
        $diff_time = max(time() - $ts, 3600); // at most one hour

        $rx       = $d['rx'];
        $tx       = $d['tx'];
        $hour[$i] = [
            'time'   => $ts,
            'label'  => date(T('datefmt_hours'), $ts),
            'rx'     => $rx, // in bytes
            'tx'     => $tx, // int bytes
            'rx_avg' => round($rx / $diff_time) * 8, // in bits/s
            'tx_avg' => round($tx / $diff_time) * 8, // in bits/s
            'act'    => 1,
        ];
    }

    // top10 days data
    $top10_data = $traffic_data['top'];
    for ($i = 0; $i < min(10, count($top10_data)); ++$i) {
        $d  = $top10_data[$i];
        $ts = mktime(0, 0, 0, $d['date']['month'], $d['date']['day'], $d['date']['year']);
        assert($ts !== false);
        $diff_time = max(time() - $ts, 86400); // at most one day
        $rx        = $d['rx'];
        $tx        = $d['tx'];

        $top[$i] = [
            'time'   => $ts,
            'label'  => date(T('datefmt_top'), $ts),
            'rx'     => $rx, // in bytes
            'tx'     => $tx, // int bytes
            'rx_avg' => round($rx / $diff_time) * 8, // in bits/s
            'tx_avg' => round($tx / $diff_time) * 8, // in bits/s
            'act'    => 1,
        ];
    }

    // summary data from old dumpdb command
    $summary['totalrx']   = $traffic_data['total']['rx']; // in bytes
    $summary['totaltx']   = $traffic_data['total']['tx']; // in bytes
    $summary['interface'] = $iface_data['name'];
    $created              = $iface_data['created'];
    $summary['created']   = mktime(0, 0, 0, $created['date']['month'], $created['date']['day'], $created['date']['year']);
}
