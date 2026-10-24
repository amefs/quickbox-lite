#!/bin/bash
if [ "${QB_ONEKEY_BOOTSTRAP:-0}" != 1 ] && [ "${BASH_SOURCE[0]:-}" = "$0" ] && grep -q $'\r' "$0" 2>/dev/null; then sed 's/\r$//' "$0" >"${0}.$$.tmp" && mv "${0}.$$.tmp" "$0" || exit 1; QB_ONEKEY_BOOTSTRAP=1 exec bash "$0" "$@" ; fi #
#
# [QuickBox Lite One Key Installation wrapper]
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

if [[ $1 == "--dev" ]]; then
    if [[ ! -d /install ]]; then
        mkdir /install/
    fi
    if [[ ! -f /install/.developer.lock ]]; then
        touch /install/.developer.lock
    fi
    branch="--branch development"
    ExtraArgs=${*:2}
elif [[ $1 == "--legacy" ]]; then
    if [[ ! -d /install ]]; then
        mkdir /install/
    fi
    if [[ ! -f /install/.legacy.lock ]]; then
        touch /install/.legacy.lock
    fi
    branch="--branch legacy"
    ExtraArgs=${*:2}
else
    ExtraArgs=${*:1}
fi

_norm=$(tput sgr0)
_red=$(tput setaf 1)
_green=$(tput setaf 2)
_tan=$(tput setaf 3)
_cyan=$(tput setaf 6)

function _print() {
	printf "${_norm}%s${_norm}\n" "$@"
}
function _info() {
	printf "${_cyan}➜ %s${_norm}\n" "$@"
}
function _success() {
	printf "${_green}✓ %s${_norm}\n" "$@"
}
function _warning() {
	printf "${_tan}⚠ %s${_norm}\n" "$@"
}
function _error() {
	printf "${_red}✗ %s${_norm}\n" "$@"
}

function _checkroot() {
	if [[ $EUID != 0 ]]; then
        _error "You do not have root privileges, please run \"sudo su -\" and try again!"
		exit 1
	fi
}

_checkroot
DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update
DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade

if [ "$?" -eq 2 ]; then
    _warning "dpkg database is locked."
    _info "fixing dpkg lock..."
    rm -f /var/lib/dpkg/updates/0*
    locks=$(find /var/lib/dpkg/lock* && find /var/cache/apt/archives/lock*)
    if [[ ${locks} == $(find /var/lib/dpkg/lock* && find /var/cache/apt/archives/lock*) ]]; then
        for l in ${locks}; do
            rm -rf "${l}"
        done
        dpkg --configure -a
        DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update >/dev/null 2>&1
        DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade >/dev/null 2>&1
    fi
    if [ "$?" -eq 2 ]; then
        _error "unable to resolve dpkg lock, exit...."
        exit 1
    fi
fi

apt-get -yqq install git lsb-release dos2unix screen
if [[ -d /etc/QuickBox ]]; then
    rm -rf /etc/QuickBox
fi
URL="https://github.com/amefs/quickbox-lite.git"
# shellcheck disable=SC2086
git clone --recursive ${branch} "${URL}" /etc/QuickBox || exit 1
# Restore executable bits and LF endings before the installer reads any tracked
# file. Older branches without this helper still get the setup.sh conversion.
normalize_helper=/etc/QuickBox/packages/system/auxiliary/qbNormalizeRepo
if [[ -s "${normalize_helper}" ]]; then
    normalize_script=$(sed 's/\r$//' "${normalize_helper}") || exit 1
    QB_NORMALIZE_BOOTSTRAP=1 QB_NORMALIZE_RUN=1 \
        bash -c "${normalize_script}" _ /etc/QuickBox || exit 1
else
    dos2unix /etc/QuickBox/setup.sh
fi
cd /etc/QuickBox || exit
screen -dmS qbox-install -T xterm 
screen -S qbox-install -X stuff "sleep 3; bash /etc/QuickBox/setup.sh $ExtraArgs;\n"
screen -rA qbox-install
