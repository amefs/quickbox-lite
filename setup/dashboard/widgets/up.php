<?php
  require_once ($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
  header('Refresh: 1');
  header('Content-Type: text/event-stream');
  header('Cache-Control: no-cache');
  $uptime = intval(shell_exec("cut -d. -f1 /proc/uptime"));
  $days = floor($uptime / 60 / 60 / 24);
  $hours = $uptime / 60/ 60 % 24;
  $mins = $uptime / 60 % 60;
?>
<span style="font-size:14px;">
  <b><?php echo "$days" ?></b><small> <?php echo T('DAYS_L'); ?></small>
  <b><?php echo "$hours" ?></b><small> <?php echo T('HOURS_L'); ?></small>
  <b><?php echo "$mins" ?></b><small> <?php echo T('MINUTES_L'); ?></small>
</span>
<?php flush(); ?>
