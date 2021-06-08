<?php

if (!isset($_GET['uh'])) {
    exit('Invalid link');
}
$_SERVER['REMOTE_USER'] = base64_decode($_GET['uh']);
require_once(dirname(__FILE__)."/../../php/util.php");

//if(getConfFile('config.php') === FALSE) {die('No such file');}
echo getConfFile();
require_once(dirname(__FILE__)."/../filemanager/flm.class.php");
include(dirname(__FILE__).'/share.class.php');

$f = new FSHARE();

if (!isset($_GET['s']) || !isset($f->data[$_GET['s']]) || ($f->data[$_GET['s']]['expire'] < time())) {
    exit('No such file or it expired');
}

function authenticate() {
    header('WWW-Authenticate: Basic realm="LEAVE USERNAME EMPTY!! Password only!"');
    header('HTTP/1.0 401 Unauthorized');
    echo "Not permitted\n";
    exit;
}

if (!isset($_SERVER['PHP_AUTH_USER']) || ($_SERVER['PHP_AUTH_PW'] != $f->data[$_GET['s']]['password'])) {
    authenticate();
} else {
    $f->workdir = '';

    $f->send_file($f->data[$_GET['s']]['file']);
}
