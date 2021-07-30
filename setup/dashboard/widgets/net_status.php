<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.system.php');

$netinfo = SystemInfo::netinfo();

$arr = [
    'NetInputSpeed' => $netinfo['Receive'],
    'NetOutSpeed'   => $netinfo['Transmit'],
    'NetTimeStamp'  => microtime(true),
];
echo json_encode($arr);
