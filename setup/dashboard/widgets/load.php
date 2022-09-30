<?php

// SPDX-License-Identifier: GPL-3.0-or-later

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.system.php');

echo SystemInfo::loadavg();
