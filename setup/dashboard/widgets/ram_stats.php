<?php
include '/srv/dashboard/inc/util.php';
include ("../inc/localize.php");
$username = getUser();
$master = file_get_contents('/srv/dashboard/db/master.txt');
$master=preg_replace('/\s+/', '', $master);
$time_start = microtime_float();

function memory_usage()
{
  $memory  = ( ! function_exists('memory_get_usage')) ? '0' : round(memory_get_usage()/1024/1024, 2).'MB';
  return $memory;
}

// Timing
function microtime_float()
{
  $mtime = microtime();
  $mtime = explode(' ', $mtime);
  return $mtime[1] + $mtime[0];
}

//Unit Conversion
function formatsize($size)
{
  $danwei=array(' B ',' KB ',' MB ',' GB ',' TB ');
  $allsize=array();
  $i=0;

  for($i = 0; $i <5; $i++)
  {
    if(floor($size/pow(1024,$i))==0){break;}
  }

  for($l = $i-1; $l >=0; $l--)
  {
    $allsize1[$l]=floor($size/pow(1024,$l));
    $allsize[$l]=$allsize1[$l]-$allsize1[$l+1]*1024;
  }

  $len=count($allsize);

  for($j = $len-1; $j >=0; $j--)
  {
    $fsize=$fsize.$allsize[$j].$danwei[$j];
  }
  return $fsize;
}

//Integer arithmetic ability test
function test_int()
{
  $timeStart = gettimeofday();
  for($i = 0; $i < 3000000; $i++)
  {
    $t = 1+1;
  }
  $timeEnd = gettimeofday();
  $time = ($timeEnd["usec"]-$timeStart["usec"])/1000000+$timeEnd["sec"]-$timeStart["sec"];
  $time = round($time, 3)."second";
  return $time;
}

//Floating point capability test
function test_float()
{
  //Get the value of pi
  $t = pi();
  $timeStart = gettimeofday();

  for($i = 0; $i < 3000000; $i++)
  {
    //square root
    sqrt($t);
  }

  $timeEnd = gettimeofday();
  $time = ($timeEnd["usec"]-$timeStart["usec"])/1000000+$timeEnd["sec"]-$timeStart["sec"];
  $time = round($time, 3)."second";
  return $time;
}

// Information obtained depending on the system CPU
switch(PHP_OS)
{
  case "Linux":
    $sysReShow = (false !== ($sysInfo = sys_linux()))?"show":"none";
  break;

  case "FreeBSD":
    $sysReShow = (false !== ($sysInfo = sys_freebsd()))?"show":"none";
  break;

  default:
  break;
}

//linux system detects
function sys_linux()
{

    // MEMORY
    if (false === ($str = @file("/proc/meminfo"))) return false;
    $str = implode("", $str);
    preg_match_all("/MemTotal\s{0,}\:+\s{0,}([\d\.]+).+?MemFree\s{0,}\:+\s{0,}([\d\.]+).+?Cached\s{0,}\:+\s{0,}([\d\.]+).+?SwapTotal\s{0,}\:+\s{0,}([\d\.]+).+?SwapFree\s{0,}\:+\s{0,}([\d\.]+)/s", $str, $buf);
  preg_match_all("/Buffers\s{0,}\:+\s{0,}([\d\.]+)/s", $str, $buffers);

    $res['memTotal'] = round($buf[1][0]/1024, 2);
    $res['memFree'] = round($buf[2][0]/1024, 2);
    $res['memBuffers'] = round($buffers[1][0]/1024, 2);
  $res['memCached'] = round($buf[3][0]/1024, 2);
    $res['memUsed'] = $res['memTotal']-$res['memFree'];
    $res['memPercent'] = (floatval($res['memTotal'])!=0)?round($res['memUsed']/$res['memTotal']*100,2):0;

    $res['memRealUsed'] = $res['memTotal'] - $res['memFree'] - $res['memCached'] - $res['memBuffers']; //Real memory usage
  $res['memRealFree'] = $res['memTotal'] - $res['memRealUsed']; //Real idle
    $res['memRealPercent'] = (floatval($res['memTotal'])!=0)?round($res['memRealUsed']/$res['memTotal']*100,2):0; //Real memory usage

  $res['memCachedPercent'] = (floatval($res['memCached'])!=0)?round($res['memCached']/$res['memTotal']*100,2):0; //Cached memory usage

    $res['swapTotal'] = round($buf[4][0]/1024, 2);
    $res['swapFree'] = round($buf[5][0]/1024, 2);
    $res['swapUsed'] = round($res['swapTotal']-$res['swapFree'], 2);
    $res['swapPercent'] = (floatval($res['swapTotal'])!=0)?round($res['swapUsed']/$res['swapTotal']*100,2):0;

    return $res;
}

//FreeBSD system detects
function sys_freebsd()
{
  //MEMORY
  if (false === ($buf = get_key("hw.physmem"))) return false;
  $res['memTotal'] = round($buf/1024/1024, 2);

  $str = get_key("vm.vmtotal");
  preg_match_all("/\nVirtual Memory[\:\s]*\(Total[\:\s]*([\d]+)K[\,\s]*Active[\:\s]*([\d]+)K\)\n/i", $str, $buff, PREG_SET_ORDER);
  preg_match_all("/\nReal Memory[\:\s]*\(Total[\:\s]*([\d]+)K[\,\s]*Active[\:\s]*([\d]+)K\)\n/i", $str, $buf, PREG_SET_ORDER);

  $res['memRealUsed'] = round($buf[0][2]/1024, 2);
  $res['memCached'] = round($buff[0][2]/1024, 2);
  $res['memUsed'] = round($buf[0][1]/1024, 2) + $res['memCached'];
  $res['memFree'] = $res['memTotal'] - $res['memUsed'];
  $res['memPercent'] = (floatval($res['memTotal'])!=0)?round($res['memUsed']/$res['memTotal']*100,2):0;

  $res['memRealPercent'] = (floatval($res['memTotal'])!=0)?round($res['memRealUsed']/$res['memTotal']*100,2):0;

  return $res;
}

//Obtain the parameter values FreeBSD
function get_key($keyName)
{
  return do_command('sysctl', "-n $keyName");
}

//Determining the location of the executable file FreeBSD
function find_command($commandName)
{
  $path = array('/bin', '/sbin', '/usr/bin', '/usr/sbin', '/usr/local/bin', '/usr/local/sbin');
  foreach($path as $p)
  {
    if (@is_executable("$p/$commandName")) return "$p/$commandName";
  }
  return false;
}

//Order Execution System FreeBSD
function do_command($commandName, $args)
{
  $buffer = "";
  if (false === ($command = find_command($commandName))) return false;
  if ($fp = @popen("$command $args", 'r'))
  {
    while (!@feof($fp))
    {
      $buffer .= @fgets($fp, 4096);
    }
    return trim($buffer);
  }
  return false;
}


function GetWMI($wmi,$strClass, $strValue = array())
{
  $arrData = array();

  $objWEBM = $wmi->Get($strClass);
  $arrProp = $objWEBM->Properties_;
  $arrWEBMCol = $objWEBM->Instances_();
  foreach($arrWEBMCol as $objItem)
  {
    @reset($arrProp);
    $arrInstance = array();
    foreach($arrProp as $propItem)
    {
      eval("\$value = \$objItem->" . $propItem->Name . ";");
      if (empty($strValue))
      {
        $arrInstance[$propItem->Name] = trim($value);
      }
      else
      {
        if (in_array($propItem->Name, $strValue))
        {
          $arrInstance[$propItem->Name] = trim($value);
        }
      }
    }
    $arrData[] = $arrInstance;
  }
  return $arrData;
}

//Determine if memory is less than 1GB, will be displayed MB, otherwise display GB Unit
if($sysInfo['memTotal']<1024)
{
  $memTotal = $sysInfo['memTotal']." MB";
  $mt = $sysInfo['memTotal']." MB";
  $mu = $sysInfo['memUsed']." MB";
  $mf = $sysInfo['memFree']." MB";
  $mc = $sysInfo['memCached']." MB"; //memory cache
  $mb = $sysInfo['memBuffers']." MB";  //buffer
  $st = $sysInfo['swapTotal']." MB";
  $su = $sysInfo['swapUsed']." MB";
  $sf = $sysInfo['swapFree']." MB";
  $swapPercent = $sysInfo['swapPercent'];
  $memRealUsed = $sysInfo['memRealUsed']." MB"; //Real memory usage
  $memRealFree = $sysInfo['memRealFree']." MB"; //Real memory free
  $memRealPercent = $sysInfo['memRealPercent']; //Real memory usage ratio
  $memPercent = $sysInfo['memPercent']; //Total Memory Usage
  $memCachedPercent = $sysInfo['memCachedPercent']; //cache memory usage
}
else
{
  $memTotal = round($sysInfo['memTotal']/1024,3)." GB";
  $mt = round($sysInfo['memTotal']/1024,3)." GB";
  $mu = round($sysInfo['memUsed']/1024,3)." GB";
  $mf = round($sysInfo['memFree']/1024,3)." GB";
  $mc = round($sysInfo['memCached']/1024,3)." GB";
  $mb = round($sysInfo['memBuffers']/1024,3)." GB";
  $st = round($sysInfo['swapTotal']/1024,3)." GB";
  $su = round($sysInfo['swapUsed']/1024,3)." GB";
  $sf = round($sysInfo['swapFree']/1024,3)." GB";
  $swapPercent = $sysInfo['swapPercent'];
  $memRealUsed = round($sysInfo['memRealUsed']/1024,3)." GB"; //Real memory usage
  $memRealFree = round($sysInfo['memRealFree']/1024,3)." GB"; //Real memory free
  $memRealPercent = $sysInfo['memRealPercent']; //Real memory usage ratio
  $memPercent = $sysInfo['memPercent']; //Total Memory Usage
  $memCachedPercent = $sysInfo['memCachedPercent']; //cache memory usage
}
?>

      <div class="row">

        <?php
        $tmp = array(
            'memTotal', 'memUsed', 'memFree', 'memPercent',
            'memCached', 'memRealPercent',
            'swapTotal', 'swapUsed', 'swapFree', 'swapPercent'
        );
        foreach ($tmp AS $v) {
            $sysInfo[$v] = $sysInfo[$v] ? $sysInfo[$v] : 0;
        }
        ?>
        <!-- PHSYSICAL MEMORY USAGE -->
        <div class="col-sm-12">
          <!--div class="vertical-container"-->
            <p style="font-size:10px"><?php echo T('PHYSICAL_MEMORY_TITLE'); ?>: <?php echo "$memPercent"; ?>%<br/>
              <?php echo T('PHYSICAL_MEMORY_USED_TXT'); ?>: <font color='#eb4549'><?php echo "$mu"; ?></font>  | <?php echo T('PHYSICAL_MEMORY_IDLE_TXT'); ?>: <font color='#eb4549'><?php echo "$mf"; ?></font>
            </p>
            <div class="progress progress-striped">
              <?php
                if ($memPercent < "70") { $ramcolor="progress-bar-success"; }
                if ($memPercent > "70") { $ramcolor="progress-bar-warning"; }
                if ($memPercent > "90") { $ramcolor="progress-bar-danger"; }
              ?>
              <div style="width:<?php echo "$memPercent"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "$memPercent"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor ?>">
                <span class="sr-only"><?php echo "$memPercent"; ?>% <?php echo T('USED'); ?></span>
              </div>
            </div>
          <!--/div-->
        </div>

        <?php
        //Determine if the cache is zero , no display
        if($sysInfo['memCached']>0)
        {
        ?>
        <!-- CACHED MEMORY USAGE -->
        <div class="col-sm-12" style="padding-top:10px">
          <!--div class="vertical-container"-->
            <p style="font-size:10px"><?php echo T('CACHED_MEMORY_TITLE'); ?>: <?php echo "$memCachedPercent"; ?>%<br/>
              <?php echo T('CACHED_MEMORY_USAGE_TXT'); ?> <?php echo "$mc"; ?> | <?php echo T('CACHED_MEMORY_BUFFERS_TXT'); ?> <?php echo "$mb"; ?></p>
            <div class="progress progress-striped">
              <?php
                if ($memCachedPercent < "70") { $ramcolor="progress-bar-success"; }
                if ($memCachedPercent > "70") { $ramcolor="progress-bar-warning"; }
                if ($memCachedPercent > "90") { $ramcolor="progress-bar-danger"; }
              ?>
              <div style="width:<?php echo "$memCachedPercent"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "$memCachedPercent"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor ?>">
                <span class="sr-only"><?php echo "$memCachedPercent"; ?>% <?php echo T('USED'); ?></span>
              </div>
            </div>
          <!--/div-->
        </div>
        <!-- REAL MEMORY USAGE -->
        <div class="col-sm-12" style="padding-top:10px">
          <!--div class="vertical-container"-->
            <p style="font-size:10px"><?php echo T('REAL_MEMORY_TITLE'); ?>: <?php echo "$memRealPercent"; ?>%<br/>
              <?php echo T('REAL_MEMORY_USAGE_TXT'); ?> <?php echo "$memRealUsed"; ?> | <?php echo T('REAL_MEMORY_FREE_TXT'); ?> <?php echo "$memRealFree"; ?></p>
            <div class="progress progress-striped">
              <?php
                if ($memRealPercent < "70") { $ramcolor="progress-bar-success"; }
                if ($memRealPercent > "70") { $ramcolor="progress-bar-warning"; }
                if ($memRealPercent > "90") { $ramcolor="progress-bar-danger"; }
              ?>
              <div style="width:<?php echo "$memRealPercent"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "$memRealPercent"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor ?>">
                <span class="sr-only"><?php echo "$memRealPercent"; ?>% <?php echo T('USED'); ?></span>
              </div>
            </div>
          <!--/div-->
        </div>

        <?php
        }
        //If SWAP district judge is 0, no display
        if($sysInfo['swapTotal']>0)
        {
        ?>
        <!-- SWAP USAGE -->
        <div class="col-sm-12" style="padding-top:10px">
          <!--div class="vertical-container"-->
            <p style="font-size:10px"><?php echo T('SWAP_TITLE'); ?>: <?php echo "$swapPercent"; ?>%<br/>
              <?php echo T('SWAP_TOTAL_TXT'); ?>: <?php echo T('TOTAL_L'); ?> <?php echo $st;?> | <?php echo T('SWAP_USED_TXT'); ?> <?php echo "$su"; ?> | <?php echo T('SWAP_IDLE_TXT'); ?> <?php echo "$sf"; ?></p>
            <div class="progress progress-striped">
              <?php
                if ($swapPercent < "70") { $ramcolor="progress-bar-success"; }
                if ($swapPercent > "70") { $ramcolor="progress-bar-warning"; }
                if ($swapPercent > "90") { $ramcolor="progress-bar-danger"; }
              ?>
              <div style="width:<?php echo "$swapPercent"; ?>%" aria-valuemax="100" aria-valuemin="0" aria-valuenow="<?php echo "$swapPercent"; ?>" role="progressbar" class="progress-bar <?php echo $ramcolor ?>">
                <span class="sr-only"><?php echo "$swapPercent"; ?>% <?php echo T('USED'); ?></span>
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
      <h4 class="nomargin"><?php echo $memTotal;?>
        <?php if ($username == "$master") { ?>
            <a href="?clean_mem=true" id="cleanmem" data-toggle="modal" data-target="#sysResponse" style="margin: 0 auto"> <button class="btn btn-xs btn-default pull-right"><?php echo T('CLEAR_CACHE'); ?></button></a>
        <?php } ?>
      </h4>
