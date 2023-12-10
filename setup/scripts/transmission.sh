#!/bin/bash
#
# [QuickBox Lite Transmission Installer (Main)]
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
extra_arg=${*:2}
bash /usr/local/bin/quickbox/package/install/installpackage-transmission -l $logpath $extra_arg