<?php
include ($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
include ($_SERVER['DOCUMENT_ROOT'].'/widgets/class.php');
require_once ($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');

$username = getUser();
function processExists($processName, $username) {
  $exists= false;
  exec("ps axo user:20,pid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm|grep $username | grep -iE $processName | grep -v grep", $pids);
  if (count($pids) > 0) {
    $exists = true;
  }
  return $exists;
}

$location = "/home";
$rtorrents = shell_exec("ls /home/".$username."/.sessions/*.torrent|wc -l");
$dtorrents = shell_exec("ls /home/".$username."/.config/deluge/state/*.torrent|wc -l");
$transtorrents = shell_exec("ls /home/".$username."/.config/transmission/torrents/*.torrent|wc -l");
$qtorrents = shell_exec("ls /home/".$username."/.local/share/data/qBittorrent/BT_backup/*.torrent|wc -l");
$php_self = $_SERVER['PHP_SELF'];
$web_path = substr($php_self, 0, strrpos($php_self, '/')+1);
$time = microtime(); $time = explode(" ", $time);
$time = $time[1] + $time[0]; $start = $time;

$dftotal = @disk_total_space($location) / 1024;
$dffree = @disk_free_space($location) / 1024;
$dfused = $dftotal - $dffree;
$perused = number_format(($dftotal > 1e-5) ? $dfused / $dftotal * 100 : 0, 1);
?>

<p class="nomargin"><?php echo T('FREE'); ?>: <span style="font-weight: 700; position: absolute; left: 100px;"><?php echo formatsize($dffree, 0); ?></span></p>
<p class="nomargin"><?php echo T('USED'); ?>: <span style="font-weight: 700; position: absolute; left: 100px;"><?php echo formatsize($dfused, 0); ?></span></p>
<p class="nomargin"><?php echo T('SIZE'); ?>: <span style="font-weight: 700; position: absolute; left: 100px;"><?php echo formatsize($dftotal, 0); ?></span></p>
<div class="row">
  <div class="col-sm-8">
    <!--h4 class="panel-title text-success">Disk Space</h4-->
    <h3><?php echo T('DISK_SPACE'); ?></h3>
    <div class="progress">
      <?php
        if ($perused < 70) { $diskcolor="progress-bar-success"; }
        if ($perused > 70) { $diskcolor="progress-bar-warning"; }
        if ($perused > 90) { $diskcolor="progress-bar-danger"; }
      ?>
      <div style="width:<?php echo "$perused"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "$perused"; ?>" role="progressbar" class="progress-bar <?php echo $diskcolor ?>">
        <span class="sr-only"><?php echo "$perused"; ?>% <?php echo T('USED'); ?></span>
      </div>
    </div>
    <p style="font-size:10px"><?php echo T('PERCENTAGE_TXT_1'); ?> <?php echo "$perused" ?>% <?php echo T('PERCENTAGE_TXT_2'); ?></p>
  </div>
  <div class="col-sm-4 text-right">
    <?php
      if ($perused < 70) { $diskcolor="disk-good"; }
      if ($perused > 70) { $diskcolor="disk-warning"; }
      if ($perused > 90) { $diskcolor="disk-danger"; }
    ?>
    <i class="fa fa-hdd-o <?php echo $diskcolor ?>" style="font-size: 90px;"></i>
  </div>
</div>
<hr />
<?php if (processExists("rtorrent",$username) && file_exists('/install/.rtorrent.lock')) { ?>
<h4><?php echo T('RTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED_1'); ?> <b><?php echo "$rtorrents"; ?></b> <?php echo T('TORRENTS_LOADED_2'); ?></p>
<?php } ?>
<?php if (processExists("deluged",$username) && file_exists('/install/.deluge.lock')) { ?>
<h4><?php echo T('DTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED_1'); ?> <b><?php echo "$dtorrents"; ?></b> <?php echo T('TORRENTS_LOADED_2'); ?></p>
<?php } ?>
<?php if (processExists("transmission",$username) && file_exists('/install/.transmission.lock')) { ?>
<h4><?php echo T('TRTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED_1'); ?> <b><?php echo "$transtorrents"; ?></b> <?php echo T('TORRENTS_LOADED_2'); ?></p>
<?php } ?>
<?php if (processExists("qbittorrent-nox",$username) && file_exists('/install/.qbittorrent.lock')) { ?>
<h4><?php echo T('QTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED_1'); ?> <b><?php echo "$qtorrents"; ?></b> <?php echo T('TORRENTS_LOADED_2'); ?></p>
<?php } ?>
