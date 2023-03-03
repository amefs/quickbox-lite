#!/bin/bash
#
# [QuickBox Lite BBR Installer]
#
# GitHub:   https://github.com/amefs/quickbox-lite
# Author:   Amefs
# Current version:  v1.5.7
# URL:
# Original Repo:    https://github.com/QuickBox/QB
# Credits to:       QuickBox.io
#
# SPDX-License-Identifier: GPL-3.0-or-later
#
#################################################################################
#################################################################################
# CORE VARIABLE
#################################################################################
DISTRO=$(lsb_release -is)
RELEASE=$(lsb_release -rs)
CODENAME=$(lsb_release -cs)
SETNAME=$(lsb_release -rc)
# Server IP Address
SERVERIP=$(ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1)

################################################################################
# HELP FUNCTIONS
################################################################################
export NEWT_COLORS='
root=,black
window=,lightgray
shadow=,color8
title=color8,
checkbox=,magenta
entry=,color8
label=blue,
actlistbox=,magenta
actsellistbox=,magenta
helpline=,magenta
roottext=,magenta
emptyscale=magenta
disabledentry=magenta,
'

_norm=$(tput sgr0)
_red=$(tput setaf 1)
_green=$(tput setaf 2)
_tan=$(tput setaf 3)
_cyan=$(tput setaf 6)

function _execute() {
	($1 >>"${OUTTO}" 2>&1)
}
function _print() {
	printf "${_norm}%s${_norm}\n" "$@"
	printf "%s\n" "$@" >>"${OUTTO}"
}
function _info() {
	printf "${_cyan}➜ %s${_norm}\n" "$@"
	printf ">> Info: %s\n" "$@" >>"${OUTTO}"
}
function _success() {
	printf "${_green}✓ %s${_norm}\n" "$@"
	printf ">> Success: %s\n" "$@" >>"${OUTTO}"
}
function _warning() {
	printf "${_tan}⚠ %s${_norm}\n" "$@"
	printf ">> Warning: %s\n" "$@" >>"${OUTTO}"
}
function _error() {
	printf "${_red}✗ %s${_norm}\n" "$@"
	printf ">> Error: %s\n" "$@" >>"${OUTTO}"
}

function version_gt() { test "$(echo "$@" | tr " " "\n" | sort -V | head -n 1)" != "$1"; }
#################################################################################
# APP VARIABLE
#################################################################################
APP_TITLE="BBR"
kernel_version=$(uname -r | cut -d- -f1)
kernel_version_min=4.9
replacekernel=0
KernelVer='v4.14.32'
OUTTO=/srv/dashboard/db/output.log

################################################################################
# SCRIPT FUNCTIONS
################################################################################
function _usage() {
	echo -e "\nQuickBox Lite $APP_TITLE Installer"
	echo -e "\nUsage: \n$(basename "$0") [-h] [-l logfile] [-k kernel]"
	echo -e "\nOptions:\n"
	echo "-l, --log <logfile>       specific log file"
	echo "-k, --kernel <version>    specific kernel version e.g. v4.14.32"
	echo ""
	echo "-h, --help                display this help and exit"
}
################################################################################
# INSTALL FUNCTIONS
################################################################################
function _lockCheck() {
	if [[ -f "/install/.install.lock" ]]; then
		prevApp=$(cat /install/.install.lock)
		_info "$prevApp process running."
		_info "If you believe this to be in error, please manually remove the /install/.install.lock"
		_error "Exiting..."
		exit 1
	fi
}
function _setLock() {
	echo "${APP_TITLE}" >/install/.install.lock
}
function _lockCleanup() {
	echo "$APP_TITLE Install Complete!


Close this dialog box to refresh your browser" >>"${OUTTO}" 2>&1
	rm -f /install/.install.lock
}

function _installInfo() {
	_print "
$APP_TITLE will now be installed.

This process may take a few minutes
Please wait until the process is completed
"
}

function _main() {
	if [ "$EUID" -ne '0' ]; then
		_error "Error,This script must be run as root! "
		_lockCleanup
		exit 1
	else
		if version_gt $kernel_version_min $kernel_version; then
			replacekernel=1
		fi
		if [[ $replacekernel == 1 ]]; then
			# replacekernel before installing BBR
			KernelBitVer=''
			[ -z "$(dpkg -l | grep 'grub-')" ] && _error "Not found grub." && _lockCleanup && exit 1
			MainURL='http://kernel.ubuntu.com/~kernel-ppa/mainline'
			ReleaseURL="$(echo -n "$MainURL/$KernelVer")"
			KernelBit="$(getconf LONG_BIT)"
			[ "$KernelBit" == '32' ] && KernelBitVer='i386'
			[ "$KernelBit" == '64' ] && KernelBitVer='amd64'
			KernelFile="$(wget -qO- "$ReleaseURL" | awk -F '">|href="' '/generic.*.deb/{print $2}' | grep 'image' | grep "$KernelBitVer" | head -n1)"
			KernelHeaderFile1="$(wget -qO- "$ReleaseURL" | awk -F '">|href="' '/.*.deb/{print $2}' | grep 'headers' | grep "all" | head -n1)"
			KernelHeaderFile2="$(wget -qO- "$ReleaseURL" | awk -F '">|href="' '/generic.*.deb/{print $2}' | grep 'headers' | grep "$KernelBitVer" | head -n1)"
			KernelModuleFile="$(wget -qO- "$ReleaseURL" | awk -F '">|href="' '/generic.*.deb/{print $2}' | grep 'modules' | grep "$KernelBitVer" | head -n1)"
			cd /tmp
			_info "Download New Kernel $KernelVer"
			wget -qO "/tmp/$KernelFile" "$ReleaseURL/$KernelFile"
			wget -qO "/tmp/$KernelHeaderFile1" "$ReleaseURL/$KernelHeaderFile1"
			wget -qO "/tmp/$KernelHeaderFile2" "$ReleaseURL/$KernelHeaderFile2"
			if [[ ! -z $KernelModuleFile ]]; then
				wget -qO "/tmp/$KernelModuleFile" "$ReleaseURL/$KernelModuleFile"
				_execute "dpkg -i /tmp/$KernelModuleFile"
			fi
			_info "Install New Kernel $KernelVer"
			_execute "dpkg -i /tmp/$KernelFile"
			_execute "dpkg -i /tmp/$KernelHeaderFile1"
			_execute "dpkg -i /tmp/$KernelHeaderFile2"
			Newest="$(echo "$KernelFile" | awk -F '_' '{print $1}')"
			KernelList="$(dpkg -l | grep 'linux-image' | awk '{print $2}')"
			[ -z "$(echo $KernelList | grep -o "$Newest")" ] && echo "Install error." && exit 1
			# remove unused kernels
			for KernelTMP in $(echo "$KernelList"); do
				[ "$KernelTMP" != "$Newest" ] && _info "Uninstall Old Kernel $KernelTMP" && DEBIAN_FRONTEND=noninteractive dpkg --purge "$KernelTMP" >/dev/null 2>&1
			done
			[ "$(dpkg --get-selections | grep 'linux-image' | awk '{print $2}' | grep '^install' | wc -l)" != '1' ] && _error "Error, uninstall old Kernel." && _lockCleanup && exit 1
			update-grub >/dev/null 2>&1
		fi
		_info "pre-Loading TCP BBR ..."
		[ ! -f /etc/sysctl.conf ] && touch /etc/sysctl.conf
		sed -i '/net.core.default_qdisc.*/d' /etc/sysctl.conf
		sed -i '/net.ipv4.tcp_congestion_control.*/d' /etc/sysctl.conf
		echo "net.core.default_qdisc=fq" >>/etc/sysctl.conf
		echo "net.ipv4.tcp_congestion_control=bbr" >>/etc/sysctl.conf
	fi
	if [[ $replacekernel == 1 ]]; then
		_warning "The system requires a reboot!"
		_success "${APP_TITLE} installation finished."
	else
		_execute "sysctl -p"
		_success "${APP_TITLE} started."
	fi
}

#################################################################################
# OPT GENERATOR
#################################################################################
if ! ARGS=$(getopt -a -o hk:l: -l help,kernel:,log: -- "$@")
then
    _usage
    exit 1
fi
eval set -- "${ARGS}"
while true; do
	case "$1" in
	-h | --help)
		_usage
		exit 1
		;;
	-l | --log)
		OUTTO="$2"
		shift
		;;
	-k | --kernel)
		replacekernel=1
		KernelVer="$2"
		shift
		;;
	--)
		shift
		break
		;;
	esac
	shift
done

#################################################################################
# MAIN PROCESS
#################################################################################
_lockCheck
_setLock
_installInfo
_main
_lockCleanup
