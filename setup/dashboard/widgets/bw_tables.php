<?php

// Network Interface
$interface = INETFACE;
$iface_list = array('INETFACE');
$iface_title['INETFACE'] = 'External';
$vnstat_bin = '/usr/bin/vnstat';
$data_dir = './dumps';
$byte_notation = null;

require ('../inc/localize.php');
require ('vnstat.php');

validate_input();

function kbytes_to_string($kb) {

  global $byte_notation;

  $units = array('TB','GB','MB','KB');
  $scale = 1024*1024*1024;
  $ui = 0;

  $custom_size = isset($byte_notation) && in_array($byte_notation, $units);

  while ((($kb < $scale) && ($scale > 1)) || $custom_size) {
    $ui++;
    $scale = $scale / 1024;

    if ($custom_size && $units[$ui] == $byte_notation) {
      break;
    }
  }

  return sprintf("%0.2f %s", ($kb/$scale),$units[$ui]);
}

function write_summary_s() {
  global $summary,$day,$hour,$month;

  $trx = $summary['totalrx']*1024+$summary['totalrxk'];
  $ttx = $summary['totaltx']*1024+$summary['totaltxk'];

  //
  // let's build array for write_data_table
  //

  $sum = array();

  if (count($day) > 0 && count($hour) > 0 && count($month) > 0) {
    $sum[0]['act'] = 1;
    $sum[0]['label'] = T('This hour');
    $sum[0]['rx'] = $hour[0]['rx'];
    $sum[0]['tx'] = $hour[0]['tx'];

    $sum[1]['act'] = 1;
    $sum[1]['label'] = T('This day');
    $sum[1]['rx'] = $day[0]['rx'];
    $sum[1]['tx'] = $day[0]['tx'];

    $sum[2]['act'] = 1;
    $sum[2]['label'] = T('This month');
    $sum[2]['rx'] = $month[0]['rx'];
    $sum[2]['tx'] = $month[0]['tx'];

    $sum[3]['act'] = 1;
    $sum[3]['label'] = T('All time');
    $sum[3]['rx'] = $trx;
    $sum[3]['tx'] = $ttx;
  }

write_data_table_s(T('Summary'), $sum);

}

function write_summary_t() {
  global $top;

  $trx = $summary['totalrx']*1024+$summary['totalrxk'];
  $ttx = $summary['totaltx']*1024+$summary['totaltxk'];

  //
  // let's build array for write_data_table
  //

  $sum = array();

  if (count($day) > 0 && count($hour) > 0 && count($month) > 0) {
    $sum[0]['act'] = 1;
    $sum[0]['label'] = T('This hour');
    $sum[0]['rx'] = $hour[0]['rx'];
    $sum[0]['tx'] = $hour[0]['tx'];

    $sum[1]['act'] = 1;
    $sum[1]['label'] = T('This day');
    $sum[1]['rx'] = $day[0]['rx'];
    $sum[1]['tx'] = $day[0]['tx'];

    $sum[2]['act'] = 1;
    $sum[2]['label'] = T('This month');
    $sum[2]['rx'] = $month[0]['rx'];
    $sum[2]['tx'] = $month[0]['tx'];

    $sum[3]['act'] = 1;
    $sum[3]['label'] = T('All time');
    $sum[3]['rx'] = $trx;
    $sum[3]['tx'] = $ttx;
  }

write_data_table_t(T('Top 10 days'), $top);

}

function write_data_table_s($caption, $tab) {
  print "<table class=\"table table-hover table-default nomargin\" width=\"100%\" cellspacing=\"0\">";
  print "<thead>";
  print "<tr>";
  print "<th class=\"text-right\" style=\"width:25%;\">$caption</th>";
  print "<th class=\"text-right\" style=\"width:24.5%;\">".T('Out')."</th>";
  print "<th class=\"text-left\" style=\"width:24.5%;\">".T('In')."</th>";
  print "<th class=\"text-left\" style=\"width:24.5%;\">".T('Total')."</th>";
  print "</tr>";
  print "</thead>";
  print "<tbody>\n";

  for ($i=0; $i<count($tab); $i++) {
    if ($tab[$i]['act'] == 1) {
      $t = $tab[$i]['label'];
      $rx = kbytes_to_string($tab[$i]['rx']);
      $tx = kbytes_to_string($tab[$i]['tx']);
      $total = kbytes_to_string($tab[$i]['rx']+$tab[$i]['tx']);
      $id = ($i & 1) ? 'odd' : 'even';
      print "<tr>";
      print "<td class=\"label_$id\" style=\"font-size:12px;text-align:right\"><b>$t</b></td>";
      print "<td class=\"numeric_$id text-success\" style=\"font-size:12px;text-align:right\">$tx</td>";
      print "<td class=\"numeric_$id text-primary\" style=\"font-size:12px;text-align:left\">$rx</td>";
      print "<td class=\"numeric_$id\" style=\"font-size:12px;text-align:left\">$total</td>";
      print "</tr>\n";
    }
  }

  print "</tbody>";
  print "</table>";
}

function write_data_table_t($caption, $tab) {
  print "<table class=\"table table-hover table-default nomargin\" width=\"100%\" cellspacing=\"0\">";
  print "<thead>";
  print "<tr>";
  print "<th class=\"text-right\" style=\"width:25%;\">$caption</th>";
  print "<th class=\"text-right\" style=\"width:24.5%;\">".T('Out')."</th>";
  print "<th class=\"text-left\" style=\"width:24.5%;\">".T('In')."</th>";
  print "<th class=\"text-left\" style=\"width:24.5%;\">".T('Total')."</th>";
  print "</tr>";
  print "</thead>";

  print "<tbody>\n";

  for ($i=0; $i<count($tab); $i++) {
    if ($tab[$i]['act'] == 1) {
      $t = $tab[$i]['label'];
      $rx = kbytes_to_string($tab[$i]['rx']);
      $tx = kbytes_to_string($tab[$i]['tx']);
      $total = kbytes_to_string($tab[$i]['rx']+$tab[$i]['tx']);
      $id = ($i & 1) ? 'odd' : 'even';
      print "<tr>";
      print "<td class=\"label_$id\" style=\"font-size:12px;;text-align:right\"><b>$t</b></td>";
      print "<td class=\"numeric_$id text-success\" style=\"font-size:12px;text-align:right\">$tx</td>";
      print "<td class=\"numeric_$id text-primary\" style=\"font-size:12px;text-align:left\">$rx</td>";
      print "<td class=\"numeric_$id\" style=\"font-size:12px;text-align:left\">$total</td>";
      print "</tr>\n";
    }
  }

  print "</tbody>";
  print "</table>";
}

get_vnstat_data();
?>

            <div class="col-sm-12" style="padding-left:0;padding-right:0;">
              <div class="table-responsive">
                <?php $graph_params = "if=$iface&amp;page=$page&amp;style=$style";
                  if ($page == 's') {
                    write_summary_s();
                  } else if ($page == 'h') {
                    write_data_table_s(T('Last 24 hours'), $hour);
                  } else if ($page == 'd') {
                    write_data_table_s(T('Last 30 days'), $day);
                  } else if ($page == 'm') {
                    write_data_table_s(T('Last 12 months'), $month);
                  }
                ?>
              </div>
            </div>

            <div class="col-sm-12" style="padding-left:0;padding-right:0;">
              <div class="table-responsive">
                <?php $graph_params = "if=$iface&amp;page=$page&amp;style=$style";
                  if ($page == 's') {
                    write_summary_t();
                  } else if ($page == 'h') {
                    write_data_table_t(T('Last 24 hours'), $hour);
                  } else if ($page == 'd') {
                    write_data_table_t(T('Last 30 days'), $day);
                  } else if ($page == 'm') {
                    write_data_table_t(T('Last 12 months'), $month);
                  }
                ?>
              </div>
            </div>
