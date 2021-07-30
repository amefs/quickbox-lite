<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.system.php');

echo SystemInfo::loadavg();
