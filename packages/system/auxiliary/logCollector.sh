#!/bin/bash
#
# [QuickBox Lite System Log Generator]
#
# GitHub:   https://github.com/amefs/quickbox-lite
# Author:   Amefs
# Current version:  v1.3.4
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
################################################################################
#
# VARIABLES
#
_bold=$(tput bold)
_underline=$(tput sgr 0 1)
_standout=$(tput smso)
_reset=$(tput sgr0)

_purple=$(tput setaf 171)
_red=$(tput setaf 1)
_green=$(tput setaf 2)
_yellow=$(tput setaf 3)
_blue=$(tput setaf 4)
_magenta=$(tput setaf 5)
_cyan=$(tput setaf 6)

#
# Info functions
#
function _success() {
	printf "${_green}✓ %s${_norm}\n" "$@"
}

function _error() {
	printf "${_red}✗ %s${_norm}\n" "$@"
}

function _warning() {
	printf "${_yellow}⚠ %s${_norm}\n" "$@"
}

function _underline() {
	printf "${_underline}${_bold}%s${_reset}\n" "$@"
}

function _bold() {
	printf "${_bold}%s${_reset}\n" "$@"
}

function _note() {
	printf "${_underline}${_bold}${_blue}Note:${_reset}  ${_blue}%s${_reset}\n" "$@"
}

function _die() {
	_error "$@"
	exit 1
}

function _safeExit() {
	exit 0
}

function _write() {
	echo "$1" >>"${LOGFILE}" 2>&1
}

#
# Utility Functions
#
function _isRoot() {
	if [[ "$(id -u)" != "0" ]]; then
		_die "This script must be run as root!"
	fi
}

function _getOs() {
	[ -f /etc/os-release ] && awk -F'[= "]' '/PRETTY_NAME/{print $3,$4,$5}' /etc/os-release && return
	[ -f /etc/lsb-release ] && awk -F'[="]+' '/DESCRIPTION/{print $2}' /etc/lsb-release && return
}

function initDir() {
	rm -rf ${QB_LOG_DIR} >/dev/null 2>&1
	rm -f ${QB_LOG_FILE} >/dev/null 2>&1
	mkdir -p ${QB_LOG_DIR}
	mkdir -p ${QB_LOG_DIR}/mount
	mkdir -p ${QB_LOG_DIR}/network
	mkdir -p ${QB_LOG_DIR}/pkg
	mkdir -p ${QB_LOG_DIR}/service
	mkdir -p ${QB_LOG_DIR}/syslog
	mkdir -p ${QB_LOG_DIR}/nginx
}

function generateSystemInfo() {
	# System Info
	cname=$(awk -F: '/model name/ {name=$2} END {print name}' /proc/cpuinfo | sed 's/^[ \t]*//;s/[ \t]*$//')
	cores=$(awk -F: '/model name/ {core++} END {print core}' /proc/cpuinfo)
	freq=$(awk -F: '/cpu MHz/ {freq=$2} END {print freq}' /proc/cpuinfo | sed 's/^[ \t]*//;s/[ \t]*$//')
	tram=$(free -m | awk '/Mem/ {print $2}')
	uram=$(free -m | awk '/Mem/ {print $3}')
	swap=$(free -m | awk '/Swap/ {print $2}')
	uswap=$(free -m | awk '/Swap/ {print $3}')
	up=$(awk '{a=$1/86400;b=($1%86400)/3600;c=($1%3600)/60} {printf("%d days, %d hour %d min\n",a,b,c)}' /proc/uptime)
	load=$(w | head -1 | awk -F'load average:' '{print $2}' | sed 's/^[ \t]*//;s/[ \t]*$//')
	opsy=$(_getOs)
	arch=$(uname -m)
	lbit=$(getconf LONG_BIT)
	kern=$(uname -r)
	qb_version=$(cat /root/.bash_qb | grep -Eo "QUICKBOX_VERSION=v.*" | grep -Eo "[0-9.]+" | head -n 1)

	# Write system info to file
	LOGFILE=${QB_LOG_DIR}/system-info.txt
	_write "General System Info:"
	_write "------------------------------------"
	_write "CPU model            : $cname"
	_write "Number of cores      : $cores"
	_write "CPU frequency        : $freq MHz"
	_write "Total amount of Mem  : $tram MB ($uram MB Used)"
	_write "Total amount of Swap : $swap MB ($uswap MB Used)"
	_write "System uptime        : $up"
	_write "Load average         : $load"
	_write "OS                   : $opsy"
	_write "Arch                 : $arch ($lbit Bit)"
	_write "Kernel               : $kern"
	_write "Installed QuickBox   : $qb_version"
	_success "General system info generated"
}

function generateMountsInfo() {
	LOGDIR="${QB_LOG_DIR}/mount"
	LOGFILE=${QB_LOG_DIR}/mount/mounts.txt
	# Physical device
	mount >${LOGFILE}
	echo "" >>${LOGFILE}
	df -h >>${LOGFILE}

	# LVM
	if command -v lvdisplay >/dev/null; then
		lvdisplay >${LOGDIR}/lvdisplay.txt
		vgdisplay >${LOGDIR}/vgdisplay.txt
		pvdisplay >${LOGDIR}/pvdisplay.txt
	fi
	_success "Mount info generated"
}

function generateNwtworkInfo() {
	LOGFILE=${QB_LOG_DIR}/network/network-info.txt
	wanIP=$(curl -s http://whatismyip.akamai.com/)
	_write "Network Info:"
	_write "------------------------------------"
	_write "Your Public IP address is: ${wanIP}"
	_write "------------------------------------"
	_write "Server Interface Info:"
	ifconfig >>"${LOGFILE}" 2>&1
	/sbin/iptables -nvL -t filter >${QB_LOG_DIR}/network/iptables-filter.txt
	/sbin/iptables -nvL -t nat >${QB_LOG_DIR}/network/iptables-nat.txt
	_success "Network info generated"
}

function generatePkgInfo() {
	dpkg --list >${QB_LOG_DIR}/pkg/pkglist.txt 2>&1
	_success "Pkg info generated"
}

function generateServiceInfo() {
	/bin/systemctl list-units >${QB_LOG_DIR}/service/services.txt 2>&1
	/bin/journalctl -p 3 -xb >${QB_LOG_DIR}/service/services-journal.txt 2>&1
	_success "Service info generated"
}

function collectSyslog() {
	LOGDIR="${QB_LOG_DIR}/syslog"
	for entry in syslog messages; do
		[ -e "/var/log/${entry}" ] && cp -fR /var/log/${entry} ${LOGDIR}/
	done
	if [ -e "/var/log/dmesg" ]; then
		cp -f /var/log/dmesg "${LOGDIR}/dmesg.boot"
	fi
	dmesg >"${LOGDIR}/dmesg.current"
	dmesg --ctime >"${LOGDIR}/dmesg.human.current"
	cp /srv/dashboard/db/output.log ${LOGDIR}/quickbox.apps.log
	_success "System log collected"
}

function testNginx() {
	LOGDIR="${QB_LOG_DIR}/nginx"
	LOGFILE=${QB_LOG_DIR}/nginx/nginx-test.txt
	_write "Nginx Test Log"
	_write "------------------------------------"
	nginx -t >>"${LOGFILE}" 2>&1
	_write "------------------------------------"
	_write ""
	_write "Nginx Service Log"
	_write "------------------------------------"
	/bin/systemctl restart nginx >>"${LOGFILE}" 2>&1
	_write ""
	/bin/systemctl status nginx >>"${LOGFILE}" 2>&1
	if [ -e "/var/log/nginx/access.log" ]; then
		cp -f /var/log/nginx/access.log "${LOGDIR}/access.log"
	fi
	if [ -e "/var/log/nginx/error.log" ]; then
		cp -f /var/log/nginx/error.log "${LOGDIR}/error.log"
	fi
	cp -r /etc/nginx ${LOGDIR}/conf
	_success "Nginx tested"
}

pack() {
	cd ${QB_LOG_DIR} || { _error "QuickBox Log directory not exist" && exit 1; }
	/bin/tar -czf ${QB_LOG_FILE} ./* >/dev/null 2>&1
	rm -rf ${QB_LOG_DIR}
	echo "${_red}${_bold}${QB_LOG_FILE} ${_reset}created"
}

function generateLog() {
	_isRoot
	echo "------------------------------------"
	echo "       QuickBox Log Collector       "
	echo "------------------------------------"
	echo "This script will help you generate a"
	echo "compressed file contains all        "
	echo "necessary debug infos.              "
	echo ""
	initDir
	generateSystemInfo
	generateMountsInfo
	generateNwtworkInfo
	generatePkgInfo
	generateServiceInfo
	collectSyslog
	testNginx
	pack
}

# Excute Log Collector
QB_LOG_DIR=/root/qbLog
QB_LOG_FILE=/root/qbLog.tar.gz
generateLog
