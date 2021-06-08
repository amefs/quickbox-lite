<?php
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
$username   = getUser();
$master     = file_get_contents($_SERVER['DOCUMENT_ROOT'].'/db/master.txt');
$master     = preg_replace('/\s+/', '', $master);
$time_start = microtime_float();

function memory_usagememory_usage() {
    $memory = (!function_exists('memory_get_usage')) ? '0' : round(memory_get_usage() / 1024 / 1024, 2).'MB';

    return $memory;
}

// Timing
function microtime_float() {
    $mtime = microtime();
    $mtime = explode(' ', $mtime);

    return $mtime[1] + $mtime[0];
}

// Information obtained depending on the system CPU
switch (PHP_OS) {
  case "Linux":
    $sysReShow = (false !== ($sysInfo = sys_linux())) ? "show" : "none";
  break;
  case "FreeBSD":
    $sysReShow = (false !== ($sysInfo = sys_freebsd())) ? "show" : "none";
  break;

  default:
  break;
}

//linux system detects
function sys_linux() {
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

    $res['memRealUsed']  = $res['memTotal'] - $res['memFree'] - $res['memCached'] - $res['memBuffers']; //Real memory usage
  $res['memRealFree']    = $res['memTotal'] - $res['memRealUsed']; //Real idle
  $res['memRealPercent'] = ($res['memTotal'] > 1e-5) ? $res['memRealUsed'] / $res['memTotal'] * 100 : 0; //Real memory usage

  $res['memCachedPercent'] = ($res['memCached'] > 1e-5) ? $res['memCached'] / $res['memTotal'] * 100 : 0; //Cached memory usage

    $res['swapTotal']   = floatval($buf[4][0]);
    $res['swapFree']    = floatval($buf[5][0]);
    $res['swapUsed']    = $res['swapTotal'] - $res['swapFree'];
    $res['swapPercent'] = ($res['swapTotal'] > 1e-5) ? $res['swapUsed'] / $res['swapTotal'] * 100 : 0;

    return $res;
}

//FreeBSD system detects
function sys_freebsd() {
    //MEMORY
    if (false === ($buf = get_key("hw.physmem"))) {
        return false;
    }
    $res['memTotal'] = round($buf / 1024 / 1024, 2);

    $str = get_key("vm.vmtotal");
    preg_match_all("/\nVirtual Memory[\:\s]*\(Total[\:\s]*([\d]+)K[\,\s]*Active[\:\s]*([\d]+)K\)\n/i", $str, $buff, PREG_SET_ORDER);
    preg_match_all("/\nReal Memory[\:\s]*\(Total[\:\s]*([\d]+)K[\,\s]*Active[\:\s]*([\d]+)K\)\n/i", $str, $buf, PREG_SET_ORDER);

    $res['memRealUsed'] = floatval($buf[0][2]);
    $res['memCached']   = floatval($buff[0][2]);
    $res['memUsed']     = floatval($buf[0][1]) + $res['memCached'];
    $res['memFree']     = $res['memTotal'] - $res['memUsed'];
    $res['memPercent']  = $res['memTotal'] > 1e-5 ? $res['memUsed'] / $res['memTotal'] * 100 : 0;

    $res['memRealPercent'] = ($res['memTotal'] > 1e-5) ? $res['memRealUsed'] / $res['memTotal'] * 100 : 0;

    return $res;
}

//Obtain the parameter values FreeBSD
function get_key($keyName) {
    return do_command('sysctl', "-n {$keyName}");
}

//Determining the location of the executable file FreeBSD
function find_command($commandName) {
    $path = ['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/usr/local/bin', '/usr/local/sbin'];
    foreach ($path as $p) {
        if (@is_executable("{$p}/{$commandName}")) {
            return "{$p}/{$commandName}";
        }
    }

    return false;
}

//Order Execution System FreeBSD
function do_command($commandName, $args) {
    $buffer = "";
    if (false === ($command = find_command($commandName))) {
        return false;
    }
    if ($fp = @popen("{$command} {$args}", 'r')) {
        while (!@feof($fp)) {
            $buffer .= @fgets($fp, 4096);
        }

        return trim($buffer);
    }

    return false;
}

function GetWMI($wmi, $strClass, $strValue = []) {
    $arrData = [];

    $objWEBM    = $wmi->Get($strClass);
    $arrProp    = $objWEBM->Properties_;
    $arrWEBMCol = $objWEBM->Instances_();
    foreach ($arrWEBMCol as $objItem) {
        @reset($arrProp);
        $arrInstance = [];
        foreach ($arrProp as $propItem) {
            eval("\$value = \$objItem->".$propItem->Name.";");
            if (empty($strValue)) {
                $arrInstance[$propItem->Name] = trim($value);
            } else {
                if (in_array($propItem->Name, $strValue)) {
                    $arrInstance[$propItem->Name] = trim($value);
                }
            }
        }
        $arrData[] = $arrInstance;
    }

    return $arrData;
}

$memTotal         = formatsize($sysInfo['memTotal']);
$mt               = formatsize($sysInfo['memTotal']);
$mu               = formatsize($sysInfo['memUsed']);
$mf               = formatsize($sysInfo['memFree']);
$mc               = formatsize($sysInfo['memCached']); //memory cache
$mb               = formatsize($sysInfo['memBuffers']); //buffer
$st               = formatsize($sysInfo['swapTotal']);
$su               = formatsize($sysInfo['swapUsed']);
$sf               = formatsize($sysInfo['swapFree']);
$swapPercent      = number_format($sysInfo['swapPercent'], 3);
$memRealUsed      = formatsize($sysInfo['memRealUsed']); //Real memory usage
$memRealFree      = formatsize($sysInfo['memRealFree']); //Real memory free
$memRealPercent   = number_format($sysInfo['memRealPercent'], 3); //Real memory usage ratio
$memPercent       = number_format($sysInfo['memPercent'], 3); //Total Memory Usage
$memCachedPercent = number_format($sysInfo['memCachedPercent'], 3); //cache memory usage
?>

<div class="row">
  <?php
  $tmp = [
      'memTotal', 'memUsed', 'memFree', 'memPercent',
      'memCached', 'memRealPercent',
      'swapTotal', 'swapUsed', 'swapFree', 'swapPercent',
  ];
  foreach ($tmp as $v) {
      $sysInfo[$v] = $sysInfo[$v] ? $sysInfo[$v] : 0;
  }
  ?>
  <!-- PHSYSICAL MEMORY USAGE -->
  <div class="col-sm-12">
    <!--div class="vertical-container"-->
      <p style="font-size:10px"><?php echo T('PHYSICAL_MEMORY_TITLE'); ?>: <?php echo "{$memPercent}"; ?>%<br/>
        <?php echo T('PHYSICAL_MEMORY_USED_TXT'); ?>: <font color='#eb4549'><?php echo "{$mu}"; ?></font>  | <?php echo T('PHYSICAL_MEMORY_IDLE_TXT'); ?>: <font color='#eb4549'><?php echo "{$mf}"; ?></font>
      </p>
      <div class="progress progress-striped">
        <?php
          if ($memPercent < 70) {
              $ramcolor = "progress-bar-success";
          }
          if ($memPercent > 70) {
              $ramcolor = "progress-bar-warning";
          }
          if ($memPercent > 90) {
              $ramcolor = "progress-bar-danger";
          }
        ?>
        <div style="width:<?php echo "{$memPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$memPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
          <span class="sr-only"><?php echo "{$memPercent}"; ?>% <?php echo T('USED'); ?></span>
        </div>
      </div>
    <!--/div-->
  </div>
  <?php
  //Determine if the cache is zero, no display
  if ($sysInfo['memCached'] > 1e-5) {
      ?>
  <!-- CACHED MEMORY USAGE -->
  <div class="col-sm-12" style="padding-top:10px">
    <!--div class="vertical-container"-->
      <p style="font-size:10px"><?php echo T('CACHED_MEMORY_TITLE'); ?>: <?php echo "{$memCachedPercent}"; ?>%<br/>
        <?php echo T('CACHED_MEMORY_USAGE_TXT'); ?> <?php echo "{$mc}"; ?> | <?php echo T('CACHED_MEMORY_BUFFERS_TXT'); ?> <?php echo "{$mb}"; ?></p>
      <div class="progress progress-striped">
        <?php
          if ($memCachedPercent < 70) {
              $ramcolor = "progress-bar-success";
          }
      if ($memCachedPercent > 70) {
          $ramcolor = "progress-bar-warning";
      }
      if ($memCachedPercent > 90) {
          $ramcolor = "progress-bar-danger";
      } ?>
        <div style="width:<?php echo "{$memCachedPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$memCachedPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
          <span class="sr-only"><?php echo "{$memCachedPercent}"; ?>% <?php echo T('USED'); ?></span>
        </div>
      </div>
    <!--/div-->
  </div>
  <!-- REAL MEMORY USAGE -->
  <div class="col-sm-12" style="padding-top:10px">
    <!--div class="vertical-container"-->
      <p style="font-size:10px"><?php echo T('REAL_MEMORY_TITLE'); ?>: <?php echo "{$memRealPercent}"; ?>%<br/>
        <?php echo T('REAL_MEMORY_USAGE_TXT'); ?> <?php echo "{$memRealUsed}"; ?> | <?php echo T('REAL_MEMORY_FREE_TXT'); ?> <?php echo "{$memRealFree}"; ?></p>
      <div class="progress progress-striped">
        <?php
          if ($memRealPercent < 70) {
              $ramcolor = "progress-bar-success";
          }
      if ($memRealPercent > 70) {
          $ramcolor = "progress-bar-warning";
      }
      if ($memRealPercent > 90) {
          $ramcolor = "progress-bar-danger";
      } ?>
        <div style="width:<?php echo "{$memRealPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$memRealPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
          <span class="sr-only"><?php echo "{$memRealPercent}"; ?>% <?php echo T('USED'); ?></span>
        </div>
      </div>
    <!--/div-->
  </div>
  <?php
  }
  //If SWAP district judge is 0, no display
  if ($sysInfo['swapTotal'] > 1e-5) {
      ?>
  <!-- SWAP USAGE -->
  <div class="col-sm-12" style="padding-top:10px">
    <!--div class="vertical-container"-->
      <p style="font-size:10px"><?php echo T('SWAP_TITLE'); ?>: <?php echo "{$swapPercent}"; ?>%<br/>
        <?php echo T('SWAP_TOTAL_TXT'); ?>: <?php echo T('TOTAL_L'); ?> <?php echo $st; ?> | <?php echo T('SWAP_USED_TXT'); ?> <?php echo "{$su}"; ?> | <?php echo T('SWAP_IDLE_TXT'); ?> <?php echo "{$sf}"; ?></p>
      <div class="progress progress-striped">
        <?php
          if ($swapPercent < 70) {
              $ramcolor = "progress-bar-success";
          }
      if ($swapPercent > 70) {
          $ramcolor = "progress-bar-warning";
      }
      if ($swapPercent > 90) {
          $ramcolor = "progress-bar-danger";
      } ?>
        <div style="width:<?php echo "{$swapPercent}"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "{$swapPercent}"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor; ?>">
          <span class="sr-only"><?php echo "{$swapPercent}"; ?>% <?php echo T('USED'); ?></span>
        </div>
      </div>
    <!--/div-->
  </div>
  <?php
  }
  ?>
</div>
<hr />
<h3><?php echo T('TOTAL_RAM'); ?></h3>
<h4 class="nomargin"><?php echo $memTotal; ?>
  <?php if ($username == "{$master}") { ?>
    <button onclick="boxHandler(event)" data-package="mem" data-operation="clean" data-toggle="modal" data-target="#sysResponse" class="btn btn-xs btn-default pull-right"><?php echo T('CLEAR_CACHE'); ?></button>
  <?php } ?>
</h4>
