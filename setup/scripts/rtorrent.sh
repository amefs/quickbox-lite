#!/bin/bash
#
# [QuickBox Lite rTorrent Installer (Main)]
#
# GitHub:           https://github.com/amefs/quickbox-lite
# Author:           Amefs
# Current version:  v1.6.1
# Original Repo:    https://github.com/QuickBox/QB
# Credits to:       QuickBox.io
#
# SPDX-License-Identifier: GPL-3.0-or-later
#
################################################################################

if (($# < 2)); then
	printf '%s\n' 'Usage: rtorrent.sh LOG_PATH GUI [installer arguments...]' >&2
	exit 2
fi
logpath=$1
gui=$2
shift 2
case "$gui" in
	rutorrent|flood) ;;
	*) printf '%s\n' 'GUI must be rutorrent or flood.' >&2; exit 2 ;;
esac

bash /usr/local/bin/quickbox/package/install/installpackage-rtorrent -l "$logpath" "$@" || exit $?
sleep 5
bash "/usr/local/bin/quickbox/package/install/installpackage-${gui}" -l "$logpath"
