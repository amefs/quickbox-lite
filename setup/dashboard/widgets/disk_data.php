<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');

$username = getMaster();

/**
 * @param int|float $percent
 *
 * @return string
 */
function get_progress_color($percent) {
    if ($percent >= 90) {
        return 'progress-bar-danger';
    }
    if ($percent >= 70) {
        return 'progress-bar-warning';
    }

    return 'progress-bar-success';
}

/**
 * @param int|float $percent
 *
 * @return string
 */
function get_disk_class($percent) {
    if ($percent >= 90) {
        return 'disk-danger';
    }
    if ($percent >= 70) {
        return 'disk-warning';
    }

    return 'disk-good';
}

$rtorrents     = trim((string) shell_exec('ls /home/'.$username.'/.sessions/*.torrent|wc -l'));
$dtorrents     = trim((string) shell_exec('ls /home/'.$username.'/.config/deluge/state/*.torrent|wc -l'));
$transtorrents = trim((string) shell_exec('ls /home/'.$username.'/.config/transmission/torrents/*.torrent|wc -l'));
if (file_exists('/home/'.$username.'/.local/share/data/qBittorrent')) {
    $qtorrents = trim((string) shell_exec('ls /home/'.$username.'/.local/share/data/qBittorrent/BT_backup/*.torrent|wc -l'));
} else {
    $qtorrents = trim((string) shell_exec('ls /home/'.$username.'/.local/share/qBittorrent/BT_backup/*.torrent|wc -l'));
}
// $php_self = $_SERVER['PHP_SELF'];
// $web_path = substr($php_self, 0, strrpos($php_self, '/') + 1);
// $start     = microtime_float();

$df_result = shell_exec('df -h| grep -E "^(/dev/)"');
if (!is_string($df_result)) {
    $df_result = '';
}
$disk_info = array_filter(explode("\n", $df_result));
foreach ($disk_info as $parts) {
    $splited = preg_split('/\s+/', $parts);
    assert($splited !== false);
    $parts_tmp = array_values($splited);
    // Filesystem  Size  Used  Avail  Use%                           Mounted on
    // Filesystem  Size  Used  Avail  Capacity                       Mounted on
    // Filesystem  Size  Used  Avail  Capacity iused  ifree  %iused  Mounted on
    $size        = $parts_tmp[1];
    $used        = $parts_tmp[2];
    $free        = $parts_tmp[3];
    $perused     = (int) substr($parts_tmp[4], 0, -1);
    $mount_point = end($parts_tmp);

    // skip small mount points
    if (strstr($size, 'M') !== false) {
        continue;
    }
    ?>

<div class="row">
  <div class="col-sm-8">
    <h4><?php echo T('MOUNT_POINT'); ?></h4>
    <p style="color:#eb4549; font-weight:normal; font-size:14px"><?php echo $mount_point; ?></p>
    <!--h4 class="panel-title text-success">Disk Space</h4-->
    <h4><?php echo T('DISK_SPACE'); ?></h4>
    <p class="nomargin" style="font-size:14px">
    <?php echo T('FREE'); ?>: <?php echo $free; ?> 丨 
    <?php echo T('USED'); ?>: <?php echo $used; ?> 丨 
    <?php echo T('SIZE'); ?>: <?php echo $size; ?>
    </p>
    <br>
    <div class="progress">
      <?php $diskcolor = get_progress_color($perused); ?>
      <div style="width:<?php echo $perused; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo $perused; ?>" role="progressbar" class="progress-bar <?php echo $diskcolor; ?>">
        <span class="sr-only"><?php echo $perused; ?>% <?php echo T('USED'); ?></span>
      </div>
    </div>
    <p style="font-size:10px"><?php echo T('PERCENTAGE_TXT', ['used' => $perused]); ?></p>
  </div>
  <div class="col-sm-4 text-right">
    <?php $diskclass = get_disk_class($perused); ?>
    <i class="fa fa-hdd-o <?php echo $diskclass; ?>" style="font-size: 90px;"></i>
  </div>
</div>
<hr />
<?php
}
?>

<?php if (processExists('rtorrent', $username) && file_exists('/install/.rtorrent.lock')) { ?>
<h4><?php echo T('RTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED', ['loaded' => $rtorrents]); ?></p>
<?php } ?>
<?php if (processExists('deluged', $username) && file_exists('/install/.deluge.lock')) { ?>
<h4><?php echo T('DTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED', ['loaded' => $dtorrents]); ?></p>
<?php } ?>
<?php if (processExists('transmission', $username) && file_exists('/install/.transmission.lock')) { ?>
<h4><?php echo T('TRTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED', ['loaded' => $transtorrents]); ?></p>
<?php } ?>
<?php if (processExists('qbittorrent-nox', $username) && file_exists('/install/.qbittorrent.lock')) { ?>
<h4><?php echo T('QTORRENTS_TITLE'); ?></h4>
<p class="nomargin"><?php echo T('TORRENTS_LOADED', ['loaded' => $qtorrents]); ?></p>
<?php } ?>
