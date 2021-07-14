<?php

// Network Interface
$iface_list              = ['INETFACE'];
$iface_title['INETFACE'] = 'External';
$vnstat_bin              = '/usr/bin/vnstat';
$data_dir                = './dumps';
$byte_notation           = null;

$page  = null;
$day   = null;
$hour  = null;
$month = null;

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
require($_SERVER['DOCUMENT_ROOT'].'/widgets/vnstat.php');

validate_input();

function write_summary_s() {
    global $summary, $day, $hour, $month;

    $trx     = $summary['totalrx'] * 1024 + $summary['totalrxk'];
    $ttx     = $summary['totaltx'] * 1024 + $summary['totaltxk'];
    $ttime   = strtotime("now") - $summary['created'];
    $trx_avg = round($trx / $ttime) * 8;
    $ttx_avg = round($ttx / $ttime) * 8;

    //
    // let's build array for write_data_table
    //

    $sum = [];

    if (count($day) > 0 && count($hour) > 0 && count($month) > 0) {
        $sum[0]['act']    = 1;
        $sum[0]['label']  = T('This hour');
        $sum[0]['rx']     = $hour[0]['rx'];
        $sum[0]['tx']     = $hour[0]['tx'];
        $sum[0]['rx_avg'] = $hour[0]['rx_avg'];
        $sum[0]['tx_avg'] = $hour[0]['tx_avg'];

        $sum[1]['act']    = 1;
        $sum[1]['label']  = T('This day');
        $sum[1]['rx']     = $day[0]['rx'];
        $sum[1]['tx']     = $day[0]['tx'];
        $sum[1]['rx_avg'] = $day[0]['rx_avg'];
        $sum[1]['tx_avg'] = $day[0]['tx_avg'];

        $sum[2]['act']    = 1;
        $sum[2]['label']  = T('This month');
        $sum[2]['rx']     = $month[0]['rx'];
        $sum[2]['tx']     = $month[0]['tx'];
        $sum[2]['rx_avg'] = $month[0]['rx_avg'];
        $sum[2]['tx_avg'] = $month[0]['tx_avg'];

        $sum[3]['act']    = 1;
        $sum[3]['label']  = T('All time');
        $sum[3]['rx']     = $trx;
        $sum[3]['tx']     = $ttx;
        $sum[3]['rx_avg'] = $trx_avg;
        $sum[3]['tx_avg'] = $ttx_avg;
    }

    write_data_table_s(T('Summary'), $sum);
}

function write_summary_t() {
    global $top, $summary, $hour, $day, $month;

    $trx     = $summary['totalrx'] * 1024 + $summary['totalrxk'];
    $ttx     = $summary['totaltx'] * 1024 + $summary['totaltxk'];
    $ttime   = strtotime("now") - $summary['created'];
    $trx_avg = round($trx / $ttime) * 8;
    $ttx_avg = round($ttx / $ttime) * 8;
    //
    // let's build array for write_data_table
    //

    $sum = [];

    if (count($day) > 0 && count($hour) > 0 && count($month) > 0) {
        $sum[0]['act']    = 1;
        $sum[0]['label']  = T('This hour');
        $sum[0]['rx']     = $hour[0]['rx'];
        $sum[0]['tx']     = $hour[0]['tx'];
        $sum[0]['rx_avg'] = $hour[0]['rx_avg'];
        $sum[0]['tx_avg'] = $hour[0]['tx_avg'];

        $sum[1]['act']    = 1;
        $sum[1]['label']  = T('This day');
        $sum[1]['rx']     = $day[0]['rx'];
        $sum[1]['tx']     = $day[0]['tx'];
        $sum[1]['rx_avg'] = $day[0]['rx_avg'];
        $sum[1]['tx_avg'] = $day[0]['tx_avg'];

        $sum[2]['act']    = 1;
        $sum[2]['label']  = T('This month');
        $sum[2]['rx']     = $month[0]['rx'];
        $sum[2]['tx']     = $month[0]['tx'];
        $sum[2]['rx_avg'] = $month[0]['rx_avg'];
        $sum[2]['tx_avg'] = $month[0]['tx_avg'];

        $sum[3]['act']    = 1;
        $sum[3]['label']  = T('All time');
        $sum[3]['rx']     = $trx;
        $sum[3]['tx']     = $ttx;
        $sum[3]['rx_avg'] = $trx_avg;
        $sum[3]['tx_avg'] = $ttx_avg;
    }

    write_data_table_t(T('Top 10 days'), $top);
}

function write_data_table_s($caption, $tab) {
    echo "<table class=\"table table-hover table-default nomargin\" width=\"100%\" cellspacing=\"0\">";
    echo "<thead>";
    echo "<tr>";
    echo "<th class=\"text-right\" style=\"width:20%;\">{$caption}</th>";
    echo "<th class=\"text-right\" style=\"width:15%;\">".T('Out')."</th>";
    echo "<th class=\"text-left\" style=\"width:15%;\">".T('In')."</th>";
    echo "<th class=\"text-right\" style=\"width:15%;\">".T('Out_AVG')."</th>";
    echo "<th class=\"text-left\" style=\"width:15%;\">".T('In_AVG')."</th>";
    echo "<th class=\"text-left\" style=\"width:18%;\">".T('Total')."</th>";
    echo "</tr>";
    echo "</thead>";
    echo "<tbody>\n";

    for ($i = 0; $i < count($tab); ++$i) {
        if ($tab[$i]['act'] == 1) {
            $t      = $tab[$i]['label'];
            $rx     = formatsize($tab[$i]['rx'], 2);
            $tx     = formatsize($tab[$i]['tx'], 2);
            $rx_avg = formatspeed($tab[$i]['rx_avg'], 2);
            $tx_avg = formatspeed($tab[$i]['tx_avg'], 2);
            $total  = formatsize($tab[$i]['rx'] + $tab[$i]['tx'], 2);
            $id     = ($i & 1) ? 'odd' : 'even';
            echo "<tr>";
            echo "<td class=\"label_{$id}\" style=\"font-size:12px;text-align:right\"><b>{$t}</b></td>";
            echo "<td class=\"numeric_{$id} text-success\" style=\"font-size:12px;text-align:right\">{$tx}</td>";
            echo "<td class=\"numeric_{$id} text-primary\" style=\"font-size:12px;text-align:left\">{$rx}</td>";
            echo "<td class=\"numeric_{$id} text-success\" style=\"font-size:12px;text-align:right\">{$tx_avg}</td>";
            echo "<td class=\"numeric_{$id} text-primary\" style=\"font-size:12px;text-align:left\">{$rx_avg}</td>";
            echo "<td class=\"numeric_{$id}\" style=\"font-size:12px;text-align:left\">{$total}</td>";
            echo "</tr>\n";
        }
    }

    echo "</tbody>";
    echo "</table>";
}

function write_data_table_t($caption, $tab) {
    echo "<table class=\"table table-hover table-default nomargin\" width=\"100%\" cellspacing=\"0\">";
    echo "<thead>";
    echo "<tr>";
    echo "<th class=\"text-right\" style=\"width:20%;\">{$caption}</th>";
    echo "<th class=\"text-right\" style=\"width:15%;\">".T('Out')."</th>";
    echo "<th class=\"text-left\" style=\"width:15%;\">".T('In')."</th>";
    echo "<th class=\"text-right\" style=\"width:15%;\">".T('Out_AVG')."</th>";
    echo "<th class=\"text-left\" style=\"width:15%;\">".T('In_AVG')."</th>";
    echo "<th class=\"text-left\" style=\"width:18%;\">".T('Total')."</th>";
    echo "</tr>";
    echo "</thead>";

    echo "<tbody>\n";

    for ($i = 0; $i < count($tab); ++$i) {
        if ($tab[$i]['act'] == 1) {
            $t      = $tab[$i]['label'];
            $rx     = formatsize($tab[$i]['rx'], 2);
            $tx     = formatsize($tab[$i]['tx'], 2);
            $rx_avg = formatspeed($tab[$i]['rx_avg'], 2);
            $tx_avg = formatspeed($tab[$i]['tx_avg'], 2);
            $total  = formatsize($tab[$i]['rx'] + $tab[$i]['tx'], 2);
            $id     = ($i & 1) ? 'odd' : 'even';
            echo "<tr>";
            echo "<td class=\"label_{$id}\" style=\"font-size:12px;;text-align:right\"><b>{$t}</b></td>";
            echo "<td class=\"numeric_{$id} text-success\" style=\"font-size:12px;text-align:right\">{$tx}</td>";
            echo "<td class=\"numeric_{$id} text-primary\" style=\"font-size:12px;text-align:left\">{$rx}</td>";
            echo "<td class=\"numeric_{$id} text-success\" style=\"font-size:12px;text-align:right\">{$tx_avg}</td>";
            echo "<td class=\"numeric_{$id} text-primary\" style=\"font-size:12px;text-align:left\">{$rx_avg}</td>";
            echo "<td class=\"numeric_{$id}\" style=\"font-size:12px;text-align:left\">{$total}</td>";
            echo "</tr>\n";
        }
    }

    echo "</tbody>";
    echo "</table>";
}

get_vnstat_data();
?>

<div class="col-sm-12" style="padding-left:0;padding-right:0;">
  <div class="table-responsive">
    <?php
      if ($page == 's') {
          write_summary_s();
      } elseif ($page == 'h') {
          write_data_table_s(T('Last 24 hours'), $hour);
      } elseif ($page == 'd') {
          write_data_table_s(T('Last 30 days'), $day);
      } elseif ($page == 'm') {
          write_data_table_s(T('Last 12 months'), $month);
      }
    ?>
  </div>
</div>
<div class="col-sm-12" style="padding-left:0;padding-right:0;">
  <div class="table-responsive">
    <?php
      if ($page == 's') {
          write_summary_t();
      } elseif ($page == 'h') {
          write_data_table_t(T('Last 24 hours'), $hour);
      } elseif ($page == 'd') {
          write_data_table_t(T('Last 30 days'), $day);
      } elseif ($page == 'm') {
          write_data_table_t(T('Last 12 months'), $month);
      }
    ?>
  </div>
</div>
