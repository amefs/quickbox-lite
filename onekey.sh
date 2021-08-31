#!/bin/bash
#
# [QuickBox Lite One Key Installation wrapper ]
#
# GitHub:   https://github.com/amefs/quickbox-lite
# Author:   Amefs
# Current version:  v1.5.0
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
        _error "Do not have root previlage, Please run \"sudo su -\" and try again!"
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
git clone --recursive ${branch} "${URL}" /etc/QuickBox
dos2unix /etc/QuickBox/setup.sh
cd /etc/QuickBox || exit
screen -dmS qbox-install -T xterm 
screen -S qbox-install -X stuff "sleep 3; bash /etc/QuickBox/setup.sh $ExtraArgs;\n"
screen -rA qbox-install