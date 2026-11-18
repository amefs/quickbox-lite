#!/bin/bash
#
# [QuickBox Lite Linux RAR Installer (Main)]
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

logpath=$1
bash /usr/local/bin/quickbox/package/install/installpackage-linuxrar -l "$logpath"
