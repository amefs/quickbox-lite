<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/config.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');

$vnstat_bin = '/usr/bin/vnstat';
$data_dir   = './dumps';

/** @var string $page */
$page = null;
/** @var array<int,mixed> $day */
$day = null;
/** @var array<int,mixed> $hour */
$hour = null;
/** @var array<int,mixed> $month */
$month = null;
/** @var array<int,mixed> $top */
$top = null;
/** @var array<int,mixed> $summary */
$summary = null;

require($_SERVER['DOCUMENT_ROOT'].'/widgets/vnstat.php');

validate_input();

/**
 * Summary bandwidth for specified interface.
 *
 * @return void
 */
function write_summary() {
    global $summary, $day, $hour, $month;

    $trx     = $summary['totalrx'];
    $ttx     = $summary['totaltx'];
    $ttime   = strtotime('now') - $summary['created'];
    $trx_avg = round($trx / $ttime) * 8;
    $ttx_avg = round($ttx / $ttime) * 8;

    //
    // let's build array for write_data_table
    //
    $sum = [];

    if (count($day) > 0 && count($hour) > 0 && count($month) > 0) {
        $sum[0]['label']  = T('This hour');
        $sum[0]['rx']     = end($hour)['rx'];
        $sum[0]['tx']     = end($hour)['tx'];
        $sum[0]['rx_avg'] = end($hour)['rx_avg'];
        $sum[0]['tx_avg'] = end($hour)['tx_avg'];

        $sum[1]['label']  = T('This day');
        $sum[1]['rx']     = end($day)['rx'];
        $sum[1]['tx']     = end($day)['tx'];
        $sum[1]['rx_avg'] = end($day)['rx_avg'];
        $sum[1]['tx_avg'] = end($day)['tx_avg'];

        $sum[2]['label']  = T('This month');
        $sum[2]['rx']     = end($month)['rx'];
        $sum[2]['tx']     = end($month)['tx'];
        $sum[2]['rx_avg'] = end($month)['rx_avg'];
        $sum[2]['tx_avg'] = end($month)['tx_avg'];

        $sum[3]['label']  = T('All time');
        $sum[3]['rx']     = $trx;
        $sum[3]['tx']     = $ttx;
        $sum[3]['rx_avg'] = $trx_avg;
        $sum[3]['tx_avg'] = $ttx_avg;
    }

    write_data_table(T('Summary'), $sum);
}

/**
 * Write details bandwidth info by given granularity.
 *
 * @param string           $caption
 * @param array<int,mixed> $tab
 *
 * @return void
 */
function write_data_table($caption, $tab) {
    echo '<table class="table table-hover table-default nomargin" width="100%" cellspacing="0">';
    echo '<thead>';
    echo '<tr>';
    echo "<th class=\"text-right\" style=\"width:20%;\">{$caption}</th>";
    echo '<th class="text-right" style="width:15%;">'.T('Out').'</th>';
    echo '<th class="text-left" style="width:15%;">'.T('In').'</th>';
    echo '<th class="text-right" style="width:15%;">'.T('Out_AVG').'</th>';
    echo '<th class="text-left" style="width:15%;">'.T('In_AVG').'</th>';
    echo '<th class="text-left" style="width:18%;">'.T('Total').'</th>';
    echo '</tr>';
    echo '</thead>';
    echo "<tbody>\n";

    for ($i = 0; $i < count($tab); ++$i) {
        $t      = $tab[$i]['label'];
        $rx     = formatsize($tab[$i]['rx'], 2);
        $tx     = formatsize($tab[$i]['tx'], 2);
        $rx_avg = formatspeed($tab[$i]['rx_avg'], 2);
        $tx_avg = formatspeed($tab[$i]['tx_avg'], 2);
        $total  = formatsize($tab[$i]['rx'] + $tab[$i]['tx'], 2);
        $id     = ($i % 2 === 1) ? 'odd' : 'even';
        echo '<tr>';
        echo "<td class=\"label_{$id}\" style=\"font-size:12px;text-align:right\"><b>{$t}</b></td>";
        echo "<td class=\"numeric_{$id} text-success\" style=\"font-size:12px;text-align:right\">{$tx}</td>";
        echo "<td class=\"numeric_{$id} text-primary\" style=\"font-size:12px;text-align:left\">{$rx}</td>";
        echo "<td class=\"numeric_{$id} text-success\" style=\"font-size:12px;text-align:right\">{$tx_avg}</td>";
        echo "<td class=\"numeric_{$id} text-primary\" style=\"font-size:12px;text-align:left\">{$rx_avg}</td>";
        echo "<td class=\"numeric_{$id}\" style=\"font-size:12px;text-align:left\">{$total}</td>";
        echo "</tr>\n";
    }

    echo '</tbody>';
    echo '</table>';
}

get_vnstat_data();
?>

<div class="col-sm-12" style="padding-left:0;padding-right:0;">
  <div class="table-responsive">
    <?php write_summary(); ?>
  </div>
</div>
<div class="col-sm-12" style="padding-left:0;padding-right:0;">
  <div class="table-responsive">
    <?php
      if ($page === 'h') {
          write_data_table(T('Recent hours'), $hour);
      } elseif ($page === 'd') {
          write_data_table(T('Last 30 days'), $day);
      } elseif ($page === 'm') {
          write_data_table(T('Last 12 months'), $month);
      } elseif ($page === 't') {
          write_data_table(T('Top 10 days'), $top);
      }
?>
  </div>
</div>
