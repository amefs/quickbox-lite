<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/system_info.php');

echo SystemInfo::loadavg();
