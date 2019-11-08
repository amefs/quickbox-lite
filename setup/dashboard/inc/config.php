<?php
if (isset($_SESSION))
{
  session_destroy();
}

require_once ($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
require_once ($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
require_once ($_SERVER['DOCUMENT_ROOT'].'/widgets/class.php');

$version = "v1.2.0";
error_reporting(E_ERROR);
$username = getUser();
$master = file_get_contents($_SERVER['DOCUMENT_ROOT'].'/db/master.txt');
$master = preg_replace('/\s+/', '', $master);

// Network Interface
$interface = INETFACE;
$iface_list = array('INETFACE');
$iface_title['INETFACE'] = 'External';
$vnstat_bin = '/usr/bin/vnstat';
$data_dir = './dumps';
$byte_notation = null;

function search($data, $find, $end) {
    $pos1 = strpos($data, $find) + strlen($find);
    $pos2 = strpos($data, $end, $pos1);
    return substr($data, $pos1, $pos2 - $pos1);
}

define('HTTP_HOST', preg_replace('~^www\.~i', '', $_SERVER['HTTP_HOST']));

$panel = array(
    'name'              => 'QuickBox Lite',
    'author'            => 'Everyone that contributes to the open QuickBox project!',
    'robots'            => 'noindex, nofollow',
    'title'             => 'Quickbox Dashboard',
    'description'       => 'QuickBox is an open-source seedbox project that is developed and maintained by anyone who so choses to provide time and energy.',
    'active_page'       => basename($_SERVER['PHP_SELF']),
);

$time_start = microtime_float();

// Timing
function microtime_float() {
  $mtime = microtime();
  $mtime = explode(' ', $mtime);
  return $mtime[1] + $mtime[0];
}

//NIC flow
$strs = @file("/proc/net/dev");
// only index start from 0 will be encoded as an array
$NetInputSpeed = [0 => NULL, 1 => NULL];
$NetOutSpeed = [0 => NULL, 1 => NULL];

for ($i = 2; $i < count($strs); $i++) {
  preg_match_all("/(?<name>[^\s]+):[\s]{0,}(?<rx_bytes>\d+)\s+(?:\d+\s+){7}(?<tx_bytes>\d+)\s+/", $strs[$i], $info);
  $NetInputSpeed[$i] = $info["rx_bytes"][0]; // Receive data in bytes
  $NetOutSpeed[$i] = $info["tx_bytes"][0]; // Transmit data in bytes
}

//Real-time refresh ajax calls
if ($_GET["act"] == "rt") {
  $arr = array(
    "NetOutSpeed" => $NetOutSpeed,
    "NetInputSpeed" => $NetInputSpeed,
    "NetTimeStamp" => microtime(true),
    "InterfaceIndex" => count($strs)
  );
  $jarr = json_encode($arr);
  echo htmlspecialchars($_GET["callback"])."(".$jarr.")";
  exit;
}


function GetCoreInformation() {$data = file('/proc/stat');$cores = array();foreach( $data as $line ) {if( preg_match('/^cpu[0-9]/', $line) ){$info = explode(' ', $line);$cores[]=array('user'=>$info[1],'nice'=>$info[2],'sys' => $info[3],'idle'=>$info[4],'iowait'=>$info[5],'irq' => $info[6],'softirq' => $info[7]);}}return $cores;}
function GetCpuPercentages($stat1, $stat2) {if(count($stat1)!==count($stat2)){return;}$cpus=array();for( $i = 0, $l = count($stat1); $i < $l; $i++) { $dif = array(); $dif['user'] = $stat2[$i]['user'] - $stat1[$i]['user'];$dif['nice'] = $stat2[$i]['nice'] - $stat1[$i]['nice'];  $dif['sys'] = $stat2[$i]['sys'] - $stat1[$i]['sys'];$dif['idle'] = $stat2[$i]['idle'] - $stat1[$i]['idle'];$dif['iowait'] = $stat2[$i]['iowait'] - $stat1[$i]['iowait'];$dif['irq'] = $stat2[$i]['irq'] - $stat1[$i]['irq'];$dif['softirq'] = $stat2[$i]['softirq'] - $stat1[$i]['softirq'];$total = array_sum($dif);$cpu = array();foreach($dif as $x=>$y) $cpu[$x] = round($y / $total * 100, 2);$cpus['cpu' . $i] = $cpu;}return $cpus;}
$stat1 = GetCoreInformation();sleep(1);$stat2 = GetCoreInformation();$data = GetCpuPercentages($stat1, $stat2);
$cpu_show = $data['cpu0']['user']."%us,  ".$data['cpu0']['idle']."%id,  ";

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
    // CPU
    if (false === ($str = @file("/proc/cpuinfo"))) return false;
    $str = implode("", $str);
    @preg_match_all("/model\s+name\s{0,}\:+\s{0,}([^\:]+)([\r\n]+)/s", $str, $model);
    @preg_match_all("/cpu\s+MHz\s{0,}\:+\s{0,}([\d\.]+)[\r\n]+/", $str, $mhz);
    @preg_match_all("/cache\s+size\s{0,}\:+\s{0,}([\d\.]+\s{0,}[A-Z]+[\r\n]+)/", $str, $cache);
    if (false !== is_array($model[1]))
    {
      $res['cpu']['num'] = sizeof($model[1]);

      if($res['cpu']['num']==1)
        $x1 = '';
      else
        $x1 = ' ×'.$res['cpu']['num'];
      $mhz[1][0] = ' <span style="color:#999;font-weight:600">Frequency:</span> '.$mhz[1][0];
      $cache[1][0] = ' <br /> <span style="color:#999;font-weight:600">Secondary cache:</span> '.$cache[1][0];
      $res['cpu']['model'][] = '<h4>'.$model[1][0].'</h4>'.$mhz[1][0].$cache[1][0].$x1;
      if (false !== is_array($res['cpu']['model'])) $res['cpu']['model'] = implode("<br />", $res['cpu']['model']);
      if (false !== is_array($res['cpu']['mhz'])) $res['cpu']['mhz'] = implode("<br />", $res['cpu']['mhz']);
      if (false !== is_array($res['cpu']['cache'])) $res['cpu']['cache'] = implode("<br />", $res['cpu']['cache']);
    }

    return $res;
}

//FreeBSD system detects
function sys_freebsd()
{
  //CPU
  if (false === ($res['cpu']['num'] = get_key("hw.ncpu"))) return false;
  $res['cpu']['model'] = get_key("hw.model");
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


function GetWMI($wmi,$strClass, $strValue = array()) {
  $arrData = array();

  $objWEBM = $wmi->Get($strClass);
  $arrProp = $objWEBM->Properties_;
  $arrWEBMCol = $objWEBM->Instances_();
  foreach($arrWEBMCol as $objItem) {
    @reset($arrProp);
    $arrInstance = array();
    foreach($arrProp as $propItem) {
      eval("\$value = \$objItem->" . $propItem->Name . ";");
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

function session_start_timeout($timeout=5, $probability=100, $cookie_domain='/') {
  ini_set("session.gc_maxlifetime", $timeout);
  ini_set("session.cookie_lifetime", $timeout);
  $seperator = strstr(strtoupper(substr(PHP_OS, 0, 3)), "WIN") ? "\\" : "/";
  $path = ini_get("session.save_path") . $seperator . "session_" . $timeout . "sec";
  if(!file_exists($path)) {
    if(!mkdir($path, 600)) {
      trigger_error("Failed to create session save path directory '$path'. Check permissions.", E_USER_ERROR);
    }
  }
  ini_set("session.save_path", $path);
  ini_set("session.gc_probability", $probability);
  ini_set("session.gc_divisor", 100);
  session_start();
  if(isset($_COOKIE[session_name()])) {
    setcookie(session_name(), $_COOKIE[session_name()], time() + $timeout, $cookie_domain);
  }
}

session_start_timeout(5);
$MSGFILE = session_id();

function processExists($processName, $username) {
  $exists= false;
  exec("ps axo user:20,pid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm,cmd|grep $username | grep -iE $processName | grep -v grep", $pids);
  if (count($pids) > 0) {
    $exists = true;
  }
  return $exists;
}

$btsync = processExists("resilio-sync",$username);
$deluged = processExists("deluged",$username);
$delugedweb = processExists("deluge-web",$username);
$denyhosts = processExists("denyhosts",root);
$fail2ban = processExists("fail2ban",root);
$filebrowser = processExists("filebrowser",$username);
$flexget = processExists("flexget",$username);
$flood = processExists("flood",$username);
$irssi = processExists("irssi",$username);
$netdata = processExists("netdata",netdata);
$novnc = processExists("Xtightvnc", $username);
$plex = processExists("Plex",plex);
$rtorrent = processExists("rtorrent",$username);
$syncthing = processExists("syncthing",$username);
$shellinabox = processExists("shellinabox",shellinabox);
$transmission = processExists("transmission-daemon",$username);
$qbittorrent = processExists("qbittorrent-nox",$username);
$znc = processExists("znc",$username);

function isEnabled($process, $username){
  $service = $process;
  if(file_exists('/etc/systemd/system/multi-user.target.wants/'.$process.'@'.$username.'.service') || file_exists('/etc/systemd/system/multi-user.target.wants/'.$process.'.service')){
    return " <div class=\"toggle-wrapper text-center\"> <div class=\"toggle-en toggle-light primary\" onclick=\"location.href='?id=77&servicedisable=$service'\"></div></div>";
  } else {
    return " <div class=\"toggle-wrapper text-center\"> <div class=\"toggle-dis toggle-light primary\" onclick=\"location.href='?id=66&serviceenable=$service'\"></div></div>";
  }
}

if(file_exists('/srv/dashboard/custom/url.override.php')){
  // BEGIN CUSTOM URL OVERRIDES //
  include ($_SERVER['DOCUMENT_ROOT'].'/custom/url.override.php');
  // END CUSTOM URL OVERRIDES ////
} else {
  $btsyncURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username.btsync/";
  $dwURL = "https://" . $_SERVER['HTTP_HOST'] . "/deluge/";
  $delugedlURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username.deluge.downloads";
  $filebrowserURL = "https://" . $_SERVER['HTTP_HOST'] . "/filebrowser/";
  $flexgetURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username.flexget/";
  $floodURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username/flood/";
  $netdataURL = "https://" . $_SERVER['HTTP_HOST'] . "/netdata/";
  $novncURL = "https://" . $_SERVER['HTTP_HOST'] . "/vnc/";
  $plexURL = "https://" . $_SERVER['HTTP_HOST'] . "/web/";
  $qbittorrentURL = "https://" . $_SERVER['HTTP_HOST'] . "/qbittorrent/";
  $qbittorrentdlURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username.qbittorrent.downloads";
  $rtorrentdlURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username.rtorrent.downloads";
  $rutorrentURL = "https://" . $_SERVER['HTTP_HOST'] . "/rutorrent/";
  $syncthingURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username.syncthing/";
  $transmissionURL = "https://" . $_SERVER['HTTP_HOST'] . "/transmission";
  $transmissiondlURL = "https://" . $_SERVER['HTTP_HOST'] . "/$username.transmission.downloads";
  $zncURL = "https://" . $_SERVER['HTTP_HOST'] . "/znc/";
 }
 
include ($_SERVER['DOCUMENT_ROOT'].'/widgets/lang_select.php');
include ($_SERVER['DOCUMENT_ROOT'].'/widgets/plugin_data.php');
include ($_SERVER['DOCUMENT_ROOT'].'/widgets/package_data.php');
include ($_SERVER['DOCUMENT_ROOT'].'/widgets/sys_data.php');
include ($_SERVER['DOCUMENT_ROOT'].'/widgets/theme_select.php');
$base = 1024;
$location = "/home";

/* check for services */
switch (intval($_GET['id'])) {
case 0:
  $rtorrent = isEnabled("rtorrent", $username);
    $cbodyr .= $rtorrent;
  $irssi = isEnabled("irssi", $username);
    $cbodyi .= $irssi;
  $deluged = isEnabled("deluged", $username);
    $cbodyd .= $deluged;
  $delugedweb = isEnabled("deluge-web", $username);
    $cbodydw .= $delugedweb;
  $denyhosts = isEnabled("denyhosts", root);
    $cbodydh .= $denyhosts;
  $fail2ban = isEnabled("fail2ban", root);
    $cbodyf2b .= $fail2ban; 
  $filebrowser = isEnabled("filebrowser", $username);
    $cbodyfb .= $filebrowser;
  $flexget = isEnabled("flexget", $username);
    $cbodyfg .= $flexget;
  $flood = isEnabled("flood", $username);
    $cbodyfl .= $flood;
  $shellinabox = isEnabled("shellinabox",shellinabox);
    $wcbodyb .= $shellinabox;
  $btsync = isEnabled("resilio-sync",$username);
    $cbodyb .= $btsync;
  $netdata = isEnabled("netdata",netdata);
    $cbodynd .= $netdata;
  $novnc = isEnabled("tightvnc",$username);
    $cbodyvnc .= $novnc;
  $plex = isEnabled("plexmediaserver",plex);
    $cbodyp .= $plex;
  $syncthing = isEnabled("syncthing", $username);
    $cbodyst .= $syncthing;
  $transmission = isEnabled("transmission", $username);
    $cbodytr .= $transmission;
  $qbittorrent = isEnabled("qbittorrent", $username);
    $cbodyqb .= $qbittorrent;
  $x2go = isEnabled("x2go", $username);
    $cbodyx .= $x2go;
  $znc = isEnabled("znc", $username);
    $cbodyz .= $znc;

break;

/* enable & start services */
case 66:
  $process = $_GET['serviceenable'];
    if ($process == "resilio-sync"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "irssi"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "shellinabox"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl start $process");
    } elseif ($process == "denyhosts"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl start $process");
    } elseif ($process == "fail2ban"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl start $process");
    } elseif ($process == "filebrowser"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "flexget"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "flood"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "netdata"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl start $process");
    } elseif ($process == "tightvnc"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl start $process");
    } elseif ($process == "plexmediaserver"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl start $process");
    } elseif ($process == "deluged"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "deluge-web"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "rtorrent"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "transmission"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "qbittorrent"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } elseif ($process == "syncthing"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    } else {
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl start $process@$username");
    }
  header('Location: https://' . $_SERVER['HTTP_HOST'] . '/');
break;

/* disable & stop services */
case 77:
  $process = $_GET['servicedisable'];
    if ($process == "resilio-sync"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "irssi"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl stable $process@$username");
    } elseif ($process == "shellinabox"){
      shell_exec("sudo systemctl stop $process");
      shell_exec("sudo systemctl disable $process");
    } elseif ($process == "denyhosts"){
      shell_exec("sudo systemctl stop $process");
      shell_exec("sudo systemctl disable $process");
    } elseif ($process == "fail2ban"){
      shell_exec("sudo systemctl stop $process");
      shell_exec("sudo systemctl disable $process");
    } elseif ($process == "filebrowser"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "flexget"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "flood"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "netdata"){
      shell_exec("sudo systemctl stop $process");
      shell_exec("sudo systemctl disable $process");
    } elseif ($process == "tightvnc"){
      shell_exec("sudo systemctl stop $process");
      shell_exec("sudo systemctl disable $process");
    } elseif ($process == "plexmediaserver"){
      shell_exec("sudo systemctl stop $process");
      shell_exec("sudo systemctl disable $process");
    } elseif ($process == "deluged"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "deluge-web"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "rtorrent"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "transmission"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "qbittorrent"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    } elseif ($process == "syncthing"){
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    }  else {
      shell_exec("sudo systemctl stop $process@$username");
      shell_exec("sudo systemctl disable $process@$username");
    }
  header('Location: https://' . $_SERVER['HTTP_HOST'] . '/');
break;

/* restart services */
case 88:
  $process = $_GET['servicestart'];
    if ($process == "resilio-sync"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "irssi"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "shellinabox"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl restart $process");
    } elseif ($process == "denyhosts"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl restart $process");
    } elseif ($process == "fail2ban"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl restart $process");
    } elseif ($process == "filebrowser"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "flexget"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "flood"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "netdata"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl restart $process");
    } elseif ($process == "tightvnc"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl restart $process");
    } elseif ($process == "plexmediaserver"){
      shell_exec("sudo systemctl enable $process");
      shell_exec("sudo systemctl restart $process");
    } elseif ($process == "deluged"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "deluge-web"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "rtorrent"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "transmission"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "qbittorrent"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } elseif ($process == "syncthing"){
      shell_exec("sudo systemctl enable $process@$username");
      shell_exec("sudo systemctl restart $process@$username");
    } else {
      shell_exec("sudo systemctl restart $process@$username");
    }
  header('Location: https://' . $_SERVER['HTTP_HOST'] . '/');
break;

}

?>
