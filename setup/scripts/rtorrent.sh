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
#   Licensed under GNU General Public License v3.0 GPL-3 (in short)
#
#   You may copy, distribute and modify the software as long as you track
#   changes/dates in source files. Any modifications to our software
#   including (via compiler) GPL-licensed code must also be made available
#   under the GPL along with build & install instructions.
#
#################################################################################
logpath=$1
gui=$2
extra_arg=${*:3}
bash /usr/local/bin/quickbox/package/install/installpackage-rtorrent -l $logpath $extra_arg
sleep 5
bash /usr/local/bin/quickbox/package/install/installpackage-$gui -l $logpath