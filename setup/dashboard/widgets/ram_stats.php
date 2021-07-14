<?php
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
$username   = getUser();
$master     = file_get_contents($_SERVER['DOCUMENT_ROOT'].'/db/master.txt');
$master     = preg_replace('/\s+/', '', $master);
$time_start = microtime_float();

// Information obtained depending on the system CPU
switch (PHP_OS) {
    case "Linux":
        $sysMemInfo = sys_linux_mem();
    break;

    default:
        $sysMemInfo = [];
    break;
}

//linux system detects
function sys_linux_mem() {
    // MEMORY
    if (false === ($str = @file("/proc/meminfo"))) {
        return false;
    }
    $str = implode("", $str);
    preg_match_all("/MemTotal\s{0,}\:+\s{0,}([\d\.]+).+?MemFree\s{0,}\:+\s{0,}([\d\.]+).+?Cached\s{0,}\:+\s{0,}([\d\.]+).+?SwapTotal\s{0,}\:+\s{0,}([\d\.]+).+?SwapFree\s{0,}\:+\s{0,}([\d\.]+)/s", $str, $buf);
    preg_match_all("/Buffers\s{0,}\:+\s{0,}([\d\.]+)/s", $str, $buffers);

    $res['memTotal']   = floatval($buf[1][0]);
    $res['memFree']    = floatval($buf[2][0]);
    $res['memBuffers'] = floatval($buffers[1][0]);
    $res['memCached']  = floatval($buf[3][0]);
    $res['memUsed']    = $res['memTotal'] - $res['memFree'];
    $res['memPercent'] = ($res['memTotal'] > 1e-5) ? $res['memUsed'] / $res['memTotal'] * 100 : 0;

    $res['memRealUsed']    = $res['memTotal'] - $res['memFree'] - $res['memCached'] - $res['memBuffers']; //Real memory usage
    $res['memRealFree']    = $res['memTotal'] - $res['memRealUsed']; //Real idle
    $res['memRealPercent'] = ($res['memTotal'] > 1e-5) ? $res['memRealUsed'] / $res['memTotal'] * 100 : 0; //Real memory usage

    $res['memCachedPercent'] = ($res['memCached'] > 1e-5) ? $res['memCached'] / $res['memTotal'] * 100 : 0; //Cached memory usage

    $res['swapTotal']   = floatval($buf[4][0]);
    $res['swapFree']    = floatval($buf[5][0]);
    $res['swapUsed']    = $res['swapTotal'] - $res['swapFree'];
    $res['swapPercent'] = ($res['swapTotal'] > 1e-5) ? $res['swapUsed'] / $res['swapTotal'] * 100 : 0;

    return $res;
}

function get_ram_color($percent) {
    if ($percent >= 90) {
        return "progress-bar-danger";
    }
    if ($percent >= 70) {
        return "progress-bar-warning";
    }

    return "progress-bar-success";
}

$memTotal         = formatsize($sysMemInfo['memTotal']);
$memUsed          = formatsize($sysMemInfo['memUsed']);
$memFree          = formatsize($sysMemInfo['memFree']);
$memCached        = formatsize($sysMemInfo['memCached']); //memory cache
$memBuffers       = formatsize($sysMemInfo['memBuffers']); //buffer
$swapTotal        = formatsize($sysMemInfo['swapTotal']);
$swapUsed         = formatsize($sysMemInfo['swapUsed']);
$swapFree         = formatsize($sysMemInfo['swapFree']);
$swapPercent      = number_format($sysMemInfo['swapPercent'], 3);
$memRealUsed      = formatsize($sysMemInfo['memRealUsed']); //Real memory usage
$memRealFree      = formatsize($sysMemInfo['memRealFree']); //Real memory free
$memRealPercent   = number_format($sysMemInfo['memRealPercent'], 3); //Real memory usage ratio
$memPercent       = number_format($sysMemInfo['memPercent'], 3); //Total Memory Usage
$memCachedPercent = number_format($sysMemInfo['memCachedPercent'], 3); //cache memory usage
?>

<div class="row">
  <?php
  $tmp = [
      'memTotal', 'memUsed', 'memFree', 'memPercent',
      'memCached', 'memRealPercent',
      'swapTotal', 'swapUsed', 'swapFree', 'swapPercent',
  ];
  foreach ($tmp as $v) {
      $sysMemInfo[$v] = $sysMemInfo[$v] ? $sysMemInfo[$v] : 0;
  }
  ?>
  <!-- PHSYSICAL MEMORY USAGE -->
  <div class="col-sm-12">
    <!--div class="vertical-container"-->
      <p style="font-size:10px"><?php echo T('PHYSICAL_MEMORY_TITLE'); ?>: <?php echo "{$memPercent}"; ?>%<br/>
        <?php echo T('PHYSICAL_MEMORY_USED_TXT'); ?>: <font color='#eb4549'><?php echo "{$memUsed}"; ?></font>  | <?php echo T('PHYSICAL_MEMORY_IDLE_TXT'); ?>: <font color='#eb4549'><?php echo "{$memFree}"; ?></font>
      </p>
      <div class="progress progress-striped">
        <?php $ramcolor = get_ram_color($memPercent); ?>
        <div style="width:<?php echo "{$memPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$memPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
          <span class="sr-only"><?php echo "{$memPercent}"; ?>% <?php echo T('USED'); ?></span>
        </div>
      </div>
    <!--/div-->
  </div>
  <?php
  //Determine if the cache is zero, no display
  if ($memCached > 1e-5) { ?>
  <!-- CACHED MEMORY USAGE -->
  <div class="col-sm-12" style="padding-top:10px">
    <p style="font-size:10px"><?php echo T('CACHED_MEMORY_TITLE'); ?>: <?php echo "{$memCachedPercent}"; ?>%<br/>
      <?php echo T('CACHED_MEMORY_USAGE_TXT'); ?> <?php echo "{$memCached}"; ?> | <?php echo T('CACHED_MEMORY_BUFFERS_TXT'); ?> <?php echo "{$memBuffers}"; ?></p>
    <div class="progress progress-striped">
      <?php $ramcolor = get_ram_color($memCachedPercent); ?>
      <div style="width:<?php echo "{$memCachedPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$memCachedPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
        <span class="sr-only"><?php echo "{$memCachedPercent}"; ?>% <?php echo T('USED'); ?></span>
      </div>
    </div>
  </div>
  <!-- REAL MEMORY USAGE -->
  <div class="col-sm-12" style="padding-top:10px">
    <p style="font-size:10px"><?php echo T('REAL_MEMORY_TITLE'); ?>: <?php echo "{$memRealPercent}"; ?>%<br/>
      <?php echo T('REAL_MEMORY_USAGE_TXT'); ?> <?php echo "{$memRealUsed}"; ?> | <?php echo T('REAL_MEMORY_FREE_TXT'); ?> <?php echo "{$memRealFree}"; ?></p>
    <div class="progress progress-striped">
    <?php $ramcolor = get_ram_color($memRealPercent); ?>
      <div style="width:<?php echo "{$memRealPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$memRealPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
        <span class="sr-only"><?php echo "{$memRealPercent}"; ?>% <?php echo T('USED'); ?></span>
      </div>
    </div>
  </div>
  <?php } ?>
  <?php
  //If SWAP district judge is 0, no display
  if ($swapTotal > 1e-5) { ?>
  <!-- SWAP USAGE -->
  <div class="col-sm-12" style="padding-top:10px">
    <p style="font-size:10px">
      <?php echo T('SWAP_TITLE'); ?>: <?php echo "{$swapPercent}"; ?>%<br/>
      <?php echo T('SWAP_TOTAL_TXT'); ?>: <?php echo T('TOTAL_L'); ?> <?php echo "{$swapTotal}"; ?> | <?php echo T('SWAP_USED_TXT'); ?> <?php echo "{$swapUsed}"; ?> | <?php echo T('SWAP_IDLE_TXT'); ?> <?php echo "{$swapFree}"; ?>
    </p>
    <div class="progress progress-striped">
      <?php $ramcolor = get_ram_color($swapPercent); ?>
      <div style="width:<?php echo "{$swapPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$swapPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
        <span class="sr-only"><?php echo "{$swapPercent}"; ?>% <?php echo T('USED'); ?></span>
      </div>
    </div>
  </div>
  <?php } ?>
</div>
<hr />
<h3><?php echo T('TOTAL_RAM'); ?></h3>
<h4 class="nomargin"><?php echo $memTotal; ?>
  <?php if ($username == "{$master}") { ?>
    <button onclick="boxHandler(event)" data-package="mem" data-operation="clean" data-toggle="modal" data-target="#sysResponse" class="btn btn-xs btn-default pull-right"><?php echo T('CLEAR_CACHE'); ?></button>
  <?php } ?>
</h4>
