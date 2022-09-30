#!/bin/bash
#
# [QuickBox Lite rTorrent Installer (Main)]
#
# GitHub:   https://github.com/amefs/quickbox-lite
# Author:   Amefs
# Current version:  v0.1.0
# URL:
# Original Repo:    https://github.com/QuickBox/QB
# Credits to:       QuickBox.io
#
# SPDX-License-Identifier: GPL-3.0-or-later
#
#################################################################################
logpath=$1
gui=$2
extra_arg=${*:3}
bash /usr/local/bin/quickbox/package/install/installpackage-rtorrent -l $logpath $extra_arg
sleep 5
bash /usr/local/bin/quickbox/package/install/installpackage-$gui -l $logpath