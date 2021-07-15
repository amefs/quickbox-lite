<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');

//NIC flow
$strs = @file("/proc/net/dev");
assert($strs !== false);
// only index start from 0 will be encoded as an array
$NetInputSpeed = [0 => null, 1 => null];
$NetOutSpeed   = [0 => null, 1 => null];

for ($i = 2; $i < count($strs); ++$i) {
    preg_match_all("/(?<name>[^\s]+):[\s]{0,}(?<rx_bytes>\d+)\s+(?:\d+\s+){7}(?<tx_bytes>\d+)\s+/", $strs[$i], $info);
    $NetInputSpeed[$i] = $info["rx_bytes"][0]; // Receive data in bytes
    $NetOutSpeed[$i]   = $info["tx_bytes"][0]; // Transmit data in bytes
}

$arr = [
    "NetOutSpeed"    => $NetOutSpeed,
    "NetInputSpeed"  => $NetInputSpeed,
    "NetTimeStamp"   => microtime(true),
    "InterfaceIndex" => count($strs),
];
echo json_encode($arr);
