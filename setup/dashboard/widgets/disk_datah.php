<?php
include ("/srv/dashboard/inc/util.php");
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

//Unit Conversion
function formatsize($size) {
  $danwei=array(' B ',' KB ',' MB ',' GB ',' TB ');
  $allsize=array();
  $i=0;
  for($i = 0; $i <5; $i++) {
    if(floor($size/pow(1024,$i))==0){break;}
  }
  for($l = $i-1; $l >=0; $l--) {
    $allsize1[$l]=floor($size/pow(1024,$l));
    $allsize[$l]=$allsize1[$l]-$allsize1[$l+1]*1024;
  }
  $len=count($allsize);
  for($j = $len-1; $j >=0; $j--) {
    $fsize=$fsize.$allsize[$j].$danwei[$j];
  }
  return $fsize;
}

$location = "/home";
$base = 1024;
$si_prefix = array( 'b', 'k', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB' );
$rtorrents = shell_exec("ls /home/".$username."/.sessions/*.torrent|wc -l");
$dtorrents = shell_exec("ls /home/".$username."/.config/deluge/state/*.torrent|wc -l");
$transtorrents = shell_exec("ls /home/".$username."/.config/transmission/torrents/*.torrent|wc -l");
$qtorrents = shell_exec("ls /home/".$username."/.local/share/data/qBittorrent/BT_backup/*.torrent|wc -l");
$php_self = $_SERVER['PHP_SELF'];
$web_path = substr($php_self, 0, strrpos($php_self, '/')+1);
$time = microtime(); $time = explode(" ", $time);
$time = $time[1] + $time[0]; $start = $time;

if (file_exists('/install/.quota.lock')) {
  $dftotal = shell_exec("sudo /usr/sbin/repquota /home|/bin/grep ^".$username."|/usr/bin/awk '{printf \$4/1024/1024}'");
  $dffree = shell_exec("sudo /usr/sbin/repquota /home|/bin/grep ^".$username."|/usr/bin/awk '{printf (\$4-\$3)/1024/1024}'");
  $dfused = shell_exec("sudo /usr/sbin/repquota /home|/bin/grep ^".$username."|/usr/bin/awk '{printf \$3/1024/1024}'");
  $perused = sprintf('%1.0f', $dfused / $dftotal * 100);

} else {

  $bytesfree = disk_free_space('/home');
  $class = min((int)log($bytesfree,$base),count($si_prefix) - 1); $bytestotal = disk_total_space($location);
  $class = min((int)log($bytesfree,$base),count($si_prefix) - 1); $bytesused = $bytestotal - $bytesfree;
  try {
    $diskStatus = new DiskStatus('/home');
    $freeSpace = $diskStatus->freeSpace();
    $totalSpace = $diskStatus->totalSpace();
    $barWidth = ($diskStatus->usedSpace()/500) * 500;
  } catch (Exception $e) {
    $spacebodyerr .= 'Error ('.$e-getMessage().')';
    exit();
  }
  //hard disk
  $dftotal = number_format(round(@disk_total_space($location)/(1024*1024*1024),3)); //Total
  $dffree = number_format(round(@disk_free_space($location)/(1024*1024*1024),3)); //Available
  $dfused = number_format(round(@disk_total_space($location)/(1024*1024*1024),3)-round(@disk_free_space($location)/(1024*1024*1024),3)); //used
  //hard disk for percentages
  $dptotal = round(@disk_total_space($location)/(1024*1024*1024),3); //Total
  $dpfree = round(@disk_free_space($location)/(1024*1024*1024),3); //Available
  $dpused = $dptotal-$dpfree; //used
  $perused = (floatval($dptotal)!=0)?round($dpused/$dptotal*100,2):0;
  //$perused = sprintf('%1.0f', $bytesused / $bytestotal * 100);
}

?>

                  <p class="nomargin"><?php echo T('FREE'); ?>: <span style="font-weight: 700; position: absolute; left: 100px;"><?php echo "$dffree"; ?> <b>GB</b></span></p>
                  <p class="nomargin"><?php echo T('USED'); ?>: <span style="font-weight: 700; position: absolute; left: 100px;"><?php echo "$dfused"; ?> <b>GB</b></span></p>
                  <p class="nomargin"><?php echo T('SIZE'); ?>: <span style="font-weight: 700; position: absolute; left: 100px;"><?php echo "$dftotal"; ?> <b>GB</b></span></p>
                  <div class="row">
                    <div class="col-sm-8">
                      <!--h4 class="panel-title text-success">Disk Space</h4-->
                      <h3><?php echo T('DISK_SPACE'); ?></h3>
                      <div class="progress">
                        <?php
                          if ($perused < "70") { $diskcolor="progress-bar-success"; }
                          if ($perused > "70") { $diskcolor="progress-bar-warning"; }
                          if ($perused > "90") { $diskcolor="progress-bar-danger"; }
                        ?>
                        <div style="width:<?php echo "$perused"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "$perused"; ?>" role="progressbar" class="progress-bar <?php echo $diskcolor ?>">
                          <span class="sr-only"><?php echo "$perused"; ?>% <?php echo T('USED'); ?></span>
                        </div>
                      </div>
                      <p style="font-size:10px"><?php echo T('PERCENTAGE_TXT_1'); ?> <?php echo "$perused" ?>% <?php echo T('PERCENTAGE_TXT_2'); ?></p>
                    </div>
                    <div class="col-sm-4 text-right">
                      <?php
                        if ($perused < "70") { $diskcolor="disk-good"; }
                        if ($perused > "70") { $diskcolor="disk-warning"; }
                        if ($perused > "90") { $diskcolor="disk-danger"; }
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


<script type="text/javascript">
$(function() {

  // Knob
  $('.dial-success').knob({
    readOnly: true,
    width: '70px',
    bgColor: '#E7E9EE',
    fgColor: '#4daf7c',
    inputColor: '#262B36'
  });

  $('.dial-warning').knob({
    readOnly: true,
    width: '70px',
    bgColor: '#E7E9EE',
    fgColor: '#e6ad5c',
    inputColor: '#262B36'
  });

  $('.dial-danger').knob({
    readOnly: true,
    width: '70px',
    bgColor: '#E7E9EE',
    fgColor: '#D9534F',
    inputColor: '#262B36'
  });

  $('.dial-info').knob({
    readOnly: true,
    width: '70px',
    bgColor: '#66BAC4',
    fgColor: '#fff',
    inputColor: '#fff'
  });

});
</script>
