<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.package.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/util.php');
assert(isset($packageList));

$service = $_GET['service'];

$packageWithService = array_filter($packageList, function ($package) {
    return isset($package['services']);
});

$status = false;

foreach ($packageWithService as $package) {
    $matched = false;
    foreach ($package['services'] as $k => $info) {
        if ($k === $service) {
            $process  = $info['process'];
            $username = $info['username'];
            $status   = processExists($process, $username);
            $matched  = true;
            break;
        }
    }
    if ($matched) {
        break;
    }
}

$val = $status ? 'running' : 'disabled';
?>

<span class="badge badge-service-<?php echo $val; ?>-dot"></span><span class="badge badge-service-<?php echo $val; ?>-pulse"></span>
