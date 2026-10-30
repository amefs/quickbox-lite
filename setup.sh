#!/bin/bash
# File-level ShellCheck directives must precede the CRLF bootstrap.
# shellcheck disable=SC2046,SC1090,SC2181,SC2059
if [ "${QB_SETUP_BOOTSTRAP:-0}" != 1 ] && [ "${BASH_SOURCE[0]:-}" = "$0" ] && grep -q $'\r' "$0" 2>/dev/null; then sed 's/\r$//' "$0" >"${0}.$$.tmp" && mv "${0}.$$.tmp" "$0" || exit 1; QB_SETUP_BOOTSTRAP=1 exec bash "$0" "$@" ; fi #
#
# [QuickBox Lite Installation Guide Script]
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

function _defaultcolor() {
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
}

function _errorcolor() {
	export NEWT_COLORS='
root=,black
window=,white
shadow=,color8
title=red,
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
}

_norm=$(tput sgr0)
_red=$(tput setaf 1)
_green=$(tput setaf 2)
_tan=$(tput setaf 3)
_cyan=$(tput setaf 6)

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

function _optional_failure() {
	optional_failures+=("$*")
	printf 'Warning: %s\n' "$*" >&2
	printf 'Warning: %s\n' "$*" >>"${OUTTO}" 2>/dev/null || true
}

function _prepare_runtime() {
	_defaultcolor
	local_prefix="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/" || return 1
	local_lang=${local_prefix}setup/lang/
	if [[ ! -r ${local_lang}en.lang || ! -r ${local_lang}zh-cn.lang ]]; then
		_error "Setup language resources are missing: $local_lang"
		return 1
	fi
	if [[ ":$PATH:" != *:/usr/sbin:* ]]; then
		export PATH="$PATH:/usr/local/sbin:/usr/sbin:/sbin"
	fi
}

function _ensure_setup_tools() {
	local tool
	local -a required=(jq whiptail) missing=()
	if [[ $config_file =~ ^https?:// || $config_gen_mode == 0 ]]; then
		required+=(curl)
	fi
	for tool in "${required[@]}"; do
		command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
	done
	((${#missing[@]})) || return 0
	if [[ $EUID != 0 ]] || ! command -v apt-get >/dev/null 2>&1; then
		_error "Missing setup tools: ${missing[*]}. Install them before running setup."
		return 1
	fi
	_info "Installing required setup tools: ${missing[*]}"
	apt-get update || printf 'Warning: apt update failed; trying available package indexes\n' >&2
	if ! DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"; then
		printf 'Warning: setup tool installation failed; checking available tools\n' >&2
	fi
	for tool in "${missing[@]}"; do
		if ! command -v "$tool" >/dev/null 2>&1; then
			_error "Required setup tool is still missing: $tool"
			return 1
		fi
	done
}

function _load_language() {
	case "$uilang" in
	zh) source "${local_lang}zh-cn.lang" || return 1 ;;
	*) source "${local_lang}en.lang" || return 1 ;;
	esac
}

function _local_ip() {
	ip addr show 2>/dev/null | awk '/inet / && $2 !~ /^127\./ {sub(/\/.*/, "", $2); print $2; exit}'
}

function _init() {

	# initialization environment
	local_prefix=/etc/QuickBox/
	local_setup_script=${local_prefix}setup/scripts/
	local_setup_template=${local_prefix}setup/templates/
	local_setup_dashboard=${local_prefix}setup/dashboard/
	local_packages=${local_prefix}packages/
	local_lang=${local_prefix}setup/lang/
	if [[ ! -d /install ]]; then
		mkdir -p /install || return 1
	fi
	if [[ ! -d /tmp ]]; then
		mkdir -p /tmp || return 1
	fi
	DISTRO=$(lsb_release -is) || return 1
	CODENAME=$(lsb_release -cs) || return 1
	OSARCH=$(dpkg --print-architecture) || return 1
	#RELEASE=$(lsb_release -rs)
	#SETNAME=$(lsb_release -rc)
	export LANG="en_US.UTF-8" >/dev/null 2>&1
	export LC_ALL="en_US.UTF-8" >/dev/null 2>&1
	export LANGUAGE="en_US.UTF-8" >/dev/null 2>&1
	if (! export | grep -q sbin); then
		export PATH=$PATH:/usr/local/sbin:/usr/sbin:/sbin
	fi
	local normalize_helper="${local_prefix}packages/system/auxiliary/qbNormalizeRepo"
	if [[ ! -s "${normalize_helper}" ]]; then
		_error "Repository normalizer is missing or empty: ${normalize_helper}"
		exit 1
	fi
	# Strip CR before bash parses the helper: a CRLF shebang cannot be executed
	# directly, and bash cannot parse the helper's own self-heal in CRLF form.
	local normalize_script
	normalize_script=$(sed 's/\r$//' "${normalize_helper}") || exit 1
	if ! QB_NORMALIZE_BOOTSTRAP=1 QB_NORMALIZE_RUN=1 \
		bash -c "${normalize_script}" _ "${local_prefix}"; then
		_error "Failed to normalize the QuickBox repository (file modes or line endings)."
		exit 1
	fi
	{
		# prepare scripts
		echo -e "XXX\n00\nPreparing scripts... \nXXX"
		# install base packages
		DEBIAN_FRONTEND=noninteractive apt-get -qq -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update >/dev/null 2>&1
		echo -e "XXX\n10\nPreparing scripts... \nXXX"
		if [[ $DISTRO == Ubuntu && $CODENAME =~ ("bionic"|"focal") ]]; then
			apt-get -y install git curl wget dos2unix python apt-transport-https dnsutils unzip jq >/dev/null 2>&1
		elif [[ $DISTRO == Ubuntu && $CODENAME =~ ("jammy"|"noble") ]]; then
			apt-get -y install git curl wget dos2unix python3 apt-transport-https dnsutils unzip jq >/dev/null 2>&1
		elif [[ $DISTRO == Debian && $CODENAME =~ ("bullseye"|"bookworm")  ]]; then
			apt-get -y install git curl wget dos2unix python3 apt-transport-https gnupg2 ca-certificates dnsutils unzip jq >/dev/null 2>&1
		elif [[ $DISTRO == Debian && $CODENAME =~ ("trixie")  ]]; then
			apt-get -y install git curl wget dos2unix python3 apt-transport-https gnupg2 ca-certificates bind9-dnsutils unzip jq >/dev/null 2>&1
		fi
		echo -e "XXX\n20\nPreparing scripts... \nXXX"
		if [[ -d /usr/local/bin/quickbox ]]; then
			rm -rf /usr/local/bin/quickbox
		fi
		ln -s ${local_packages} /usr/local/bin/quickbox || return 1
		echo -e "XXX\n30\nPreparing scripts... Done.\nXXX"
		sleep 0.5

		# install net-tools for IP detection
		echo -e "XXX\n30\nGetting network status... \nXXX"
		apt-get -qq -y install net-tools >/dev/null 2>&1
		echo -e "XXX\n50\nGetting network status... Done.\nXXX"
		sleep 0.5

		# remove Apache
		echo -e "XXX\n50\nClean up the environment for installation... \nXXX"
		systemctl stop apache2 >/dev/null 2>&1
		systemctl disable apache2 >/dev/null 2>&1
		APACHE_PKGS='apache2 apache2-bin apache2-data'
		for depend in $APACHE_PKGS; do
			DEBIAN_FRONTEND=noninteractive apt-get -y remove "${depend}" >/dev/null 2>&1
			DEBIAN_FRONTEND=noninteractive apt-get -y purge "${depend}" >/dev/null 2>&1
		done
		apt-get -y autoclean >/dev/null 2>&1
		echo -e "XXX\n70\nClean up the environment for installation... Done.\nXXX"
		sleep 0.5

		# setup location infomation
		echo -e "XXX\n70\nSetting up location... \nXXX"
		if (grep -q "en_US.UTF-8 UTF-8" /etc/locale.gen >/dev/null 2>&1); then
			sed -i "s/#\s*en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/g" /etc/locale.gen
		else
			echo "en_US.UTF-8 UTF-8" >>/etc/locale.gen
		fi
		if (grep -q "zh_CN.UTF-8 UTF-8" /etc/locale.gen >/dev/null 2>&1); then
			sed -i "s/#\s*zh_CN.UTF-8 UTF-8/zh_CN.UTF-8 UTF-8/g" /etc/locale.gen
		else
			echo "zh_CN.UTF-8 UTF-8" >>/etc/locale.gen
		fi
		apt-get update -y -q >/dev/null 2>&1
		apt-get install locales -y -q >/dev/null 2>&1
		locale-gen >/dev/null 2>&1
		DEBIAN_FRONTEND=noninteractive dpkg-reconfigure locales >/dev/null 2>&1
		echo -e "XXX\n100\nInitialization Finished\nXXX"
		sleep 1
	} | whiptail --title "Initialization" --gauge "Initializing installation" 8 64 0
	local -a init_status=("${PIPESTATUS[@]}")
	if [[ ${init_status[0]} != 0 ]]; then
		_error "Initialization failed (worker=${init_status[0]}, progress UI=${init_status[1]})."
		return 1
	fi
	[[ ${init_status[1]} == 0 ]] || printf 'Warning: initialization progress UI failed\n' >&2
}

function _selectlang() {
	local menu_choice
	menu_choice=$(
		whiptail --title "Installation Language" --menu "Choose a language" --nocancel 12 72 4 \
			"English" "        Install with English" \
			"Chinese Simpified" "        安装为简体中文" 3>&1 1>&2 2>&3
	)
	case $menu_choice in
	"English")
		uilang="en"
		;;
	"Chinese Simpified")
		uilang="zh"
		;;
	esac
	_load_language
}

function _apply_locale() {
	local selected_locale=en_US.UTF-8
	[[ $uilang == zh ]] && selected_locale=zh_CN.UTF-8
	printf 'LANGUAGE="%s"\nLC_ALL="%s"\n' "$selected_locale" "$selected_locale" >>/etc/default/locale || return 1
	DEBIAN_FRONTEND=noninteractive dpkg-reconfigure locales
}

function _checkroot() {
	if [[ $EUID != 0 ]]; then
		_errorcolor
		whiptail --title "$ERROR_TITLE_PERM" --msgbox "$ERROR_TEXT_PERM" --ok-button "$BUTTON_OK" 8 72
		_defaultcolor
		exit 1
	fi
}

function _checkdistro() {
	if [[ ! "$DISTRO" =~ ("Ubuntu"|"Debian") ]]; then
		_errorcolor
		whiptail --title "$ERROR_TITLE_OS" --msgbox "${ERROR_TEXT_DESTRO_1}${DISTRO}${ERROR_TEXT_DESTRO_2}" --ok-button "$BUTTON_OK" 8 72
		_defaultcolor
		exit 1
	elif [[ ! "$CODENAME" =~ ("bullseye"|"focal"|"jammy"|"bookworm"|"noble"|"trixie") ]]; then
		_errorcolor
		whiptail --title "$ERROR_TITLE_OS" --msgbox "${ERROR_TEXT_CODENAME_1}${DISTRO}${ERROR_TEXT_CODENAME_2}" --ok-button "$BUTTON_OK" 8 72
		_defaultcolor
		exit 1
	elif [[ "$OSARCH" != "amd64" ]]; then
		_errorcolor
		whiptail --title "$ERROR_TITLE_OS" --msgbox "$ERROR_TEXT_OSARCH" --ok-button "$BUTTON_OK" 8 72
		_defaultcolor
		exit 1
	fi
}

function _checkkernel() {
	local kernel=0
	grsec=$(uname -a | grep -i grs)
	if [[ -n $grsec ]]; then
		_errorcolor
		whiptail --title "$ERROR_TITLE_KERNEL" --msgbox "${ERROR_TEXT_KERNEL_1}$(uname -r)\n${ERROR_TEXT_KERNEL_2}" --ok-button "$BUTTON_OK" 8 72
		_defaultcolor
		if (whiptail --title "$INFO_TITLE_REPLACE_KERNEL" --yesno "$INFO_TEXT_REPLACE_KERNEL" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
			whiptail --title "$INFO" --msgbox "$INFO_TEXT_REPLACE_KERNEL_CONFIRM" --ok-button "$BUTTON_OK" 8 72
			kernel=1
		else
			whiptail --title "$INFO_TITLE_EXIT" --msgbox "$INFO_TEXT_ABORT" --ok-button "$BUTTON_OK" 6 72
			kernel=0
			exit 0
		fi

		if [[ $kernel == 1 ]]; then
			if [[ $DISTRO == Ubuntu ]]; then
				apt-get install -q -y linux-image-generic >>/dev/null 2>&1 || return 1
			elif [[ $DISTRO == Debian ]]; then
				arch=$(uname -m)
				if [[ $arch =~ ("i686"|"i386") ]]; then
					apt-get install -q -y linux-image-686 >>/dev/null 2>&1 || return 1
				elif [[ $arch == x86_64 ]]; then
					apt-get install -q -y linux-image-amd64 >>/dev/null 2>&1 || return 1
				fi
			fi
			if [[ -e /etc/grub.d/06_OVHkernel ]]; then
				mv /etc/grub.d/06_OVHkernel /etc/grub.d/25_OVHkernel || return 1
			fi
			update-grub >>/dev/null 2>&1 || return 1
		fi
	fi
}

function _checkovz() {
	if [[ -d /proc/vz ]]; then
		whiptail --title "$ERROR_TITLE_OVZ" --msgbox "$ERROR_TEXT_OVZ" --ok-button "$BUTTON_OK" 6 72
		exit 1
	fi
}

function _welcome() {
	whiptail --title "$INFO_TITLE_WELCOME" --msgbox "$INFO_TEXT_WELCOME" --ok-button "$BUTTON_OK" 8 72
	# Manual
	whiptail --title "$INFO_TITLE_MANUAL" --msgbox "$INFO_TEXT_MANUAL" --ok-button "$BUTTON_OK" 12 72
	# Disclaimer
	if (! whiptail --title "$INFO_TITLE_DISCLAIMER" --yesno "$INFO_TEXT_DISCLAIMER" --yes-button "$BUTTON_ACCEPT" --no-button "$BUTTON_DECLINE" 12 72); then
		exit 1
	fi
}

function _logcheck() {
	if (whiptail --title "$INFO_TITLE_LOG" --yesno "$INFO_TEXT_LOG" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
		OUTTO="/root/quickbox.$PPID.log"
	else
		OUTTO="/dev/null 2>&1"
	fi
}

function _get_ip() {
	ip=$(curl -s https://ipinfo.io/ip)
	[[ -z ${ip} ]] && ip=$(curl -s https://api.ip.sb/ip)
	[[ -z ${ip} ]] && ip=$(curl -s https://api.ipify.org)
	[[ -z ${ip} ]] && ip=$(curl -s https://ip.seeip.org)
	[[ -z ${ip} ]] && ip=$(curl -s https://ifconfig.co/ip)
	[[ -z ${ip} ]] && ip=$(curl -s https://api.myip.com | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}")
	[[ -z ${ip} ]] && ip=$(curl -s icanhazip.com)
	[[ -z ${ip} ]] && ip=$(curl -s myip.ipip.net | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}")
}

function _askdomain() {
	if (whiptail --title "$INFO_TITLE_DOMAIN" --yesno "$INFO_TEXT_DOMAIN" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" --defaultno 8 72); then
		while [[ $domain == "" ]]; do
			domain=$(whiptail --title "$INFO_TITLE_SETDOMAIN" --inputbox "$INFO_TEXT_SETDOMAIN" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
			_validate_domain "$domain" || domain=""
		done
		hostname=$domain
		lecert_domain=$domain
	else
		domain=""
		lecert_domain=""
	fi
}

function _askhostname() {
	hostname=$(whiptail --title "$INFO_TITLE_HOSTNAME" --inputbox "$INFO_TEXT_HOSTNAME" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
}

function _chhostname() {
	if [[ $hostname != "" ]]; then
		old_hostname=$(cat /etc/hostname)
		printf '%s\n' "${hostname}" >/etc/hostname || return 1
		sed -i "s/127.0.1.1\s*${old_hostname}/127.0.1.1	${hostname}/g" /etc/hosts >>"${OUTTO}" 2>&1
		sed -i "/127.0.0.1\s*localhost/a 127.0.0.1	${hostname}" /etc/hosts >>"${OUTTO}" 2>&1
	fi
	return 0
}

function _askchport() {
	chport=""
	while [[ $chport == "" ]]; do
		chport=$(
			whiptail --title "$INFO_TITLE_SSH" --radiolist \
				"$INFO_TEXT_SSH" 12 40 4 \
				"default" "$CHOICE_TEXT_SSH_1" off \
				"4747" "$CHOICE_TEXT_SSH_2" on \
				"other" "$CHOICE_TEXT_SSH_3" off \
				--ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3
		)
		if [[ $chport == "other" ]]; then
			port=$(whiptail --title "$INFO_TITLE_SSH" --inputbox "$INPUT_TEXT_SSH" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
			if _check_port "$port"; then
				chport="$port"
			else
				chport=""
				whiptail --title "$ERROR_TITLE_SSH" --msgbox "$ERROR_TEXT_SSH" --ok-button "$BUTTON_OK" 10 72
			fi
		fi
	done
}

function _changeport() {
	echo "Port $chport" >>/etc/ssh/sshd_config.d/10-quickbox.conf || return 1
	service ssh restart >>"${OUTTO}" 2>&1
}

function _askusrname() {
	local valid=false
	local rc
	while [[ $valid == false ]]; do
		username=$(whiptail --title "$INFO_TITLE_NAME" --inputbox "$INFO_TEXT_NAME" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 8 72 3>&1 1>&2 2>&3)
		_check_username "$username"
		rc=$?
		_errorcolor
		case $rc in
		1)
			whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_1" --ok-button "$BUTTON_OK" 8 72
			valid=false
			;;
		2)
			whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_2" --ok-button "$BUTTON_OK" 8 72
			valid=false
			;;
		3)
			whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_3" --ok-button "$BUTTON_OK" 10 72
			valid=false
			;;
		*)
			valid=true
			;;
		esac
		_defaultcolor
	done
}

function _askpasswd() {
	local valid=false
	local rc
	while [[ $valid == false ]]; do
		password=$(whiptail --title "$INFO_TITLE_PASSWD" --passwordbox "$INFO_TEXT_PASSWD" 8 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
		_check_password "$password"
		rc=$?
		_errorcolor
		case $rc in
		1)
			whiptail --title "$ERROR_TITLE_PASSWD" --msgbox "$ERROR_TEXT_PASSWD_1" --ok-button "$BUTTON_OK" 8 72
			valid=false
			;;
		2)
			whiptail --title "$ERROR_TITLE_PASSWD" --msgbox \
				"$ERROR_TEXT_PASSWD_2" --ok-button "$BUTTON_OK" 10 72
			valid=false
			;;
		*)
			valid=true
			;;
		esac
		_defaultcolor
	done
}

function _cf() {
	DOMAIN="deb.ezapi.net"
	SUBFOLDER=""
	SUFFIX=""
}

function _sf() {
	DOMAIN="sourceforge.net"
	SUBFOLDER="projects/seedbox-software-for-linux/files/"
	SUFFIX="/download"
}

function _osdn() {
	DOMAIN="osdn.dl.osdn.net"
	SUBFOLDER="storage/g/s/se/seedbox-software-for-linux/"
	SUFFIX=""
}

function _github() {
	DOMAIN="raw.githubusercontent.com"
	SUBFOLDER="amefs/quickbox-files/master/"
	SUFFIX=""
}

function _skel() {
	echo -e "XXX\n17\n$INFO_TEXT_PROGRESS_3_1\nXXX"
	mkdir -p /etc/skel
	cp -rf ${local_setup_template}skel /etc
	# init download url
	case "${cdn}" in
	"cf")
		_cf
		echo "cf" > /install/.cdn.lock
		wget -t3 -T20 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
		if [ $? -ne 0 ]; then
			_sf
			wget -t5 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			if [ $? -ne 0 ]; then
				_osdn
				wget -t5 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			fi
		fi
		;;
	"sf")
		_sf
		echo "cf" > /install/.cdn.lock
		wget -t3 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
		if [ $? -ne 0 ]; then
			_cf
			wget -t5 -T20 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			if [ $? -ne 0 ]; then
				_osdn
				wget -t5 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			fi
		fi
		;;
	"osdn")
		_osdn
		echo "osdn" > /install/.cdn.lock
		wget -t3 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
		if [ $? -ne 0 ]; then
			_cf
			wget -t5 -T20 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			if [ $? -ne 0 ]; then
				_sf
				wget -t5 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			fi
		fi
		;;
	"github")
		_github
		echo "github" > /install/.cdn.lock
		wget -t3 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
		if [ $? -ne 0 ]; then
			_cf
			wget -t5 -T20 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			if [ $? -ne 0 ]; then
				_sf
				wget -t5 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			fi
		fi
		;;
	*)
		_github
		echo "github" > /install/.cdn.lock
		wget -t3 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
		if [ $? -ne 0 ]; then
			_cf
			wget -t5 -T20 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			if [ $? -ne 0 ]; then
				_sf
				wget -t5 -T10 -q -O GeoLiteCity.dat.gz "https://${DOMAIN}/${SUBFOLDER}all-platform/GeoLiteCity.dat.gz${SUFFIX}"
			fi
		fi
		;;
	esac
	gunzip GeoLiteCity.dat.gz >/dev/null 2>&1
	mkdir -p /usr/share/GeoIP
	rm -rf GeoLiteCity.dat.gz
	mv GeoLiteCity.dat /usr/share/GeoIP/GeoIPCity.dat
	(
		echo y
		echo o conf prerequisites_policy follow
		echo o conf commit
	) >/dev/null 2>&1 | cpan Digest::SHA1 >>"${OUTTO}" 2>&1
	(
		echo y
		echo o conf prerequisites_policy follow
		echo o conf commit
	) >/dev/null 2>&1 | cpan Digest::SHA >>"${OUTTO}" 2>&1
}

function _lshell() {
	echo -e "XXX\n18\n$INFO_TEXT_PROGRESS_3_2\nXXX"
	apt-get -y install lshell >/dev/null 2>&1
	cp ${local_setup_template}lshell/lshell.conf.template /etc/lshell.conf
}

function _genadmin() {
	# add skel template
	_skel || _optional_failure "Account skeleton could not be prepared"
	# add limit shell
	_lshell || _optional_failure "lshell could not be installed"
	echo -e "XXX\n19\n$INFO_TEXT_PROGRESS_3\nXXX"
	# save account info to file
	local passphrase encrypted_password password_hash
	passphrase=$(openssl rand -hex 64) || return 1
	encrypted_password=$(printf '%s\n' "$password" | openssl enc -aes-128-ecb -pbkdf2 -a -e -pass pass:"${passphrase}" -nosalt) || return 1
	echo "${username}:${encrypted_password}" >/root/.admin.info || return 1
	mkdir -p /root/.qbuser
	cp /root/.admin.info /root/.qbuser/"${username}".info || return 1
	mkdir -p /root/.ssh
	echo "${passphrase}" >/root/.ssh/local_user || return 1
	chmod 600 /root/.ssh/local_user && chmod 700 /root/.ssh || return 1
	# create account
	if [[ -d /home/$username ]]; then
		cd /etc/skel || exit 1
		cp -fR . /home/"${username}"/
	else
		useradd "${username}" -m -G www-data -s /bin/bash || return 1
	fi
	chpasswd <<<"${username}:${password}" || return 1
	password_hash=$(openssl passwd -apr1 "$password") || return 1
	echo "${username}:${password_hash}" >/etc/htpasswd || return 1
	mkdir -p /etc/htpasswd.d/
	echo "${username}:${password_hash}" >/etc/htpasswd.d/htpasswd."${username}" || return 1
	chown -R "${username}":"${username}" /home/"${username}" || return 1
	chmod 750 /home/"${username}"
	echo "D /var/run/${username} 0750 ${username} ${username} -" >>/etc/tmpfiles.d/"${username}".conf
	systemd-tmpfiles /etc/tmpfiles.d/"${username}".conf --create >>"${OUTTO}" 2>&1
	# setup sudoers
	if ! bash /usr/local/bin/quickbox/system/auxiliary/qbEnsureSudoers \
		"${local_setup_template}sudoers.template"; then
		echo ">> Failed to install the dashboard sudoers policy" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if grep "${username}" /etc/sudoers.d/quickbox >/dev/null 2>&1; then
		echo "No sudoers modification made ... " >>"${OUTTO}" 2>&1
	else
		echo "${username} ALL=(ALL:ALL) ALL" >>/etc/sudoers.d/quickbox || return 1
	fi
	chmod 0440 /etc/sudoers.d/quickbox 2>/dev/null || true
	# setup bash custom
	if [ ! -f /root/.bash_qb ]; then
		cat >>/root/.bashrc <<'EOF'

if [ -f ~/.bash_qb ]; then
    . ~/.bash_qb
fi
EOF
		cp ${local_setup_template}bash_qb.template /root/.bash_qb
		cp ${local_setup_template}bash_qb_extras.template /root/.bash_qb_extras
	fi
	# set home permission
	chmod 755 /home/"${username}"
	return 0
}

function _askvsftpd() {
	ip=$(_local_ip)
	if (whiptail --title "$INFO_TITLE_FTP" --yesno "$INFO_TEXT_FTP" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
		ftp=1
		ftp_ip=""
		ftp_ip=$(whiptail --title "$INFO_TITLE_FTP_IP" --inputbox "${INFO_TEXT_FTP_IP_1} ${ip}\n${INFO_TEXT_FTP_IP_2}" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
		if [[ $ftp_ip == "" ]]; then ftp_ip=${ip}; fi
	else
		ftp=0
	fi
}

function _setvsftpd() {
	apt-get -y install vsftpd >>"${OUTTO}" 2>&1
	systemctl stop vsftpd >/dev/null 2>&1
	cp ${local_setup_template}openssl.cnf.template /root/.openssl.cnf
	openssl req -config /root/.openssl.cnf -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/vsftpd.pem -out /etc/ssl/private/vsftpd.pem >/dev/null 2>&1
	cp ${local_setup_template}vsftpd/vsftpd.conf.template /etc/vsftpd.conf
	sed -i 's/^\(pasv_min_port=\).*/\110090/' /etc/vsftpd.conf
	sed -i 's/^\(pasv_max_port=\).*/\110100/' /etc/vsftpd.conf
	echo "pasv_address=$ftp_ip" >>/etc/vsftpd.conf
	iptables -I INPUT -p tcp --destination-port 10090:10100 -j ACCEPT >>"${OUTTO}" 2>&1
	echo "" >/etc/vsftpd.chroot_list
	systemctl start vsftpd >/dev/null 2>&1
}

function _askdashtheme() {
	dash_theme=""
	while [[ $dash_theme == "" ]]; do
		dash_theme=$(
			whiptail --title "$INFO_TITLE_THEME" --radiolist \
				"$INFO_TEXT_THEME" 12 48 4 \
				"defaulted" "$CHOICE_TEXT_THEME_1" off \
				"smoked" "$CHOICE_TEXT_THEME_2" on \
				3>&1 1>&2 2>&3
		)
	done
}

function _askchangetz() {
	if (whiptail --title "$INFO_TITLE_TZ" --yesno "$INFO_TEXT_TZ" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" --defaultno 8 72); then
		local selected
		while true; do
			selected=$(whiptail --title "$INFO_TITLE_TZ" --inputbox "$INFO_TEXT_TIMEZONE" 10 72 "$timezone" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3) || return 0
			if _validate_timezone "$selected"; then
				timezone=$selected
				break
			fi
		done
	fi
}

function _apply_timezone() {
	[[ -z $timezone ]] && return 0
	local zone_file="/usr/share/zoneinfo/$timezone"
	[[ $timezone == GMT* || $timezone == UTC ]] && zone_file="/usr/share/zoneinfo/Etc/$timezone"
	if [[ ! -f $zone_file ]]; then
		_error "Timezone is not available on this host: $timezone"
		return 1
	fi
	ln -sfn "$zone_file" /etc/localtime || return 1
	printf '%s\n' "${zone_file#/usr/share/zoneinfo/}" >/etc/timezone
}

function _askchsource() {
	if (whiptail --title "$INFO_TITLE_SOURCE" --yesno "$INFO_TEXT_SOURCE" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
		chsource=1
		mirror=$(
			whiptail --title "$INFO_TITLE_SOURCE" --radiolist \
				"$INFO_TEXT_SOURCE_EXTRA" 15 32 8 \
				"us" "$CHOICE_TEXT_SOURCE_EXTRA_US" on \
				"au" "$CHOICE_TEXT_SOURCE_EXTRA_AU" off \
				"cn" "$CHOICE_TEXT_SOURCE_EXTRA_CN" off \
				"fr" "$CHOICE_TEXT_SOURCE_EXTRA_FR" off \
				"de" "$CHOICE_TEXT_SOURCE_EXTRA_DE" off \
				"jp" "$CHOICE_TEXT_SOURCE_EXTRA_JP" off \
				"ru" "$CHOICE_TEXT_SOURCE_EXTRA_RU" off \
				"uk" "$CHOICE_TEXT_SOURCE_EXTRA_UK" off \
				"tuna" "$CHOICE_TEXT_SOURCE_EXTRA_TUNA" off \
				3>&1 1>&2 2>&3
		)
	else
		chsource=0
	fi
}

function _askcdn() {
	if (whiptail --title "$INFO_TITLE_CDN" --yesno "$INFO_TEXT_CDN" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
		cdn=$(
			whiptail --title "$INFO_TITLE_CDN" --radiolist \
				"$INFO_TEXT_CDN_EXTRA" 12 42 4 \
				"cf" "$CHOICE_TEXT_CDN_EXTRA_CF" off \
				"sf" "$CHOICE_TEXT_CDN_EXTRA_SF" off \
				"osdn" "$CHOICE_TEXT_CDN_EXTRA_OSDN" off \
				"github" "$CHOICE_TEXT_CDN_EXTRA_GITHUB" on \
				3>&1 1>&2 2>&3
		)
	else
		cdn="github"
	fi
}

function _trim_value() {
	local value="$1"
	value="${value%$'\r'}"
	value="$(printf '%s' "$value" | xargs 2>/dev/null || true)"
	value="${value#\"}"
	value="${value%\"}"
	value="${value#\'}"
	value="${value%\'}"
	printf '%s' "$value"
}

function _map_cdn_option() {
	local cdn_name="$1"
	case "$cdn_name" in
		cf) echo "--with-cf" ;;
		sf) echo "--with-sf" ;;
		osdn) echo "--with-osdn" ;;
		github|*) echo "--with-github" ;;
	esac
}

function _askauthdomain() {
	auth_domain=$(whiptail --title "Info" --inputbox "Enter authentication domain (can be local hostname, e.g., box.local). Clients can use /etc/hosts to resolve this locally." 10 72 "${auth_domain}" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
	auth_domain=$(_trim_value "$auth_domain")
}

function _ensure_auth_domain() {
	# Use domain if available
	local auth_domain_to_use="$domain"
	
	# If no domain, try auth_domain
	if [[ -z "$auth_domain_to_use" ]]; then
		if [[ -z "$auth_domain" ]]; then
			_askauthdomain
		fi
		auth_domain_to_use="$auth_domain"
	fi
	
	# If still no auth domain, try hostname
	if [[ -z "$auth_domain_to_use" ]]; then
		if [[ -n "$hostname" ]]; then
			auth_domain_to_use="$hostname"
		fi
	fi
	
	# If still empty, error
	if [[ -z "$auth_domain_to_use" ]]; then
		whiptail --title "Error" --msgbox "An auth provider requires a domain or hostname. Please set one first." --ok-button "$BUTTON_OK" 8 72
		exit 1
	fi
	
	# Use the determined domain
	domain="$auth_domain_to_use"
}

function _askauthelia_email_config() {
	ADMIN_EMAIL=$(whiptail --title "$INFO_TITLE_AUTHELIA_EMAIL" --inputbox "$INFO_TEXT_AUTHELIA_ADMIN_EMAIL" 10 72 "$ADMIN_EMAIL" 3>&1 1>&2 2>&3)
	SMTP_HOST=$(whiptail --title "$INFO_TITLE_AUTHELIA_EMAIL" --inputbox "$INFO_TEXT_AUTHELIA_SMTP_HOST" 10 72 "$SMTP_HOST" 3>&1 1>&2 2>&3)
	SMTP_PORT=$(whiptail --title "$INFO_TITLE_AUTHELIA_EMAIL" --inputbox "$INFO_TEXT_AUTHELIA_SMTP_PORT" 10 72 "$SMTP_PORT" 3>&1 1>&2 2>&3)
	SMTP_USERNAME=$(whiptail --title "$INFO_TITLE_AUTHELIA_EMAIL" --inputbox "$INFO_TEXT_AUTHELIA_SMTP_USERNAME" 10 72 "$SMTP_USERNAME" 3>&1 1>&2 2>&3)
	SMTP_PASSWORD=$(whiptail --title "$INFO_TITLE_AUTHELIA_EMAIL" --passwordbox "$INFO_TEXT_AUTHELIA_SMTP_PASSWORD" 10 72 "$SMTP_PASSWORD" 3>&1 1>&2 2>&3)
	SMTP_SENDER=$(whiptail --title "$INFO_TITLE_AUTHELIA_EMAIL" --inputbox "$INFO_TEXT_AUTHELIA_SMTP_SENDER" 10 72 "$SMTP_SENDER" 3>&1 1>&2 2>&3)
	ADMIN_EMAIL=$(_trim_value "$ADMIN_EMAIL")
	SMTP_HOST=$(_trim_value "$SMTP_HOST")
	SMTP_PORT=$(_trim_value "$SMTP_PORT")
	SMTP_USERNAME=$(_trim_value "$SMTP_USERNAME")
	SMTP_PASSWORD=$(_trim_value "$SMTP_PASSWORD")
	SMTP_SENDER=$(_trim_value "$SMTP_SENDER")
}

function _askauthelia_mode() {
	local current="${authelia_auth_mode:-password}"
	authelia_auth_mode=""
	while [[ -z $authelia_auth_mode ]]; do
		authelia_auth_mode=$(_trim_value "$(
			whiptail --title "$INFO_TITLE_AUTHELIA_MODE" --radiolist \
				"$INFO_TEXT_AUTHELIA_MODE" 12 56 4 \
				"password" "$CHOICE_TEXT_AUTHELIA_MODE_1" $( [[ $current == password ]] && echo on || echo off ) \
				"mfa" "$CHOICE_TEXT_AUTHELIA_MODE_2" $( [[ $current == mfa ]] && echo on || echo off ) \
				"passwordless" "$CHOICE_TEXT_AUTHELIA_MODE_3" $( [[ $current == passwordless ]] && echo on || echo off ) \
				3>&1 1>&2 2>&3
		)")
	done
	case "$authelia_auth_mode" in
		passwordless)
			_askauthelia_email_config
			;;
		mfa)
			if (whiptail --title "$INFO_TITLE_AUTHELIA_EMAIL" --yesno "Would you like to configure SMTP email for MFA notifications (e.g. TOTP setup emails)?" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
				_askauthelia_email_config
			fi
			;;
	esac
}

function _askvouch_config() {
	OIDC_AUTH_URL=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "$INFO_TEXT_VOUCH_AUTH_URL" 10 72 "$OIDC_AUTH_URL" 3>&1 1>&2 2>&3)")
	OIDC_TOKEN_URL=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "$INFO_TEXT_VOUCH_TOKEN_URL" 10 72 "$OIDC_TOKEN_URL" 3>&1 1>&2 2>&3)")
	OIDC_USERINFO_URL=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "$INFO_TEXT_VOUCH_USERINFO_URL" 10 72 "$OIDC_USERINFO_URL" 3>&1 1>&2 2>&3)")
	OIDC_CLIENT_ID=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "$INFO_TEXT_VOUCH_CLIENT_ID" 10 72 "$OIDC_CLIENT_ID" 3>&1 1>&2 2>&3)")
	OIDC_CLIENT_SECRET=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --passwordbox "$INFO_TEXT_VOUCH_CLIENT_SECRET" 10 72 "$OIDC_CLIENT_SECRET" 3>&1 1>&2 2>&3)")
	OIDC_END_SESSION_ENDPOINT=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "$INFO_TEXT_VOUCH_END_SESSION_ENDPOINT" 10 72 "$OIDC_END_SESSION_ENDPOINT" 3>&1 1>&2 2>&3)")
	EMAIL_DOMAINS=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "$INFO_TEXT_VOUCH_EMAIL_DOMAINS" 10 72 "$domain" 3>&1 1>&2 2>&3)")
	if (whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --yesno "Would you like to configure OIDC user mapping? (map OIDC usernames to local admin)" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
		OIDC_USER=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "OIDC user allowed to access local admin (optional)" 10 72 "$OIDC_USER" 3>&1 1>&2 2>&3)")
		OIDC_USER_MAP=$(_trim_value "$(whiptail --title "$INFO_TITLE_VOUCH_CONFIG" --inputbox "OIDC usernames mapped to local admin (comma-separated, e.g., user1,user2)" 10 72 "$OIDC_USER_MAP" 3>&1 1>&2 2>&3)")
	fi
}

function _remove_app() {
	local item
	local -a items
	read -r -a items <<< "${app_list//$'\n'/ }"
	app_list=""
	for item in "${items[@]}"; do
		[[ $item == "$1" ]] || app_list+="${app_list:+ }$item"
	done
}

function _askauthprovider() {
	local current="${auth_provider:-none}"
	auth_provider=$(_trim_value "$(
		whiptail --title "$INFO_TITLE_AUTH_PROVIDER" --radiolist \
			"$INFO_TEXT_AUTH_PROVIDER" 12 64 4 \
			"none" "$CHOICE_TEXT_AUTH_PROVIDER_1" $( [[ $current == none ]] && echo on || echo off ) \
			"authelia" "$CHOICE_TEXT_AUTH_PROVIDER_2" $( [[ $current == authelia ]] && echo on || echo off ) \
			"vouchproxy" "$CHOICE_TEXT_AUTH_PROVIDER_3" $( [[ $current == vouchproxy ]] && echo on || echo off ) \
			3>&1 1>&2 2>&3
	)")
	auth_provider="${auth_provider:-$current}"
	if [[ $auth_provider != "$current" && $current != none ]]; then
		_remove_app "$current"
	fi
	config_auth_provider_explicit=1
	case "$auth_provider" in
		authelia)
			_ensure_auth_domain
			_askauthelia_mode
			;;
		vouchproxy)
			_ensure_auth_domain
			EMAIL_DOMAINS="${EMAIL_DOMAINS:-$domain}"
			_askvouch_config
			;;
		*)
			auth_provider="none"
			authelia_auth_mode="password"
			ADMIN_EMAIL=""
			SMTP_HOST=""
			SMTP_PORT="587"
			SMTP_USERNAME=""
			SMTP_PASSWORD=""
			SMTP_SENDER=""
			OIDC_AUTH_URL=""
			OIDC_TOKEN_URL=""
			OIDC_USERINFO_URL=""
			OIDC_CLIENT_ID=""
			OIDC_CLIENT_SECRET=""
			OIDC_END_SESSION_ENDPOINT=""
			OIDC_USER=""
			OIDC_USER_MAP=""
			EMAIL_DOMAINS=""
			;;
	esac
}

function _askSwap() {
	local selected
	selected=$(whiptail --title "$INFO_TITLE_SWAP" --inputbox "$INFO_TEXT_SWAP_CONFIG" 10 72 "${swap_path:-/root/.swapfile}" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3) || return 0
	swap_path=${selected:-/root/.swapfile}
}

function _apply_swap() {
	local memory_mb
	local swap_dir available_kb existing_type active fstab_file swaps_file created=0
	local memory_output parent_stat parent_uid parent_mode active_result swap_uid
	local -a swap_status
	memory_output=$(free -m) || { _error "Could not read system memory for swap sizing."; return 1; }
	memory_mb=$(awk '/^Mem:/ {print $2; found=1} END {if (!found) exit 1}' <<<"$memory_output") || {
		_error "Could not determine system memory for swap sizing."
		return 1
	}
	[[ $memory_mb =~ ^[0-9]+$ ]] || { _error "Invalid system memory value: $memory_mb"; return 1; }
	((memory_mb <= 2048)) || return 0
	swap_path=${swap_path:-/root/.swapfile}
	if [[ $swap_path != /* || $swap_path =~ [[:space:]] || $swap_path == *:* || $swap_path == *..* || $swap_path == / ]]; then
		_error "Swap path must be an absolute path without whitespace or traversal: $swap_path"
		return 1
	fi
	swap_dir=$(dirname -- "$swap_path") || return 1
	if [[ ! -d $swap_dir || -L $swap_dir ]]; then
		_error "Swap directory does not exist or is a symlink: $swap_dir"
		return 1
	fi
	if [[ $(cd "$swap_dir" 2>/dev/null && pwd -P) != "$swap_dir" ]]; then
		_error "Swap directory must not contain symlink or non-canonical path components: $swap_dir"
		return 1
	fi
	parent_stat=$(stat -c '%u %a' -- "$swap_dir") || { _error "Could not inspect swap directory ownership and permissions: $swap_dir"; return 1; }
	read -r parent_uid parent_mode <<<"$parent_stat"
	if [[ $parent_uid != "$EUID" || ! $parent_mode =~ ^[0-7]{3,4}$ ]] || (( (8#$parent_mode) & 0022 )); then
		_error "Swap directory must be owned by the installer and not writable by group or others: $swap_dir"
		return 1
	fi
	fstab_file=/etc/fstab
	swaps_file=/proc/swaps
	if [[ ! -f $fstab_file || -L $fstab_file ]]; then
		_error "fstab is missing or is a symlink: $fstab_file"
		return 1
	fi
	if awk -v path="$swap_path" '$1 !~ /^#/ && $1 == path { found=1; if (($2 != "swap" && $2 != "none") || $3 != "swap") conflict=1 } END { exit(conflict ? 2 : found ? 0 : 1) }' "$fstab_file"; then
		local fstab_has_entry=1
	else
		local fstab_rc=$?
		if [[ $fstab_rc == 2 ]]; then
			_error "Conflicting fstab entry exists for $swap_path"
			return 1
		fi
		local fstab_has_entry=0
	fi
	if [[ ! -r $swaps_file ]]; then
		_error "Cannot read active swap list: $swaps_file"
		return 1
	fi
	active_result=$(awk -v path="$swap_path" 'NR > 1 && $1 == path { found=1 } END {print found ? 1 : 0}' "$swaps_file") || {
		_error "Could not inspect active swap list: $swaps_file"
		return 1
	}
	active=$active_result
	if [[ -e $swap_path || -L $swap_path ]]; then
		if [[ ! -f $swap_path || -L $swap_path ]]; then
			_error "Refusing to use non-regular or symlink swap path: $swap_path"
			return 1
		fi
		if (( ! active )); then
			existing_type=$(blkid -p -s TYPE -o value -- "$swap_path" 2>/dev/null) || existing_type=""
			if [[ $existing_type != swap ]]; then
				_error "Refusing to overwrite existing non-swap file: $swap_path"
				return 1
			fi
		fi
		swap_uid=$(stat -c '%u' -- "$swap_path") || { _error "Could not inspect swap file ownership: $swap_path"; return 1; }
		if [[ $swap_uid != "$EUID" ]]; then
			_error "Swap file must be owned by the installer: $swap_path"
			return 1
		fi
		if ! chmod 600 -- "$swap_path"; then
			_error "Could not secure swap file permissions: $swap_path"
			return 1
		fi
	fi
	if ((active)); then
		if [[ ! -f $swap_path || -L $swap_path ]]; then
			_error "Active swap path is not a regular file: $swap_path"
			return 1
		fi
		((fstab_has_entry)) || printf '%s swap swap defaults 0 0\n' "$swap_path" >>"$fstab_file" || return 1
		return 0
	fi
	if [[ ! -e $swap_path && ! -L $swap_path ]]; then
		available_kb=$(df -Pk "$swap_dir" | awk 'END {print $4}') || return 1
		if [[ ! $available_kb =~ ^[0-9]+$ ]] || ((available_kb < 2097152)); then
			_error "Not enough space to create a 2 GiB swap file in $swap_dir"
			return 1
		fi
		(umask 077; set -o noclobber; : >"$swap_path") || {
			_error "Could not safely create swap file: $swap_path"
			return 1
		}
		created=1
		if ! dd if=/dev/zero of="$swap_path" bs=1M count=2048 conv=fsync >/dev/null 2>&1; then
			_error "Failed to allocate swap file: $swap_path"
			rm -f -- "$swap_path"
			return 1
		fi
		if ! chmod 600 -- "$swap_path" || ! mkswap "$swap_path" >/dev/null 2>&1; then
			_error "Failed to initialize swap file: $swap_path"
			rm -f -- "$swap_path"
			return 1
		fi
	fi
	{
		echo -e "XXX\n10\n$INFO_TEXT_SWAPON_0$INFO_TEXT_DONE\nXXX"
		sleep 1
		echo -e "XXX\n10\n$INFO_TEXT_SWAPON_1\nXXX"
		swapon "${swap_path}" >/dev/null 2>&1 || exit 1
		echo -e "XXX\n75\n$INFO_TEXT_SWAPON_2$INFO_TEXT_DONE\nXXX"
		sleep 1
		echo -e "XXX\n75\n$INFO_TEXT_SWAPON_3\nXXX"
		if (( ! fstab_has_entry )); then printf '%s swap swap defaults 0 0\n' "$swap_path" >>"$fstab_file" || exit 1; fi
		echo -e "XXX\n100\n$INFO_TEXT_SWAPON_3$INFO_TEXT_DONE\nXXX"
	} | whiptail --title "$INFO_TITLE_SWAPON" --gauge "$INFO_TEXT_SWAPON_0" 8 64 0
	local -a swap_status=("${PIPESTATUS[@]}")
	if [[ ${swap_status[0]} != 0 || ${swap_status[1]} != 0 ]]; then
		_error "Swap setup failed (worker=${swap_status[0]}, progress UI=${swap_status[1]})."
		active_result=$(awk -v path="$swap_path" 'NR > 1 && $1 == path { found=1 } END {print found ? 1 : 0}' "$swaps_file") || active_result=1
		if ((created)) && [[ $active_result == 0 ]]; then rm -f -- "$swap_path"; fi
		return 1
	fi
}

function _chsource() {
	if [[ $mirror == "" ]]; then mirror="us"; fi
	if [[ $DISTRO == Debian ]]; then
		if [[ "$CODENAME" =~ ("bullseye"|"bookworm"|"trixie") ]]; then
			if [[ $mirror == "tuna" ]]; then
				cp ${local_setup_template}source.list/debian.new.tuna.template /etc/apt/sources.list || return 1
			else
				cp ${local_setup_template}source.list/debian.new.template /etc/apt/sources.list || return 1
				sed -i "s/COUNTRY/${mirror}/g" /etc/apt/sources.list || return 1
			fi
		else
			if [[ $mirror == "tuna" ]]; then
				cp ${local_setup_template}source.list/debian.tuna.template /etc/apt/sources.list || return 1
			else
				cp ${local_setup_template}source.list/debian.template /etc/apt/sources.list || return 1
				sed -i "s/COUNTRY/${mirror}/g" /etc/apt/sources.list || return 1
			fi
		fi
		sed -i "s/RELEASE/${CODENAME}/g" /etc/apt/sources.list || return 1
	else
		if [[ $mirror == "tuna" ]]; then
			cp ${local_setup_template}source.list/ubuntu.tuna.template /etc/apt/sources.list || return 1
		else
			cp ${local_setup_template}source.list/ubuntu.template /etc/apt/sources.list || return 1
			sed -i "s/COUNTRY/${mirror}/g" /etc/apt/sources.list || return 1
		fi
		sed -i "s/RELEASE/${CODENAME}/g" /etc/apt/sources.list || return 1
	fi
}

function _addPHP() {
	if [[ $DISTRO == "Ubuntu" ]]; then
		# add php7.4
		wget -qO- "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x71DAEAAB4AD4CAB6" | gpg --batch --yes --dearmor -o /etc/apt/trusted.gpg.d/php.gpg >>"${OUTTO}" 2>&1
		cat >/etc/apt/sources.list.d/php.list <<DPHP
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/php.gpg] https://ppa.launchpadcontent.net/ondrej/php/ubuntu $(lsb_release -sc) main
DPHP
	elif [[ $DISTRO == "Debian" ]]; then
		# add php for debian
		wget -q https://packages.sury.org/php/apt.gpg -O /etc/apt/trusted.gpg.d/deb.sury.org-php.gpg 2>&1
		cat >/etc/apt/sources.list.d/php.list <<DPHP
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/deb.sury.org-php.gpg] https://packages.sury.org/php/ $(lsb_release -sc) main
DPHP
	fi
	DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update >>"${OUTTO}" 2>&1
	# shellcheck disable=SC2154
	echo -e "XXX\n12\n${INFO_TEXT_PROGRESS_Extra_1}\nXXX"
	DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade --allow-unauthenticated >>"${OUTTO}" 2>&1
	# auto solve dpkg lock
	if [ "$?" -eq 2 ]; then
		rm -f /var/lib/dpkg/updates/0*
		locks=$(find /var/lib/dpkg/lock* && find /var/cache/apt/archives/lock*)
		if [[ ${locks} == $(find /var/lib/dpkg/lock* && find /var/cache/apt/archives/lock*) ]]; then
			for l in ${locks}; do
				rm -rf "${l}"
			done
			{
				dpkg --configure -a
				DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update
				DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade
			} >>"${OUTTO}" 2>&1
		fi
		if ! (apt-get check >/dev/null); then
			apt-get install -f >>"${OUTTO}" 2>&1
			if ! (apt-get check >/dev/null); then
				whiptail --title "$ERROR_TITLE_INSTALL" --msgbox "$ERROR_TEXT_INSTALL_1" --ok-button "$BUTTON_OK" 8 72
				exit 1
			fi
		fi
	fi
}

function _dependency() {
	DEPLIST="sudo at bc build-essential curl wget nginx-extras subversion ssl-cert mcrypt libmcrypt-dev nano unzip htop iotop vnstat vnstati automake make openssl net-tools debconf-utils ntp rsync screenfetch"
	if [[ "$CODENAME" =~ ("trixie") ]]; then
		DEPLIST=${DEPLIST//ntp/}
	fi
	for depend in $DEPLIST; do
		# shellcheck disable=SC2154
		echo -e "XXX\n12\n$INFO_TEXT_PROGRESS_Extra_2${depend}\nXXX"
		if ! DEBIAN_FRONTEND=noninteractive apt-get -y install "${depend}" --allow-unauthenticated >>"${OUTTO}" 2>&1; then
			# retry on failure
			echo "Retry ${depend}" >>"${OUTTO}"
			if ! DEBIAN_FRONTEND=noninteractive apt-get -y install "${depend}" --allow-unauthenticated >>"${OUTTO}" 2>&1; then
				case "$depend" in
					htop|iotop|nano|screenfetch|vnstat|vnstati)
						_optional_failure "Optional package $depend could not be installed"
						continue
						;;
					*)
						whiptail --title "$ERROR_TITLE_INSTALL" --msgbox "${ERROR_TEXT_INSTALL_1}${depend}" 8 64
						return 1
						;;
				esac
			fi
		fi
	done
}

function _insngx() {
	rm -rf /etc/nginx/nginx.conf
	cp ${local_setup_template}nginx/nginx.conf.new.template /etc/nginx/nginx.conf || return 1

	rm -rf /etc/nginx/sites-enabled/default
	cp ${local_setup_template}nginx/default.template /etc/nginx/sites-enabled/default || return 1

	mkdir -p /etc/nginx/ssl/
	mkdir -p /etc/nginx/snippets/
	mkdir -p /etc/nginx/apps/
	chmod 700 /etc/nginx/ssl

	cd /etc/nginx/ssl || exit 1
	openssl dhparam -out dhparam.pem 2048 >>"${OUTTO}" 2>&1 || return 1

	cp ${local_setup_template}nginx/ssl-params.conf.template /etc/nginx/snippets/ssl-params.conf || return 1

	if [[ -f /etc/nginx/snippets/proxy.conf ]]; then
		if ! bash /usr/local/bin/quickbox/system/auxiliary/qbNginxProxyMigrate \
			--template ${local_setup_template}nginx/proxy.conf >>"${OUTTO}" 2>&1; then
			echo ">> Failed to migrate the nginx proxy snippet" >>"${OUTTO}" 2>&1
			exit 1
		fi
	else
		cp ${local_setup_template}nginx/proxy.conf /etc/nginx/snippets/proxy.conf || return 1
	fi
	mkdir -p /etc/nginx/snippets
	chown root:root /etc/nginx/snippets/proxy.conf 2>/dev/null
	chmod 0644 /etc/nginx/snippets/proxy.conf 2>/dev/null

	# Download nginx fancyindex theme
	if wget -t3 -T20 -q -O /tmp/fancyindex.zip https://codeload.github.com/Naereen/Nginx-Fancyindex-Theme/zip/refs/heads/master >>"${OUTTO}" 2>&1 &&
		unzip -o -j /tmp/fancyindex.zip "Nginx-Fancyindex-Theme-master/Nginx-Fancyindex/*" -d "/srv/fancyindex" >>"${OUTTO}" 2>&1 &&
		sed -i 's/href="\/[^\/]*/href="\/fancyindex/g' /srv/fancyindex/header.html &&
		sed -i 's/src="\/[^\/]*/src="\/fancyindex/g' /srv/fancyindex/footer.html; then
		:
	else
		_optional_failure "Fancyindex theme could not be installed"
	fi
	cp ${local_setup_template}nginx/fancyindex.conf.template /etc/nginx/snippets/fancyindex.conf

	# Generate snakeoil certs should they not exists as on some providers
	if [[ ! -f /etc/ssl/certs/ssl-cert-snakeoil.pem ]]; then
		cp ${local_setup_template}openssl.cnf.template /root/.openssl.cnf
		openssl req -config /root/.openssl.cnf -x509 -nodes -days 365 -newkey rsa:1024 -keyout /etc/ssl/private/ssl-cert-snakeoil.key -out /etc/ssl/certs/ssl-cert-snakeoil.pem >/dev/null 2>&1 || return 1
	fi

	mkdir -p /var/log/nginx/
	chown -R www-data:www-data /var/log/nginx/
	systemctl restart nginx
}

function _insnodejs() {
	if ! bash /usr/local/bin/quickbox/system/auxiliary/qbEnsureNodejs >>"${OUTTO}" 2>&1; then
		_errorcolor
		echo -e "XXX\n00\n${ERROR_TEXT_NODEJS}\nXXX"
		_defaultcolor
		echo ">> ${ERROR_TEXT_NODEJS}" >>"${OUTTO}" 2>&1
		exit 1
	fi
}

function _webconsole() {
	chmod -x /etc/update-motd.d/*
	\cp -f ${local_setup_template}motd/01-custom /etc/update-motd.d/01-custom
	chmod +x /etc/update-motd.d/01-custom
	# install ttyd and service config
	local ttyd_release ttyd_arch ttyd_binary_url
	ttyd_arch=$(arch) || return 1
	ttyd_release=$(curl -fsS https://api.github.com/repos/tsl0922/ttyd/releases/latest) || return 1
	ttyd_binary_url=$(jq -er --arg arch "$ttyd_arch" '[.assets[]? | select(.name | contains($arch)) | .browser_download_url][0] // empty' <<<"$ttyd_release") || return 1
	if wget -qO /usr/local/bin/ttyd "${ttyd_binary_url}"; then
		echo "ttyd binary download success" >>"${OUTTO}" 2>&1
		chmod +x /usr/local/bin/ttyd
	else
		echo "ttyd binary download failed" >>"${OUTTO}" 2>&1
		return 1
	fi
	service ttyd stop >/dev/null 2>&1
	rm -f /etc/init.d/ttyd >/dev/null 2>&1

	if [[ ! -f /etc/nginx/apps/"${username}".console.conf ]]; then
		cat > /etc/nginx/apps/"${username}".console.conf <<WEBC || return 1
location /${username}.console/ {
    proxy_pass http://127.0.0.1:4200;
    rewrite ^/${username}.console(?P<path>.*) /\$path break;
    auth_basic "password Required";
    auth_basic_user_file /etc/htpasswd;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
}
WEBC
	fi

	cp ${local_setup_template}systemd/ttyd.service.template /etc/systemd/system/ttyd.service
	sed -i "s/USERNAME/${username}/g" /etc/systemd/system/ttyd.service

	# enable ttyd service
	systemctl daemon-reload >/dev/null 2>&1
	systemctl enable ttyd.service >/dev/null 2>&1
	systemctl start ttyd.service >/dev/null 2>&1 || return 1
	# create lock
	touch /install/.ttyd.lock
}

function _insdashboard() {
	echo -e "XXX\n27\n$INFO_TEXT_PROGRESS_7_1\nXXX"
	_insngx || return $?
	echo -e "XXX\n28\n$INFO_TEXT_PROGRESS_7_2\nXXX"
	_insnodejs || return $?
	echo -e "XXX\n29\n$INFO_TEXT_PROGRESS_7_3\nXXX"
	_webconsole || _optional_failure "Web console could not be installed"
	cd && mkdir -p /srv/dashboard
	if ! \cp -fR ${local_setup_dashboard}. /srv/dashboard; then
		_errorcolor
		echo -e "XXX\n00\nFailed to copy the dashboard files to /srv/dashboard\nXXX"
		_defaultcolor
		echo ">> Failed to copy the dashboard files to /srv/dashboard" >>"${OUTTO}" 2>&1
		exit 1
	fi
	touch /srv/dashboard/db/output.log
	if ! /usr/local/bin/quickbox/system/theme/themeSelect-"${dash_theme}"; then
		echo ">> Failed to prepare dashboard theme" >>"${OUTTO}" 2>&1
		exit 1
	fi
	IFACE=$(ip link show | grep -i broadcast | grep -m1 UP | cut -d: -f 2 | cut -d@ -f 1 | sed -e 's/ //g')
	echo "${IFACE}" >/srv/dashboard/db/interface.txt
	echo "${username}" >/srv/dashboard/db/master.txt

	if ! chown -R root:root /srv/dashboard ||
		! chown -R www-data:www-data /srv/dashboard/db /srv/dashboard/skins; then
		echo ">> Failed to set dashboard ownership" >>"${OUTTO}" 2>&1
		exit 1
	fi
	# The updater survives a restart of the WS unit, but PrivateTmp's /tmp does
	# not. Keep update/health-check temporary files on persistent storage.
	if ! install -d -m 0700 -o www-data -g www-data /srv/dashboard/db/tmp; then
		echo ">> Failed to prepare the dashboard temporary directory" >>"${OUTTO}" 2>&1
		exit 1
	fi

	# Gateway secret and injected header live in root-managed locations; the
	# dashboard config below includes the generated snippet, so it must exist
	# first.
	if ! bash /usr/local/bin/quickbox/system/auxiliary/qbEnsureWsGateway; then
		_errorcolor
		echo -e "XXX\n00\nFailed to prepare the WS gateway secret\nXXX"
		_defaultcolor
		echo ">> Failed to prepare the WS gateway secret" >>"${OUTTO}" 2>&1
		exit 1
	fi

	if ! \cp -f ${local_setup_template}nginx/dashboard.conf.template /etc/nginx/apps/dashboard.conf; then
		echo ">> Failed to install the dashboard nginx config" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! sed -i "s/\/etc\/htpasswd/\/etc\/htpasswd.d\/htpasswd.${username}/g" /etc/nginx/apps/dashboard.conf; then
		echo ">> Failed to configure dashboard authentication" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! nginx -t >>"${OUTTO}" 2>&1; then
		_errorcolor
		echo -e "XXX\n00\nnginx configuration test failed\nXXX"
		_defaultcolor
		echo ">> nginx configuration test failed" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! service nginx force-reload >>"${OUTTO}" 2>&1; then
		echo ">> Failed to reload dashboard nginx configuration" >>"${OUTTO}" 2>&1
		exit 1
	fi
	case $uilang in
	"en")
		bash /usr/local/bin/quickbox/system/lang/langSelect-lang_en >/dev/null 2>&1
		;;
	"zh")
		bash /usr/local/bin/quickbox/system/lang/langSelect-lang_zh >/dev/null 2>&1
		;;
	*)
		bash /usr/local/bin/quickbox/system/lang/langSelect-lang_en >/dev/null 2>&1
		;;
	esac
	touch /install/.dashboard.lock
	cd /srv/dashboard/ws || exit 1
	if ! npm ci --production >>"${OUTTO}" 2>&1; then
		_errorcolor
		echo -e "XXX\n00\n${ERROR_TEXT_NODEJS}\nXXX"
		_defaultcolor
		echo ">> Failed to install the dashboard dependencies" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! \cp -f ${local_setup_template}systemd/quickbox-ws.service.template /etc/systemd/system/quickbox-ws.service; then
		echo ">> Failed to install the quickbox-ws service unit" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! systemctl daemon-reload >>"${OUTTO}" 2>&1; then
		echo ">> systemctl daemon-reload failed" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! systemctl enable quickbox-ws.service >>"${OUTTO}" 2>&1; then
		echo ">> Failed to enable quickbox-ws.service" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! systemctl start quickbox-ws.service >>"${OUTTO}" 2>&1; then
		echo ">> Failed to start quickbox-ws.service" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! systemctl is-active --quiet quickbox-ws.service; then
		echo ">> quickbox-ws.service is not running" >>"${OUTTO}" 2>&1
		exit 1
	fi
	if ! bash /usr/local/bin/quickbox/system/auxiliary/qbWsHealthCheck --expect-proxy >>"${OUTTO}" 2>&1; then
		_errorcolor
		echo -e "XXX\n00\nDashboard health check failed, see ${OUTTO}\nXXX"
		_defaultcolor
		echo ">> Dashboard health check failed" >>"${OUTTO}" 2>&1
		exit 1
	fi
	touch /install/.quickbox-ws.lock
	return 0
}

function _askapps() {
	app_list=$(
		whiptail --title "$INFO_TITLE_APPS" --checklist --separate-output --separate-output "$INFO_TEXT_APPS" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 16 56 8 \
			"rtorrent" "$CHOICE_TEXT_APPS_1" OFF \
			"transmission" "$CHOICE_TEXT_APPS_2" OFF \
			"qbittorrent" "$CHOICE_TEXT_APPS_3" OFF \
			"deluge" "$CHOICE_TEXT_APPS_4" OFF \
			"mktorrent" "$CHOICE_TEXT_APPS_5" OFF \
			"ffmpeg" "$CHOICE_TEXT_APPS_6" ON \
			"filebrowser" "$CHOICE_TEXT_APPS_7" OFF \
			"linuxrar" "$CHOICE_TEXT_APPS_8" ON 3>&1 1>&2 2>&3
	)
	_askrtgui
	_askdenytracker
	
	# Auto-add auth provider to app_list if selected (newline-separated format)
	if [[ "$auth_provider" == "authelia" ]] && [[ ! "$app_list" =~ "authelia" ]]; then
		if [[ -z "$app_list" ]]; then
			app_list="authelia"
		else
			app_list=$(printf '%s\nauthelia' "$app_list")
		fi
	elif [[ "$auth_provider" == "vouchproxy" ]] && [[ ! "$app_list" =~ "vouchproxy" ]]; then
		if [[ -z "$app_list" ]]; then
			app_list="vouchproxy"
		else
			app_list=$(printf '%s\nvouchproxy' "$app_list")
		fi
	fi
}

function _askbbr() {
	enable_bbr=""
	while [[ $enable_bbr == "" ]]; do
		enable_bbr=$(
			whiptail --title "$INFO_TITLE_BBR" --radiolist \
				"$INFO_TEXT_BBR" 12 32 4 \
				"0" "$CHOICE_TEXT_BBR_1" on \
				"1" "$CHOICE_TEXT_BBR_2" off \
				3>&1 1>&2 2>&3
		)
	done
}

function _insbbr() {
	bash /usr/local/bin/quickbox/system/auxiliary/install-BBR.sh -l "${OUTTO}" >/dev/null 2>&1
}

function _askrtgui() {
	if [[ "$app_list" =~ "rtorrent" ]]; then
		rtgui=""
		while [[ $rtgui == "" ]]; do
			rtgui=$(
				whiptail --title "$INFO_TITLE_RTGUI" --radiolist \
					"$INFO_TEXT_RTGUI" 12 56 4 \
					"rutorrent" "$CHOICE_TEXT_RTGUI_1" off \
					"flood" "$CHOICE_TEXT_RTGUI_2" off \
					--ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3
			)
			if [[ $rtgui == "" ]]; then
				whiptail --title "$ERROR_TITLE_RTGUI" --msgbox "$ERROR_TEXT_RTGUI" --ok-button "$BUTTON_OK" 8 72
			fi
		done
	fi
}

function _insapps() {
	local cdn_arg
	local -a app_cmd version_args
	local -a failed_apps=()
	INSTALL_FAILED_APPS=""
	cdn_arg=$(_map_cdn_option "$cdn") || return 1
	if [[ "$app_list" =~ "rtorrent" ]]; then
		echo -e "XXX\n30\n$INFO_TEXT_INSTALLAPP_1\nXXX"
		version_args=(); [[ -n $rt_ver ]] && version_args+=(--version "$rt_ver")
		app_cmd=(bash "${local_setup_script}rtorrent.sh" "${OUTTO}" "${rtgui}" "$cdn_arg" "${version_args[@]}")
		if "${app_cmd[@]}" >/dev/null 2>&1; then
			echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_1$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("rtorrent")
			printf 'Application installation failed: %s\n' "rtorrent" >&2
		fi
	else
		echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_1$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "transmission" ]]; then
		echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_2\nXXX"
		version_args=(); [[ -n $tr_ver ]] && version_args+=(--version "$tr_ver")
		app_cmd=(bash "${local_setup_script}transmission.sh" "${OUTTO}" "$cdn_arg" "${version_args[@]}")
		if "${app_cmd[@]}" >/dev/null 2>&1; then
			echo -e "XXX\n41\n$INFO_TEXT_INSTALLAPP_2$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("transmission")
			printf 'Application installation failed: %s\n' "transmission" >&2
		fi
	else
		echo -e "XXX\n41\n$INFO_TEXT_INSTALLAPP_2$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "qbittorrent" ]]; then
		echo -e "XXX\n41\n$INFO_TEXT_INSTALLAPP_3\nXXX"
		version_args=(); [[ -n $qbit_ver ]] && version_args+=(--qb "$qbit_ver"); [[ -n $qbit_libt_ver ]] && version_args+=(--lt "$qbit_libt_ver")
		app_cmd=(bash "${local_setup_script}qbittorrent.sh" "${OUTTO}" "$cdn_arg" "${version_args[@]}")
		if "${app_cmd[@]}" >/dev/null 2>&1; then
			echo -e "XXX\n47\n$INFO_TEXT_INSTALLAPP_3$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("qbittorrent")
			printf 'Application installation failed: %s\n' "qbittorrent" >&2
		fi
	else
		echo -e "XXX\n47\n$INFO_TEXT_INSTALLAPP_3$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "deluge" ]]; then
		echo -e "XXX\n47\n$INFO_TEXT_INSTALLAPP_4\nXXX"
		version_args=(); [[ -n $de_ver ]] && version_args+=(--de "$de_ver"); [[ -n $de_libt_ver ]] && version_args+=(--lt "$de_libt_ver")
		app_cmd=(bash "${local_setup_script}deluge.sh" "${OUTTO}" "$cdn_arg" "${version_args[@]}")
		if "${app_cmd[@]}" >/dev/null 2>&1; then
			echo -e "XXX\n52\n$INFO_TEXT_INSTALLAPP_4$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("deluge")
			printf 'Application installation failed: %s\n' "deluge" >&2
		fi
	else
		echo -e "XXX\n52\n$INFO_TEXT_INSTALLAPP_4$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "mktorrent" ]]; then
		echo -e "XXX\n52\n$INFO_TEXT_INSTALLAPP_5\nXXX"
		if bash "${local_setup_script}mktorrent.sh" "${OUTTO}" >/dev/null 2>&1; then
			echo -e "XXX\n58\n$INFO_TEXT_INSTALLAPP_5$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("mktorrent")
			printf 'Application installation failed: %s\n' "mktorrent" >&2
		fi
	else
		echo -e "XXX\n58\n$INFO_TEXT_INSTALLAPP_5$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "ffmpeg" ]]; then
		echo -e "XXX\n58\n$INFO_TEXT_INSTALLAPP_6\nXXX"
		if bash "${local_setup_script}ffmpeg.sh" "${OUTTO}" >/dev/null 2>&1; then
			echo -e "XXX\n63\n$INFO_TEXT_INSTALLAPP_6$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("ffmpeg")
			printf 'Application installation failed: %s\n' "ffmpeg" >&2
		fi
	else
		echo -e "XXX\n63\n$INFO_TEXT_INSTALLAPP_6$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "filebrowser" ]]; then
		echo -e "XXX\n63\n$INFO_TEXT_INSTALLAPP_7\nXXX"
		if bash "${local_setup_script}filebrowser.sh" "${OUTTO}" >/dev/null 2>&1; then
			echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_7$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("filebrowser")
			printf 'Application installation failed: %s\n' "filebrowser" >&2
		fi
	else
		echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_7$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "linuxrar" ]]; then
		echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_8\nXXX"
		if bash "${local_setup_script}linuxrar.sh" "${OUTTO}" >/dev/null 2>&1; then
			echo -e "XXX\n74\n$INFO_TEXT_INSTALLAPP_8$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("linuxrar")
			printf 'Application installation failed: %s\n' "linuxrar" >&2
		fi
	else
		echo -e "XXX\n74\n$INFO_TEXT_INSTALLAPP_8$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	
	# Authelia and Vouch Proxy are mutually exclusive, so they share the same percentage
	if [[ "$app_list" =~ "authelia" ]]; then
		local auth_install_domain="$domain"
		auth_install_domain="$(_trim_value "$auth_install_domain")"
		if [[ -z "$auth_install_domain" ]]; then
			auth_install_domain="$(_trim_value "$auth_domain")"
		fi
		if [[ -z "$auth_install_domain" ]]; then
			auth_install_domain="$(_trim_value "$hostname")"
		fi
		if [[ -z "$auth_install_domain" ]]; then
			echo "Error: authelia selected but no domain/hostname available." >>"${OUTTO}" 2>&1
			INSTALL_FAILED_APPS="${failed_apps[*]} authelia (missing domain)"
			return 1
		fi
		echo -e "XXX\n74\n$INFO_TEXT_INSTALLAPP_9\nXXX"
		local authelia_cmd=(bash "${local_setup_script}authelia.sh" -l "${OUTTO}" --domain "$auth_install_domain" --auth-mode "$authelia_auth_mode")
		if [[ -n "$ADMIN_EMAIL$SMTP_HOST$SMTP_USERNAME$SMTP_PASSWORD$SMTP_SENDER" ]]; then
			authelia_cmd+=(--admin-email "$ADMIN_EMAIL" --smtp-host "$SMTP_HOST" --smtp-port "$SMTP_PORT" --smtp-username "$SMTP_USERNAME" --smtp-password "$SMTP_PASSWORD" --smtp-sender "$SMTP_SENDER")
		fi
		if "${authelia_cmd[@]}" >/dev/null 2>&1; then
			echo -e "XXX\n80\n$INFO_TEXT_INSTALLAPP_9$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("authelia")
			printf 'Application installation failed: %s\n' "authelia" >&2
		fi
	elif [[ "$app_list" =~ "vouchproxy" ]]; then
		local auth_install_domain="$domain"
		auth_install_domain="$(_trim_value "$auth_install_domain")"
		if [[ -z "$auth_install_domain" ]]; then
			auth_install_domain="$(_trim_value "$auth_domain")"
		fi
		if [[ -z "$auth_install_domain" ]]; then
			auth_install_domain="$(_trim_value "$hostname")"
		fi
		if [[ -z "$auth_install_domain" ]]; then
			echo "Error: vouchproxy selected but no domain/hostname available." >>"${OUTTO}" 2>&1
			INSTALL_FAILED_APPS="${failed_apps[*]} vouchproxy (missing domain)"
			return 1
		fi
		echo -e "XXX\n74\n$INFO_TEXT_INSTALLAPP_10\nXXX"
		local vouchproxy_cmd=(bash "${local_setup_script}vouchproxy.sh" -l "${OUTTO}" --domain "$auth_install_domain" --auth-url "$OIDC_AUTH_URL" --token-url "$OIDC_TOKEN_URL" --userinfo-url "$OIDC_USERINFO_URL" --client-id "$OIDC_CLIENT_ID" --client-secret "$OIDC_CLIENT_SECRET")
		if [[ -n "$OIDC_END_SESSION_ENDPOINT" ]]; then
			vouchproxy_cmd+=(--end-session-endpoint "$OIDC_END_SESSION_ENDPOINT")
		fi
		if [[ -n "$OIDC_USER" ]]; then
			vouchproxy_cmd+=(--oidc-user "$OIDC_USER")
		fi
		if [[ -n "$OIDC_USER_MAP" ]]; then
			vouchproxy_cmd+=(--oidc-map "$OIDC_USER_MAP")
		fi
		if [[ -n "$EMAIL_DOMAINS" ]]; then
			vouchproxy_cmd+=(--email-domains "$EMAIL_DOMAINS")
		fi
		if "${vouchproxy_cmd[@]}" >/dev/null 2>&1; then
			echo -e "XXX\n80\n$INFO_TEXT_INSTALLAPP_10$INFO_TEXT_DONE\nXXX"
		else
			failed_apps+=("vouchproxy")
			printf 'Application installation failed: %s\n' "vouchproxy" >&2
		fi
	fi
	sleep 1
	if ((${#failed_apps[@]})); then
		INSTALL_FAILED_APPS="${failed_apps[*]}"
		return 1
	fi
	return 0
}

function _askdenytracker() {
	# only ask when BT client installed
	if [[ $app_list =~ "rtorrent"|"transmission"|"qbittorrent"|"deluge" ]]; then
		if (whiptail --title "$INFO_TITLE_DENYTRACKER" --yesno "$INFO_TEXT_DENYTRACKER" --defaultno --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
			denytracker=1
		else
			denytracker=0
		fi
	fi
}

function _denytracker() {
	cp ${local_setup_template}tracker/trackers.template /etc/trackers
	cp ${local_setup_template}tracker/denypublic.template /etc/cron.daily/denypublic
	chmod +x /etc/cron.daily/denypublic
	cat ${local_setup_template}tracker/hostsTrackers.template >>/etc/hosts
}

function _finish() {
	sleep 1
}

function _askautoreboot() {
	if (whiptail --title "$INFO_TITLE_AUTOREBOOT" --yesno "$INFO_TEXT_AUTOREBOOT" --defaultno --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
		autoreboot=1
	else
		autoreboot=0
	fi
}

function _fixbcm() {
	if lspci | grep -i bcm >/dev/null; then
		mkdir -p /tmp/bcm
		cd /tmp/bcm || return 1
		git clone git://git.kernel.org/pub/scm/linux/kernel/git/firmware/linux-firmware.git >>"${OUTTO}" 2>&1 || return 1
		mkdir -p /lib/firmware/bnx2/
		cp -rf /tmp/bcm/linux-firmware/bnx2/ /lib/firmware
	fi
}

function _startinstall() {
	_validate_loaded_config || return 1
	# The legacy no-log value is an option, not a filename or shell redirection.
	if [[ $OUTTO == '/dev/null 2>&1' ]]; then
		OUTTO=/dev/null
	fi
	_checkroot || return 1
	DISTRO=$(lsb_release -is) || return 1
	CODENAME=$(lsb_release -cs) || return 1
	OSARCH=$(dpkg --print-architecture) || return 1
	_checkdistro || return 1
	_checkovz || return 1
	_checkkernel || return 1
	local domain_check_failed=0
	_check_domain_dns || domain_check_failed=1
	_init || return 1
	local -a optional_failures=()
	# Skip locale regeneration if in generate config mode
	_apply_locale || _optional_failure "System locale could not be configured"
	_apply_timezone || _optional_failure "Timezone could not be configured"
	_apply_swap || _optional_failure "Swap could not be configured"
	# record start time
	starttime=$(date +%s)
	system_lock_owned=0
	if (set -o noclobber; printf '%s\n' "$$" >/install/.system.lock) 2>/dev/null; then
		system_lock_owned=1
	elif [[ ! -f /install/.system.lock ]]; then
		_error "Could not create /install/.system.lock."
		return 1
	fi
	{
		if ((domain_check_failed)); then
			_optional_failure "TLS domain does not resolve to this host: $lecert_domain"
		fi
		sleep 0.5
		# change hostname
		echo -e "XXX\n0\n$INFO_TEXT_PROGRESS_1\nXXX"
		if [[ $hostname != "" ]]; then
			_chhostname || exit 1
			echo -e "XXX\n03\n$INFO_TEXT_PROGRESS_1$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n03\n$INFO_TEXT_PROGRESS_1$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# change ssh port
		echo -e "XXX\n03\n$INFO_TEXT_PROGRESS_2\nXXX"
		if [[ $chport == "default" ]]; then
			echo -e "XXX\n06\n$INFO_TEXT_PROGRESS_2$INFO_TEXT_SKIP\nXXX"
		else
			_changeport || exit 1
			echo -e "XXX\n06\n$INFO_TEXT_PROGRESS_2$INFO_TEXT_DONE\nXXX"
		fi
		sleep 1

		# replace source.list
		echo -e "XXX\n06\n$INFO_TEXT_PROGRESS_4\nXXX"
		if [[ $chsource == 1 ]]; then
			_chsource || exit 1
			echo -e "XXX\n10\n$INFO_TEXT_PROGRESS_4$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n10\n$INFO_TEXT_PROGRESS_4$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# installation dependence
		echo -e "XXX\n10\n$INFO_TEXT_PROGRESS_5\nXXX"
		_dependency || exit 1
		echo -e "XXX\n15\n$INFO_TEXT_PROGRESS_5$INFO_TEXT_DONE\nXXX"
		sleep 1

		# setup admin account
		echo -e "XXX\n15\n$INFO_TEXT_PROGRESS_3\nXXX"
		_genadmin || exit 1
		echo -e "XXX\n20\n$INFO_TEXT_PROGRESS_3$INFO_TEXT_DONE\nXXX"
		sleep 1

		# install dashboard
		echo -e "XXX\n20\n$INFO_TEXT_PROGRESS_7\nXXX"
		_insdashboard || exit 1
		echo -e "XXX\n30\n$INFO_TEXT_PROGRESS_7$INFO_TEXT_DONE\nXXX"
		sleep 1

		# install 3rd-part apps
		echo -e "XXX\n30\n$INFO_TEXT_PROGRESS_8\nXXX"
		if [[ $app_list != "" ]]; then
			if _insapps; then
				echo -e "XXX\n80\n$INFO_TEXT_PROGRESS_8$INFO_TEXT_DONE\nXXX"
			else
				_optional_failure "Application installation failed: ${INSTALL_FAILED_APPS:-unknown}"
			fi
		else
			echo -e "XXX\n80\n$INFO_TEXT_PROGRESS_8$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# disable pubilc tracker
		echo -e "XXX\n80\n$INFO_TEXT_PROGRESS_9\nXXX"
		if [[ $denytracker == 1 ]]; then
			if _denytracker; then
				echo -e "XXX\n85\n$INFO_TEXT_PROGRESS_9$INFO_TEXT_DONE\nXXX"
			else
				_optional_failure "Public tracker blocking could not be configured"
			fi
		else
			echo -e "XXX\n85\n$INFO_TEXT_PROGRESS_9$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# setup vsftpd
		echo -e "XXX\n85\n$INFO_TEXT_PROGRESS_10\nXXX"
		if [[ $ftp == 1 ]]; then
			if _setvsftpd; then
				echo -e "XXX\n90\n$INFO_TEXT_PROGRESS_10$INFO_TEXT_DONE\nXXX"
			else
				_optional_failure "FTP could not be configured"
			fi
		else
			echo -e "XXX\n90\n$INFO_TEXT_PROGRESS_10$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# setup BBR
		echo -e "XXX\n90\n$INFO_TEXT_PROGRESS_11\nXXX"
		if [[ $enable_bbr == 1 ]]; then
			if _insbbr; then
				if _fixbcm; then
					echo -e "XXX\n95\n$INFO_TEXT_PROGRESS_11$INFO_TEXT_DONE\nXXX"
				else
					_optional_failure "Broadcom firmware could not be installed"
				fi
			else
				_optional_failure "BBR could not be configured"
			fi
		else
			echo -e "XXX\n95\n$INFO_TEXT_PROGRESS_11$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# setup domain
		echo -e "XXX\n95\n$INFO_TEXT_PROGRESS_12\nXXX"
		if [[ $lecert_domain != "" ]] && [[ "$app_list" =~ "lecert" ]] && (( ! domain_check_failed )); then
			if bash "${local_setup_script}lecert.sh" "${OUTTO}" "$lecert_domain" >/dev/null 2>&1; then
				echo -e "XXX\n97\n$INFO_TEXT_PROGRESS_12$INFO_TEXT_DONE\nXXX"
			else
				_optional_failure "TLS certificate could not be installed"
			fi
		else
			echo -e "XXX\n97\n$INFO_TEXT_PROGRESS_12$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# Finish
		echo -e "XXX\n99\n$INFO_TEXT_PROGRESS_13\nXXX"
		systemctl stop apache2 >/dev/null 2>&1
		systemctl disable apache2 >/dev/null 2>&1
		APACHE_PKGS='apache2 apache2-bin apache2-data'
		for depend in $APACHE_PKGS; do
			DEBIAN_FRONTEND=noninteractive apt-get -y remove "${depend}" >>"${OUTTO}" 2>&1
			DEBIAN_FRONTEND=noninteractive apt-get -y purge "${depend}" >>"${OUTTO}" 2>&1
		done
		apt-get -y autoclean >/dev/null 2>&1
		echo -e "XXX\n100\n$INFO_TEXT_PROGRESS_14\nXXX"
		sleep 0.5
		if ((${#optional_failures[@]})); then
			printf 'Installation completed with failures:\n' >&2
			printf ' - %s\n' "${optional_failures[@]}" >&2
			exit 2
		fi
	} | whiptail --title "$INFO_TITLE_PROGRESS" --gauge "$INFO_TEXT_PROGRESS_0" 8 64 0
	local -a install_status=("${PIPESTATUS[@]}")
	if [[ $system_lock_owned == 1 && -f /install/.system.lock ]] &&
		[[ $(cat /install/.system.lock 2>/dev/null) == "$$" ]]; then
		rm -f /install/.system.lock || { _error "Could not remove the system installation marker."; return 1; }
		system_lock_owned=0
	fi
	if [[ ${install_status[0]} != 0 ]]; then
		_error "Installation failed (worker=${install_status[0]}, progress UI=${install_status[1]})."
		return 1
	fi
	[[ ${install_status[1]} == 0 ]] || printf 'Warning: installation progress UI failed\n' >&2
	# record end time
	endtime=$(date +%s)
	timeused=$((endtime - starttime))
	timeusedmin=$((timeused / 60))
	echo -e "\n################################################################################" >>"${OUTTO}" 2>&1
	echo "Install finished in $timeusedmin Min" >>"${OUTTO}" 2>&1
	if [[ $autoreboot == 1 ]]; then 
		reboot; 
	elif [[ $autoreboot == 3 ]]; then 
		exit 0
	fi
	if (whiptail --title "$INFO_TITLE_FIN" --yesno "$INFO_TEXT_FIN_1$timeusedmin$INFO_TEXT_FIN_MIN\n$INFO_TEXT_FIN_2" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
		reboot
	else
		exit 0
	fi
}

function _summary() {
	_validate_loaded_config
	local summary_title=$INFO_TITLE_SUMMARY summary_intro=$INFO_TEXT_SUMMARY_1 confirm_button=$BUTTON_CONFIRM
	if [[ $config_gen_mode == 1 ]]; then
		summary_title=$INFO_TITLE_CONFIG_SUMMARY
		summary_intro=$INFO_TEXT_CONFIG_SUMMARY
		confirm_button=$BUTTON_GENERATE
	fi
	# Check if we should skip summary and go directly to install
	if [[ $skip_summary -eq 1 && $config_gen_mode -eq 0 ]]; then
		_startinstall
		return
	fi
	
	# Summary list
	ip=$(_local_ip)
	if [[ ${chport} == "default" && $config_gen_mode == 1 ]]; then
		sshport=default
	elif [[ ${chport} == "default" ]]; then
		sshport=$(grep -e '#*Port' < /etc/ssh/sshd_config | grep -Eo "[0-9]+" )
	else
		sshport=${chport}
	fi
	if (whiptail --title "$summary_title" --yesno "${summary_intro}\n\n\
${INFO_TEXT_SUMMARY_2} $(echo "$OUTTO" | cut -d " " -f 1)\n\
$(if [[ $lecert_domain != "" ]]; then printf "${INFO_TEXT_SUMMARY_20} $lecert_domain"; fi)\n\
$(if [[ $hostname != "" ]]; then printf "${INFO_TEXT_SUMMARY_3} $hostname"; fi)\n\
${INFO_TEXT_SUMMARY_4} ${ip}:$sshport\n\
${INFO_TEXT_SUMMARY_5} $username\n\
${INFO_TEXT_SUMMARY_6} $password\n\
$(if [[ $ftp == 1 ]]; then printf "${INFO_TEXT_SUMMARY_11} $ftp_ip:5757"; fi)\n\
${INFO_TEXT_SUMMARY_12} $dash_theme ${INFO_TEXT_SUMMARY_13}\
$(if [[ $chsource == 1 ]]; then printf "\n${INFO_TEXT_SUMMARY_14}"; fi)\
$(case "${cdn}" in
	cf) echo -e "\nCloudflare ${INFO_TEXT_SUMMARY_19}";;
	sf) echo -e "\nSourceforge ${INFO_TEXT_SUMMARY_19}";;
	osdn) echo -e "\nOSDN ${INFO_TEXT_SUMMARY_19}";;
	github|*) echo -e "\nGitHub ${INFO_TEXT_SUMMARY_19}";;
esac)\
$(if [[ $app_list != "" ]]; then
		echo -e "\n${INFO_TEXT_SUMMARY_15}"
		for i in "${app_list[@]}"; do
			echo -e "${i} "
		done
		echo -e "\n"
	fi)\
$(if [[ "$app_list" =~ "rtorrent" ]]; then echo -e "\n$rtgui ${INFO_TEXT_SUMMARY_16}\n"; fi)\
$(if [[ $enable_bbr == 1 ]]; then echo -e "\n${INFO_TEXT_SUMMARY_18}\n"; fi)\
$(if [[ $autoreboot == 1 ]]; then echo -e "\n${INFO_TEXT_SUMMARY_17}\n"; fi)\
" --yes-button "$confirm_button" --no-button "$BUTTON_CANCLE" 28 72); then
		# Check if we're in config generation mode
		# Skip locale regeneration if in generate config mode
		if [[ $config_gen_mode -eq 1 ]]; then
			_generate_config
		else
			# call installation function
			# Excute installation
			_startinstall
		fi
	elif (whiptail --title "$INFO" --yesno "$INFO_TEXT_ABORT" --yes-button "$BUTTON_EDIT" --no-button "$BUTTON_ABORT" 8 72); then
		# display a menu for each question
		local menu_choice
		menu_choice=$(
			whiptail --title "$INFO_TITLE_EDIT" --menu "$INFO_TEXT_EDIT" 20 48 12 \
				"domain" "$CHOICE_TEXT_EDIT_14" \
				"hostname" "$CHOICE_TEXT_EDIT_1" \
				"ssh port" "$CHOICE_TEXT_EDIT_2" \
				"user name" "$CHOICE_TEXT_EDIT_3" \
				"password" "$CHOICE_TEXT_EDIT_4" \
				"ftp" "$CHOICE_TEXT_EDIT_7" \
				"dashboard theme" "$CHOICE_TEXT_EDIT_8" \
				"source.list" "$CHOICE_TEXT_EDIT_9" \
				"cdn" "$CHOICE_TEXT_EDIT_13" \
				"auth provider" "$CHOICE_TEXT_EDIT_15" \
				"softwares" "$CHOICE_TEXT_EDIT_10" \
				"BBR" "$CHOICE_TEXT_EDIT_12" \
				"autoreboot" "$CHOICE_TEXT_EDIT_11" 3>&1 1>&2 2>&3
		)
		case $menu_choice in
		"domain") _askdomain ;;
		"hostname") _askhostname ;;
		"ssh port") _askchport ;;
		"user name") _askusrname ;;
		"password") _askpasswd ;;
		"ftp") _askvsftpd ;;
		"dashboard theme") _askdashtheme ;;
		"source.list") _askchsource ;;
		"cdn") _askcdn ;;
		"auth provider") _askauthprovider ;;
		"softwares") _askapps ;;
		"BBR") _askbbr ;;
		"autoreboot") _askautoreboot ;;
		esac
		_summary
	else
		# Abort Installation
		exit 1
	fi
}

################################################################################
# USAGE
################################################################################
function _usage() {
	echo -e "\nQuickBox Lite Setup Script
\nUsage: bash $(basename "$0") -u username -p password [OPTS]
\nOptions:
  NOTE: * is required anyway

  -d, --domain <domain>            setup domain for server
  -H, --hostname <hostname>        setup hostname, make no change by default
  -P, --port <1-65535>             setup ssh service port, use 4747 by default
  -u, --username <username*>       username is required here
  -p, --password <password*>       your password is required here
  -r, --reboot                     reboot after installation finished (default no)
  -s, --source <us|au|cn|fr|de|jp|ru|uk|tuna>  
                                   choose apt source (default unchange)
  -t, --theme <defaulted|smoked>   choose a theme for your dashboard (default smoked)
  --tz,--timezone <timezone>       setup a timezone for server (e.g. GMT-8 or Europe/Berlin)
  --lang <en|zh>                   choose a TUI language (default english)
  --with-log,no-log                install with log to file or not (default yes)
  --with-ftp,--no-ftp              install ftp or not (default yes)
  --ftp-ip <ip address>            manually setup ftp ip
  --with-bbr,--no-bbr              install bbr or not (default no)
  --with-cf                        use cloudflare instead of github
  --with-sf                        use sourceforge instead of github
  --with-osdn                      use osdn(jp)  instead of github
  --with-github                    use github
	--auth-provider <none|authelia|vouchproxy>
																	 setup an auth provider during install
	--auth-mode <password|mfa|passwordless>
																	 Authelia auth mode (authelia only)
	--admin-email <email>            admin email for Authelia passwordless
	--smtp-host <host>               smtp host for Authelia passwordless
	--smtp-port <port>               smtp port for Authelia passwordless
	--smtp-username <user>           smtp username for Authelia passwordless
	--smtp-password <pass>           smtp password for Authelia passwordless
	--smtp-sender <email>            smtp sender for Authelia passwordless
	--oidc-auth-url <url>            Vouch Proxy OIDC authorize endpoint
	--oidc-token-url <url>           Vouch Proxy OIDC token endpoint
	--oidc-userinfo-url <url>        Vouch Proxy OIDC userinfo endpoint
	--oidc-client-id <id>            Vouch Proxy OIDC client id
	--oidc-client-secret <secret>    Vouch Proxy OIDC client secret
	--oidc-end-session-endpoint <url> Vouch Proxy logout endpoint
	--oidc-user <user>               Vouch Proxy OIDC user allowed to access local admin
	--oidc-user-map <csv>            Vouch Proxy OIDC usernames mapped to local admin
	--oidc-email-domains <csv>       Vouch Proxy allowed email domains
  --with-APPNAME                   install an application
  --qbittorrent-version            specify the qBittorrent version
  --deluge-version                 specify the Deluge version
  --qbit-libt-version              specify the Libtorrent version for qBittorrent
  --de-libt-version                specify the Libtorrent version for Deluge
  --rtorrent-version               specify the rTorrent version

  KICKSTART CONFIG OPTIONS:
	-c, --config <file|url>          load installation config from JSON file or HTTPS URL (skips TUI prompts)
	--allow-http-config             allow HTTP URL for --config (testing only; insecure)
  --generate-config                collect settings and save JSON without applying installation settings
                                   missing jq/whiptail may be installed (root + apt required)
                                   run setup.sh directly; the one-key wrapper rejects this mode
  --config-output <file>           set output path for --generate-config (default: ./quickbox-kickstart.json)
  --skip-summary                   with --config, skip final review and go straight to install

    Available applications:
    rtorrent | rutorrent | flood | transmission | qbittorrent
    deluge | mktorrent | ffmpeg | filebrowser | linuxrar

  -h, --help                       display this help and exit"
}

################################################################################
# FLAGS INIT
################################################################################
uilang="en"
OUTTO="/root/quickbox.$PPID.log"
ftp=1
ftp_ip=""
onekey=0
chport=4747
chsource=0
change_source=0
enable_bbr=0
autoreboot=3
dash_theme="smoked"
hostname=""
timezone=""
swap_path="/root/.swapfile"
domain=""
lecert_domain=""
auth_domain=""
app_list=""
rtgui="rutorrent"
qbit_ver=""
de_ver=""
qbit_libt_ver=""
de_libt_ver=""
rt_ver=""
tr_ver=""
config_auth_provider_explicit=0
loaded_auth_provider=""
auth_provider="none"
authelia_auth_mode="password"
ADMIN_EMAIL=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USERNAME=""
SMTP_PASSWORD=""
SMTP_SENDER=""
OIDC_AUTH_URL=""
OIDC_TOKEN_URL=""
OIDC_USERINFO_URL=""
OIDC_CLIENT_ID=""
OIDC_CLIENT_SECRET=""
OIDC_END_SESSION_ENDPOINT=""
OIDC_USER=""
OIDC_USER_MAP=""
EMAIL_DOMAINS=""
config_gen_mode=0
config_output_file="./quickbox-kickstart.json"
config_file=""
resolved_config_file=""
config_temp_file=""
config_output_temp_file=""
skip_summary=0
allow_http_config=0
declare -A _cli_override=()
_cli_override_packages=""

################################################################################
# HELPER FUNCTIONS FOR KICKSTART CONFIG
################################################################################
# Shared validation predicates used by both the TUI prompts and the kickstart
# config validators. They perform the raw checks only and return a status code
# identifying which rule failed, so each caller can render its own message.

# 0=valid 1=reserved name 2=bad length 3=bad charset
function _check_username() {
	local candidate="$1"
	local count=${#candidate}
	local reserved_names=('adm' 'admin' 'audio' 'backup' 'bin' 'cdrom' 'crontab' 'daemon' 'dialout' 'dip' 'disk' 'fax' 'floppy' 'fuse' 'games' 'gnats' 'irc' 'kmem' 'landscape' 'libuuid' 'list' 'lp' 'mail' 'man' 'messagebus' 'mlocate' 'netdev' 'news' 'nobody' 'nogroup' 'operator' 'plugdev' 'proxy' 'root' 'sasl' 'shadow' 'src' 'ssh' 'sshd' 'staff' 'sudo' 'sync' 'sys' 'syslog' 'tape' 'tty' 'users' 'utmp' 'uucp' 'video' 'voice' 'whoopsie' 'www-data')
	if echo "${reserved_names[@]}" | grep -wq "$candidate"; then
		return 1
	elif [[ $count -lt 3 || $count -gt 32 ]]; then
		return 2
	elif ! [[ "$candidate" =~ ^[a-z][-a-z0-9_]*$ ]]; then
		return 3
	fi
	return 0
}

# 0=valid 1=too short 2=too weak
function _check_password() {
	local candidate="$1"
	if [[ ${#candidate} -lt 8 ]]; then
		return 1
	fi
	if ! grep -qP '(?=^.{8,32}$)(?=^[^\s]*$)(?=.*\d)(?=.*[A-Z])(?=.*[a-z])' <<< "$candidate"; then
		return 2
	fi
	return 0
}

# 0=valid 1=invalid
function _check_port() {
	local candidate="$1"
	[[ $candidate =~ ^[0-9]+$ ]] && ((candidate >= 1 && candidate <= 65535)) && ((candidate != 80 && candidate != 443))
}

function _validate_username() {
	_check_username "$1"
	case $? in
	1)
		_error "Do not use reversed user name !"
		return 1
		;;
	2)
		_error "User name cannot less than 3 or more than 32 characters !"
		return 1
		;;
	3)
		_error "Your username must start from a lower case letter and the username"
		_error "must contain only lowercase letters, numbers, hyphens, and underscores."
		return 1
		;;
	esac
	return 0
}

function _validate_password() {
	_check_password "$1"
	case $? in
	1)
		_error "Your password cannot less than 8 characters !"
		return 1
		;;
	2)
		_error "Your password must consist:"
		_error "1.digital numbers"
		_error "2.at least one lower case letter"
		_error "3.one upper case letter"
		return 1
		;;
	esac
	return 0
}

function _validate_port() {
	if ! _check_port "$1"; then
		_error "Invalid SSH port: $1"
		return 1
	fi
	return 0
}

function _validate_enum() {
	# $1=label $2=value $3=allowed-regex (empty value is accepted)
	local label="$1"
	local value="$2"
	local allowed="$3"
	if [[ -n $value && ! "$value" =~ ^($allowed)$ ]]; then
		_error "Invalid $label: $value"
		return 1
	fi
	return 0
}

function _cleanup_config_temp_file() {
	local temporary
	for temporary in "$config_temp_file" "$config_output_temp_file"; do
		[[ -z $temporary ]] || rm -f -- "$temporary"
	done
	if [[ ${system_lock_owned:-0} == 1 && -f /install/.system.lock ]] &&
		[[ $(cat /install/.system.lock 2>/dev/null) == "$$" ]]; then
		rm -f /install/.system.lock
	fi
}

function _resolve_config_source() {
	local config_source="$1"
	local temp_file
	if [[ $config_source =~ ^http:// ]] && [[ $allow_http_config -ne 1 ]]; then
		_error "Remote config URLs must use HTTPS: $config_source"
		_error "Use --allow-http-config for testing only."
		exit 1
	elif [[ $config_source =~ ^http:// ]] && [[ $allow_http_config -eq 1 ]]; then
		_warning "Using insecure HTTP config URL for testing: $config_source"
	fi
	if [[ ! $config_source =~ ^https?:// ]]; then
		resolved_config_file="$config_source"
		return 0
	fi
	temp_file=$(mktemp /tmp/quickbox-kickstart.XXXXXX.json) || {
		_error "Failed to create temporary config file"
		exit 1
	}
	chmod 600 "$temp_file"
	if ! curl -fsSL --retry 3 --connect-timeout 10 --max-time 60 "$config_source" -o "$temp_file"; then
		rm -f "$temp_file"
		_error "Failed to download config from $config_source"
		exit 1
	fi
	config_temp_file="$temp_file"
	resolved_config_file="$temp_file"
}

function _validate_loaded_config() {
	_normalize_config || exit 1
	[[ $ftp == 0 || $ftp == 1 ]] || { _error "Invalid ftp value"; exit 1; }
	[[ $enable_bbr == 0 || $enable_bbr == 1 ]] || { _error "Invalid bbr value"; exit 1; }
	[[ ${denytracker:-0} == 0 || ${denytracker:-0} == 1 ]] || { _error "Invalid deny_tracker value"; exit 1; }
	[[ $autoreboot == 0 || $autoreboot == 1 || $autoreboot == 3 ]] || { _error "Invalid autoreboot value"; exit 1; }
	_validate_username "$username" || exit 1
	_validate_password "$password" || exit 1
	if [[ $chport != default ]]; then
		_validate_port "$chport" || exit 1
	fi
	_validate_timezone "$timezone" || exit 1
	local version
	for version in "$qbit_ver" "$de_ver" "$qbit_libt_ver" "$de_libt_ver" "$rt_ver" "$tr_ver"; do
		if [[ -n $version && ! $version =~ ^[A-Za-z0-9][A-Za-z0-9._+-]*$ ]]; then
			_error "Invalid software version: $version"
			exit 1
		fi
	done
	if [[ -z $uilang || -z $dash_theme || -z $rtgui || -z $authelia_auth_mode ]]; then
		_error "Language, theme, rTorrent GUI and authentication mode cannot be empty"
		exit 1
	fi
	local configured_domain
	for configured_domain in "$domain" "$lecert_domain" "$auth_domain"; do
		if [[ -n $configured_domain ]]; then
			_validate_domain "$configured_domain" || exit 1
		fi
	done
	_validate_enum "language" "$uilang" "en|zh" || exit 1
	_validate_enum "theme" "$dash_theme" "defaulted|smoked" || exit 1
	_validate_enum "rTorrent GUI" "$rtgui" "rutorrent|flood" || exit 1
	_validate_enum "apt source" "$mirror" "us|au|cn|fr|de|jp|ru|uk|tuna" || exit 1
	_validate_enum "CDN option" "$cdn" "cf|sf|osdn|github" || exit 1
	_validate_enum "auth provider" "$auth_provider" "none|authelia|vouchproxy" || exit 1
	_validate_enum "Authelia auth mode" "$authelia_auth_mode" "password|mfa|passwordless" || exit 1
}

function _apply_cli_overrides() {
	# Re-apply any values explicitly provided on the command line so that CLI
	# flags take precedence over values loaded from the kickstart config file.
	local key
	for key in "${!_cli_override[@]}"; do
		printf -v "$key" '%s' "${_cli_override[$key]}"
	done
	if [[ -n ${_cli_override[auth_provider]:-} ]]; then
		config_auth_provider_explicit=1
	fi
	# A CLI provider choice replaces the provider package implied by the loaded
	# provider. Other provider packages remain and will be rejected as conflicts.
	if [[ -n ${_cli_override[auth_provider]:-} && $loaded_auth_provider != "$auth_provider" ]]; then
		local old_provider_pkg=""
		case "$loaded_auth_provider" in authelia) old_provider_pkg=authelia;; vouchproxy) old_provider_pkg=vouchproxy;; esac
		if [[ -n $old_provider_pkg ]]; then
			_remove_app "$old_provider_pkg"
		fi
	fi
	# Package flags are additive to the config's package list
	if [[ -n $_cli_override_packages ]]; then
		app_list=$(echo "$app_list $_cli_override_packages" | xargs)
	fi
}

function _validate_timezone() {
	if [[ -n $1 && ! $1 =~ ^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$ ]]; then
		_error "Invalid timezone: $1"
		return 1
	fi
}

function _validate_domain() {
	local label
	local -a labels
	if [[ -z $1 || ${#1} -gt 253 || $1 == .* || $1 == *. || $1 == *..* ]]; then
		_error "Invalid domain: $1"
		return 1
	fi
	IFS=. read -r -a labels <<< "$1"
	for label in "${labels[@]}"; do
		if [[ ${#label} -gt 63 || ! $label =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$ ]]; then
			_error "Invalid domain: $1"
			return 1
		fi
	done
}

function _check_domain_dns() {
	local check_domain=$lecert_domain
	[[ -z $check_domain ]] && return 0
	_get_ip
	local resolved_ip
	resolved_ip=$(curl -fsS --connect-timeout 10 --max-time 30 -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$check_domain&type=A" | jq -r '.Answer[]? | select(.type == 1) | .data' | head -1)
	if [[ -z $ip || $resolved_ip != "$ip" ]]; then
		_error "Domain does not resolve to this installation host: $check_domain"
		return 1
	fi
	[[ -n $hostname ]] || hostname=$check_domain
}

function _validate_config_document() {
	local config_file="$1"
	# Read the complete stream so empty input, scalar JSON, and multiple documents fail.
	if ! jq -e -s '
		length == 1 and
		(.[0] | type == "object") and
		(.[0] as $c |
			(["lang","hostname","username","password","ftp_ip","theme","timezone","mirror","cdn","auth_provider","auth_domain","rtorrent_gui","swap_path","lecert_domain","ssh_port","authelia","vouch","packages","log","ftp","deny_tracker","bbr","autoreboot","change_source","qbittorrent_version","deluge_version","qbit_libt_version","de_libt_version","rtorrent_version","transmission_version"] as $keys |
			 all($keys[]; . as $key | (($c | has($key)) | not) or $c[$key] == null or
				 (if $key == "ssh_port" then ($c[$key] | (type == "string" or type == "number"))
				  elif $key == "authelia" or $key == "vouch" then ($c[$key] | type == "object")
				  elif $key == "packages" then ($c[$key] | type == "array" and all(.[]; type == "string" and test("^[a-z0-9_-]+$")))
				  elif $key == "log" or $key == "ftp" or $key == "deny_tracker" or $key == "bbr" or $key == "autoreboot" or $key == "change_source" then ($c[$key] | type == "boolean")
				  else ($c[$key] | type == "string") end)) and
			 all(["mode","admin_email","smtp_host","smtp_port","smtp_username","smtp_password","smtp_sender"][]; . as $key | ($c.authelia[$key] == null) or (if $key == "smtp_port" then ($c.authelia[$key] | type == "string" or type == "number") else ($c.authelia[$key] | type == "string") end)) and
			 all(["oidc_auth_url","oidc_token_url","oidc_userinfo_url","oidc_client_id","oidc_client_secret","oidc_end_session_endpoint","oidc_user","oidc_user_map","email_domains"][]; . as $key | ($c.vouch[$key] == null) or ($c.vouch[$key] | type == "string")))
		)
	' "$config_file" >/dev/null 2>&1; then
		_error "Config must contain exactly one JSON object with valid field types: $config_file"
		return 1
	fi
}

function _load_config() {
	local config_file="$1"
	if [[ ! -f "$config_file" ]]; then
		_error "Config file not found: $config_file"
		exit 1
	fi
	_validate_config_document "$config_file" || exit 1
	_info "Loading configuration from $config_file"
	# Load all configuration variables from JSON
	uilang=$(jq -r '.lang // "en"' "$config_file")
	if [[ $(jq -r 'if .log == null then true else .log end' "$config_file") == "true" ]]; then OUTTO="/root/quickbox.$PPID.log"; else OUTTO="/dev/null 2>&1"; fi
	hostname=$(jq -r '.hostname // ""' "$config_file")
	chport=$(jq -r '.ssh_port // 4747 | tostring' "$config_file")
	username=$(jq -r '.username // ""' "$config_file")
	password=$(jq -r '.password // ""' "$config_file")
	ftp=$(jq -r 'if .ftp == null then false else .ftp end | if . then "1" else "0" end' "$config_file")
	ftp_ip=$(jq -r '.ftp_ip // ""' "$config_file")
	dash_theme=$(jq -r '.theme // "smoked"' "$config_file")
	timezone=$(jq -r '.timezone // ""' "$config_file")
	mirror=$(jq -r '.mirror // "us"' "$config_file")
	cdn=$(jq -r '.cdn // "github"' "$config_file")
	# Legacy inference: absent/null/empty/us mirror means keep source unchanged;
	# a non-us mirror means apply it. New change_source preserves explicit us.
	if jq -e 'has("change_source") and .change_source != null' "$config_file" >/dev/null; then
		change_source=$(jq -r '.change_source' "$config_file")
	else
		change_source=$(jq -r 'if (.mirror // "") == "" or .mirror == "us" then false else true end' "$config_file")
	fi
	chsource=$([[ $change_source == true ]] && echo 1 || echo 0)
	enable_bbr=$(jq -r 'if .bbr then "1" else "0" end' "$config_file")
	denytracker=$(jq -r 'if .deny_tracker then "1" else "0" end' "$config_file")
	autoreboot=$(jq -r 'if .autoreboot then "1" else "3" end' "$config_file")
	auth_provider=$(jq -r '.auth_provider // "none"' "$config_file")
	config_auth_provider_explicit=$(jq -r 'if has("auth_provider") and .auth_provider != null then "1" else "0" end' "$config_file")
	loaded_auth_provider="$auth_provider"
	auth_domain=$(jq -r '.auth_domain // ""' "$config_file")
	authelia_auth_mode=$(jq -r '.authelia.mode // "password"' "$config_file")
	ADMIN_EMAIL=$(jq -r '.authelia.admin_email // ""' "$config_file")
	SMTP_HOST=$(jq -r '.authelia.smtp_host // ""' "$config_file")
	SMTP_PORT=$(jq -r '.authelia.smtp_port // "587" | tostring' "$config_file")
	SMTP_USERNAME=$(jq -r '.authelia.smtp_username // ""' "$config_file")
	SMTP_PASSWORD=$(jq -r '.authelia.smtp_password // ""' "$config_file")
	SMTP_SENDER=$(jq -r '.authelia.smtp_sender // ""' "$config_file")
	OIDC_AUTH_URL=$(jq -r '.vouch.oidc_auth_url // ""' "$config_file")
	OIDC_TOKEN_URL=$(jq -r '.vouch.oidc_token_url // ""' "$config_file")
	OIDC_USERINFO_URL=$(jq -r '.vouch.oidc_userinfo_url // ""' "$config_file")
	OIDC_CLIENT_ID=$(jq -r '.vouch.oidc_client_id // ""' "$config_file")
	OIDC_CLIENT_SECRET=$(jq -r '.vouch.oidc_client_secret // ""' "$config_file")
	OIDC_END_SESSION_ENDPOINT=$(jq -r '.vouch.oidc_end_session_endpoint // ""' "$config_file")
	OIDC_USER=$(jq -r '.vouch.oidc_user // ""' "$config_file")
	OIDC_USER_MAP=$(jq -r '.vouch.oidc_user_map // ""' "$config_file")
	EMAIL_DOMAINS=$(jq -r '.vouch.email_domains // ""' "$config_file")
	app_list=$(jq -r '(.packages // []) | join(" ")' "$config_file")
	if [[ $config_auth_provider_explicit == 0 ]]; then
		loaded_auth_provider=$(jq -r 'if ((.packages // []) | index("authelia")) then "authelia" elif ((.packages // []) | index("vouchproxy")) then "vouchproxy" else "none" end' "$config_file")
	fi
	rtgui=$(jq -r '.rtorrent_gui // "rutorrent"' "$config_file")
	swap_path=$(jq -r '.swap_path // "/root/.swapfile"' "$config_file")
	lecert_domain=$(jq -r '.lecert_domain // ""' "$config_file")
	qbit_ver=$(jq -r '.qbittorrent_version // ""' "$config_file")
	de_ver=$(jq -r '.deluge_version // ""' "$config_file")
	qbit_libt_ver=$(jq -r '.qbit_libt_version // ""' "$config_file")
	de_libt_ver=$(jq -r '.de_libt_version // ""' "$config_file")
	rt_ver=$(jq -r '.rtorrent_version // ""' "$config_file")
	tr_ver=$(jq -r '.transmission_version // ""' "$config_file")
	# Set onekey mode and skip TUI prompts
	onekey=1
	_success "Configuration loaded successfully"
}

function _normalize_config() {
	local package provider_pkg="" count=0 new_packages=""
	local -a packages
	read -r -a packages <<< "${app_list//$'\n'/ }"
	for package in "${packages[@]}"; do
		[[ -z $package ]] && continue
		case "$package" in
			rtorrent|rutorrent|flood|transmission|qbittorrent|deluge|mktorrent|ffmpeg|filebrowser|linuxrar|authelia|vouchproxy|lecert) ;;
			*) _error "Unsupported package: $package"; return 1 ;;
		esac
		case "$package" in
			authelia|vouchproxy)
				if [[ -z $provider_pkg ]]; then
					provider_pkg=$package
					count=1
				elif [[ $provider_pkg != "$package" ]]; then
					provider_pkg=$package
					((count+=1))
				fi
				;;
		esac
		[[ " $new_packages " == *" $package "* ]] || new_packages+=" $package"
	done
	app_list=${new_packages# }
	if (( count > 1 )); then _error "Authelia and Vouch Proxy are mutually exclusive"; return 1; fi
	local selected_pkg=""
	case "$auth_provider" in authelia) selected_pkg=authelia;; vouchproxy) selected_pkg=vouchproxy;; none) ;; *) _error "Invalid auth provider: $auth_provider"; return 1;; esac
	if [[ -n $provider_pkg && -n $selected_pkg && $provider_pkg != "$selected_pkg" ]]; then
		_error "Selected auth provider conflicts with packages list"; return 1
	fi
	if [[ -n $provider_pkg && $auth_provider == none ]]; then
		if [[ $config_auth_provider_explicit == 1 ]]; then _error "Auth provider 'none' conflicts with provider package"; return 1; fi
		auth_provider=$provider_pkg
		selected_pkg=$provider_pkg
	fi
	if [[ -n $selected_pkg && " $app_list " != *" $selected_pkg "* ]]; then app_list+="${app_list:+ }$selected_pkg"; fi
	change_source=$([[ $chsource == 1 ]] && echo true || echo false)
}

function _generate_config() {
	_info "Generating kickstart config file..."
	
	# Normalize app_list (checklist uses newline separator) to single spaced line,
	# then convert to a JSON array
	local app_list_norm
	app_list_norm=$(echo "$app_list" | tr '\n' ' ')
	local packages_json
	if ! packages_json=$(printf '%s' "$app_list_norm" | jq -R 'split(" ") | map(select(. != ""))'); then
		_error "Failed to serialize the package list"
		exit 1
	fi
	
	# Sanitize ssh_port to a numeric value (chport may be "default" or empty)
	# Keep the no-change sentinel. Numeric legacy values remain JSON numbers.
	local ssh_port_value
	if [[ $chport == default ]]; then
		ssh_port_value='"default"'
	elif [[ $chport =~ ^[0-9]+$ ]]; then
		ssh_port_value=$chport
	else
		_error "Invalid SSH port: $chport"
		exit 1
	fi
	
	# Build config JSON using jq with proper escaping via --arg
	local log_value
	if [[ "$OUTTO" == "/root/quickbox.$PPID.log" ]]; then
		log_value="true"
	else
		log_value="false"
	fi
	
	local ftp_value
	if [[ $ftp -eq 1 ]]; then
		ftp_value="true"
	else
		ftp_value="false"
	fi
	
	local deny_tracker_value
	if [[ ${denytracker:-0} -eq 1 ]]; then
		deny_tracker_value="true"
	else
		deny_tracker_value="false"
	fi
	
	local bbr_value
	if [[ $enable_bbr -eq 1 ]]; then
		bbr_value="true"
	else
		bbr_value="false"
	fi
	
	local autoreboot_value
	if [[ $autoreboot -eq 1 ]]; then
		autoreboot_value="true"
	else
		autoreboot_value="false"
	fi
	
	# Build JSON using jq with all values properly escaped
	local config_json
	if ! config_json=$(jq -n \
		--arg lang "${uilang:-en}" \
		--argjson log "$log_value" \
		--arg hostname "${hostname}" \
		--argjson ssh_port "${ssh_port_value}" \
		--arg username "${username}" \
		--arg password "${password}" \
		--argjson ftp "$ftp_value" \
		--arg ftp_ip "${ftp_ip}" \
		--arg theme "${dash_theme}" \
		--arg timezone "${timezone}" \
		--arg mirror "${mirror}" \
		--arg cdn "${cdn}" \
		--arg auth_provider "${auth_provider}" \
		--arg auth_domain "${auth_domain}" \
		--arg authelia_mode "${authelia_auth_mode}" \
		--arg admin_email "${ADMIN_EMAIL}" \
		--arg smtp_host "${SMTP_HOST}" \
		--arg smtp_port "${SMTP_PORT}" \
		--arg smtp_username "${SMTP_USERNAME}" \
		--arg smtp_password "${SMTP_PASSWORD}" \
		--arg smtp_sender "${SMTP_SENDER}" \
		--arg oidc_auth_url "${OIDC_AUTH_URL}" \
		--arg oidc_token_url "${OIDC_TOKEN_URL}" \
		--arg oidc_userinfo_url "${OIDC_USERINFO_URL}" \
		--arg oidc_client_id "${OIDC_CLIENT_ID}" \
		--arg oidc_client_secret "${OIDC_CLIENT_SECRET}" \
		--arg oidc_end_session_endpoint "${OIDC_END_SESSION_ENDPOINT}" \
		--arg oidc_user "${OIDC_USER}" \
		--arg oidc_user_map "${OIDC_USER_MAP}" \
		--arg email_domains "${EMAIL_DOMAINS}" \
		--argjson deny_tracker "$deny_tracker_value" \
		--argjson bbr "$bbr_value" \
		--arg swap_path "${swap_path}" \
		--argjson autoreboot "$autoreboot_value" \
		--arg lecert_domain "${lecert_domain}" \
		--arg rtorrent_gui "${rtgui}" \
		--argjson change_source "$change_source" \
		--arg qbittorrent_version "$qbit_ver" \
		--arg deluge_version "$de_ver" \
		--arg qbit_libt_version "$qbit_libt_ver" \
		--arg de_libt_version "$de_libt_ver" \
		--arg rtorrent_version "$rt_ver" \
		--arg transmission_version "$tr_ver" \
		--argjson packages "$packages_json" \
		'{lang: $lang, log: $log, hostname: $hostname, ssh_port: $ssh_port, username: $username, password: $password, ftp: $ftp, ftp_ip: $ftp_ip, theme: $theme, timezone: $timezone, mirror: $mirror, change_source: $change_source, cdn: $cdn, auth_provider: $auth_provider, auth_domain: $auth_domain, authelia: {mode: $authelia_mode, admin_email: $admin_email, smtp_host: $smtp_host, smtp_port: $smtp_port, smtp_username: $smtp_username, smtp_password: $smtp_password, smtp_sender: $smtp_sender}, vouch: {oidc_auth_url: $oidc_auth_url, oidc_token_url: $oidc_token_url, oidc_userinfo_url: $oidc_userinfo_url, oidc_client_id: $oidc_client_id, oidc_client_secret: $oidc_client_secret, oidc_end_session_endpoint: $oidc_end_session_endpoint, oidc_user: $oidc_user, oidc_user_map: $oidc_user_map, email_domains: $email_domains}, packages: $packages, rtorrent_gui: $rtorrent_gui, deny_tracker: $deny_tracker, bbr: $bbr, swap_path: $swap_path, autoreboot: $autoreboot, lecert_domain: $lecert_domain, qbittorrent_version: $qbittorrent_version, deluge_version: $deluge_version, qbit_libt_version: $qbit_libt_version, de_libt_version: $de_libt_version, rtorrent_version: $rtorrent_version, transmission_version: $transmission_version}' \
	); then
		_error "Failed to generate valid JSON config"
		exit 1
	fi
	if ! printf '%s\n' "$config_json" | jq -e 'type == "object"' >/dev/null; then
		_error "Failed to generate a JSON object"
		exit 1
	fi
	if [[ -d $config_output_file ]] || ! config_output_temp_file=$(mktemp "$(dirname -- "$config_output_file")/.quickbox-config.XXXXXX"); then
		_error "Cannot create config output: $config_output_file"
		exit 1
	fi
	if ! chmod 600 "$config_output_temp_file" ||
		! printf '%s\n' "$config_json" >"$config_output_temp_file" ||
		! mv -fT -- "$config_output_temp_file" "$config_output_file"; then
		_error "Failed to write config: $config_output_file"
		exit 1
	fi
	config_output_temp_file=""
	_success "Config file generated: $config_output_file"
	_warning "IMPORTANT: This config file contains passwords in plaintext (permissions: 600)."
	exit 0
}

################################################################################
# OPT GENERATOR
################################################################################
if ! ARGS=$(getopt -a -o c:d:hrH:p:P:s:t:u: -l config:,allow-http-config,generate-config,config-output:,skip-summary,domain:,help,ftp-ip:,lang:,reboot,with-log,no-log,with-ftp,no-ftp,with-bbr,no-bbr,with-cf,with-sf,with-osdn,with-github,auth-provider:,auth-mode:,admin-email:,smtp-host:,smtp-port:,smtp-username:,smtp-password:,smtp-sender:,oidc-auth-url:,oidc-token-url:,oidc-userinfo-url:,oidc-client-id:,oidc-client-secret:,oidc-end-session-endpoint:,oidc-user:,oidc-user-map:,oidc-email-domains:,with-rtorrent,with-rutorrent,with-flood,with-transmission,with-qbittorrent,with-deluge,with-mktorrent,with-ffmpeg,with-filebrowser,with-linuxrar,qbittorrent-version:,deluge-version:,qbit-libt-version:,de-libt-version:,rtorrent-version:,transmission-version:,hostname:,port:,username:,password:,source:,theme:,tz:,timezone: -- "$@")
then
	_usage
    exit 1
fi
eval set -- "${ARGS}"
while true; do
	case "$1" in
	-d | --domain)
		onekey=1
		domain="$2"
		lecert_domain="$2"
		_cli_override[lecert_domain]="$2"
		shift
		;;	
	-H | --hostname)
		onekey=1
		hostname="$2"
		_cli_override[hostname]="$2"
		shift
		;;
	-h | --help)
		_usage
		exit 1
		;;
	-P | --port)
		onekey=1
		chport="$2"
		_cli_override[chport]="$2"
		if ! _validate_port "$chport"; then
			exit 1
		fi
		shift
		;;
	-u | --username)
		onekey=1
		username="$2"
		_cli_override[username]="$2"
		if ! _validate_username "$username"; then
			exit 1
		fi
		shift
		;;
	-p | --password)
		onekey=1
		password="$2"
		_cli_override[password]="$2"
		if ! _validate_password "$password"; then
			exit 1
		fi
		shift
		;;
	--lang) 
		if [[ $2 == en || $2 == zh ]]; then
			uilang=$2
		else
			uilang="en"
		fi
		_cli_override[uilang]="$uilang"
		shift
		;;
	--with-log) OUTTO="/root/quickbox.$PPID.log"; _cli_override[OUTTO]="$OUTTO" ;;
	--no-log) OUTTO="/dev/null 2>&1"; _cli_override[OUTTO]="$OUTTO" ;;
	--with-ftp) ftp=1; _cli_override[ftp]=1 ;;
	--no-ftp) ftp=0; _cli_override[ftp]=0 ;;
	--ftp-ip)
		ftp_ip="$2"
		_cli_override[ftp_ip]="$ftp_ip"
		shift
		;;
	-r | --reboot) autoreboot=1; _cli_override[autoreboot]=1 ;;
	-t | --theme)
		if ! _validate_enum "theme" "$2" "defaulted|smoked"; then
			exit 1
		fi
		dash_theme="$2"
		_cli_override[dash_theme]="$2"
		shift
		;;	
	--tz | --timezone)
		timezone="$2"
		_cli_override[timezone]="$2"
		shift
		;;	
	-s | --source)
		if ! _validate_enum "apt source" "$2" "us|au|cn|fr|de|jp|ru|uk|tuna"; then
			exit 1
		fi
		chsource=1
		change_source=1
		mirror="$2"
		_cli_override[chsource]=1
		_cli_override[change_source]=1
		_cli_override[mirror]="$2"
		shift
		;;
	--with-bbr) enable_bbr=1; _cli_override[enable_bbr]=1 ;;
	--no-bbr) enable_bbr=0; _cli_override[enable_bbr]=0 ;;
	--with-cf) cdn="cf"; _cli_override[cdn]="cf" ;;
	--with-sf) cdn="sf"; _cli_override[cdn]="sf" ;;
	--with-osdn) cdn="osdn"; _cli_override[cdn]="osdn" ;;
	--with-github) cdn="github"; _cli_override[cdn]="github" ;;
	--auth-provider)
		auth_provider=$(echo "$2" | tr '[:upper:]' '[:lower:]')
		_cli_override[auth_provider]="$auth_provider"
		config_auth_provider_explicit=1
		shift
		;;
	--auth-mode)
		authelia_auth_mode=$(echo "$2" | tr '[:upper:]' '[:lower:]')
		_cli_override[authelia_auth_mode]="$authelia_auth_mode"
		shift
		;;
	--admin-email) ADMIN_EMAIL="$2"; _cli_override[ADMIN_EMAIL]="$2"; shift ;;
	--smtp-host) SMTP_HOST="$2"; _cli_override[SMTP_HOST]="$2"; shift ;;
	--smtp-port) SMTP_PORT="$2"; _cli_override[SMTP_PORT]="$2"; shift ;;
	--smtp-username) SMTP_USERNAME="$2"; _cli_override[SMTP_USERNAME]="$2"; shift ;;
	--smtp-password) SMTP_PASSWORD="$2"; _cli_override[SMTP_PASSWORD]="$2"; shift ;;
	--smtp-sender) SMTP_SENDER="$2"; _cli_override[SMTP_SENDER]="$2"; shift ;;
	--oidc-auth-url) OIDC_AUTH_URL="$2"; _cli_override[OIDC_AUTH_URL]="$2"; shift ;;
	--oidc-token-url) OIDC_TOKEN_URL="$2"; _cli_override[OIDC_TOKEN_URL]="$2"; shift ;;
	--oidc-userinfo-url) OIDC_USERINFO_URL="$2"; _cli_override[OIDC_USERINFO_URL]="$2"; shift ;;
	--oidc-client-id) OIDC_CLIENT_ID="$2"; _cli_override[OIDC_CLIENT_ID]="$2"; shift ;;
	--oidc-client-secret) OIDC_CLIENT_SECRET="$2"; _cli_override[OIDC_CLIENT_SECRET]="$2"; shift ;;
	--oidc-end-session-endpoint) OIDC_END_SESSION_ENDPOINT="$2"; _cli_override[OIDC_END_SESSION_ENDPOINT]="$2"; shift ;;
	--oidc-user) OIDC_USER="$2"; _cli_override[OIDC_USER]="$2"; shift ;;
	--oidc-user-map) OIDC_USER_MAP="$2"; _cli_override[OIDC_USER_MAP]="$2"; shift ;;
	--oidc-email-domains) EMAIL_DOMAINS="$2"; _cli_override[EMAIL_DOMAINS]="$2"; shift ;;
	--with-rtorrent) app_list+=" rtorrent"; _cli_override_packages+=" rtorrent" ;;
	--with-rutorrent) rtgui="rutorrent"; _cli_override[rtgui]="rutorrent" ;;
	--with-flood) rtgui="flood"; _cli_override[rtgui]="flood" ;;
	--with-transmission) app_list+=" transmission"; _cli_override_packages+=" transmission" ;;
	--with-qbittorrent) app_list+=" qbittorrent"; _cli_override_packages+=" qbittorrent" ;;
	--with-deluge) app_list+=" deluge"; _cli_override_packages+=" deluge" ;;
	--with-mktorrent) app_list+=" mktorrent"; _cli_override_packages+=" mktorrent" ;;
	--with-ffmpeg) app_list+=" ffmpeg"; _cli_override_packages+=" ffmpeg" ;;
	--with-filebrowser) app_list+=" filebrowser"; _cli_override_packages+=" filebrowser" ;;
	--with-linuxrar) app_list+=" linuxrar"; _cli_override_packages+=" linuxrar" ;;
	--qbittorrent-version) qbit_ver="$2"; _cli_override[qbit_ver]="$qbit_ver"; shift;;
	--deluge-version) de_ver="$2"; _cli_override[de_ver]="$de_ver"; shift;;
	--qbit-libt-version) qbit_libt_ver="$2"; _cli_override[qbit_libt_ver]="$qbit_libt_ver"; shift;;
	--de-libt-version) de_libt_ver="$2"; _cli_override[de_libt_ver]="$de_libt_ver"; shift;;
	--rtorrent-version) rt_ver="$2"; _cli_override[rt_ver]="$rt_ver"; shift;;
	--transmission-version) tr_ver="$2"; _cli_override[tr_ver]="$tr_ver"; shift;;
	-c | --config)
		config_file="$2"
		shift
		;;
	--allow-http-config)
		allow_http_config=1
		;;
	--generate-config)
		config_gen_mode=1
		;;
	--config-output)
		config_output_file="$2"
		shift
		;;
	--skip-summary)
		skip_summary=1
		;;
	--)
		shift
		break
		;;
	esac
	shift
done

################################################################################
# MAIN PROCESS
################################################################################
# Init
_prepare_runtime || exit 1
trap _cleanup_config_temp_file EXIT
_ensure_setup_tools || exit 1

# Handle config file loading
if [[ -n $config_file ]]; then
	_resolve_config_source "$config_file"
	_load_config "$resolved_config_file"
	_apply_cli_overrides
fi
_load_language || exit 1
[[ -n $ftp_ip ]] || ftp_ip=$(_local_ip)

if [[ $onekey == 1 ]]; then
	_validate_loaded_config
	_summary
else
	_selectlang || exit 1
	if [[ $config_gen_mode == 0 ]]; then
		_welcome
	fi
	# Install guide
	_logcheck
	# Ask for a domain first so a valid Let's Encrypt domain can prefill the
	# hostname; the hostname prompt only runs when nothing was set here.
	_askdomain
	if [[ $hostname == "" ]]; then
		_askhostname
	fi
	_askchport
	_askusrname
	_askpasswd
	_askvsftpd
	_askdashtheme
	_askchangetz
	_askchsource
	_askcdn
	_askauthprovider
	_askapps
	_askbbr
	_askSwap
	_askautoreboot
	# Conclusion
	_summary
fi
