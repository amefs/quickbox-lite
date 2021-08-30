#!/bin/bash
#
# [QuickBox Lite Installation Guide Script]
#
# GitHub:   https://github.com/amefs/quickbox-lite
# Author:   Amefs
# Current version:  v1.5.0-legacy
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
# shellcheck disable=SC2046,SC1090,SC2181,SC2059
#################################################################################

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

function _init() {

	_defaultcolor

	# initialization environment
	local_prefix=/etc/QuickBox/
	local_setup_script=${local_prefix}setup/scripts/
	local_setup_template=${local_prefix}setup/templates/
	local_setup_dashboard=${local_prefix}setup/dashboard/
	local_packages=${local_prefix}packages/
	local_lang=${local_prefix}setup/lang/
	if [[ ! -d /install ]]; then
		mkdir /install
	fi
	if [[ ! -d /tmp ]]; then
		mkdir /tmp
	fi
	DISTRO=$(lsb_release -is)
	CODENAME=$(lsb_release -cs)
	OSARCH=$(dpkg --print-architecture)
	#RELEASE=$(lsb_release -rs)
	#SETNAME=$(lsb_release -rc)
	export LANG="en_US.UTF-8" >/dev/null 2>&1
	export LC_ALL="en_US.UTF-8" >/dev/null 2>&1
	export LANGUAGE="en_US.UTF-8" >/dev/null 2>&1
	if (! export | grep -q sbin); then
		export PATH=$PATH:/usr/local/sbin:/usr/sbin:/sbin
	fi
	{
		# prepare scripts
		echo -e "XXX\n00\nPreparing scripts... \nXXX"
		# install base packages
		DEBIAN_FRONTEND=noninteractive apt-get -qq -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update >/dev/null 2>&1
		echo -e "XXX\n10\nPreparing scripts... \nXXX"
		if [[ $DISTRO == Debian ]]; then
			apt-get -y install git curl wget dos2unix python apt-transport-https software-properties-common gnupg2 ca-certificates dnsutils unzip >/dev/null 2>&1
		fi
		echo -e "XXX\n20\nPreparing scripts... \nXXX"
		dos2unix $(find ${local_prefix} -type f) >/dev/null 2>&1
		chmod +x $(find ${local_prefix} -type f) >/dev/null 2>&1
		if [[ -d /usr/local/bin/quickbox ]]; then
			rm -rf /usr/local/bin/quickbox
		fi
		ln -s ${local_packages} /usr/local/bin/quickbox
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
		source ${local_lang}en.lang
		echo 'LANGUAGE="en_US.UTF-8"' >>/etc/default/locale
		echo 'LC_ALL="en_US.UTF-8"' >>/etc/default/locale
		uilang="en"
		;;
	"Chinese Simpified")
		source ${local_lang}zh-cn.lang
		echo 'LANGUAGE="zh_CN.UTF-8"' >>/etc/default/locale
		echo 'LC_ALL="zh_CN.UTF-8"' >>/etc/default/locale
		uilang="zh"
		;;
	esac
	DEBIAN_FRONTEND=noninteractive dpkg-reconfigure locales >/dev/null 2>&1
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
	elif [[ ! "$CODENAME" =~ ("xenial"|"stretch") ]]; then
		_errorcolor
		whiptail --title "$ERROR_TITLE_OS" --msgbox "${ERROR_TEXT_CODENAME_1}${DISTRO}${ERROR_TEXT_CODENAME_2}" --ok-button "$BUTTON_OK" 8 72
		_defaultcolor
		exit 1
	elif [[ "$CODENAME" == "xenial" ]]; then
		_errorcolor
		whiptail --title "$ERROR_TITLE_XENIAL" --msgbox "${ERROR_TEXT_XENIAL_1}" --ok-button "$BUTTON_OK" 8 72
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
				apt-get install -q -y linux-image-generic >>/dev/null 2>&1
			elif [[ $DISTRO == Debian ]]; then
				arch=$(uname -m)
				if [[ $arch =~ ("i686"|"i386") ]]; then
					apt-get install -q -y linux-image-686 >>/dev/null 2>&1
				elif [[ $arch == x86_64 ]]; then
					apt-get install -q -y linux-image-amd64 >>/dev/null 2>&1
				fi
			fi
			mv /etc/grub.d/06_OVHkernel /etc/grub.d/25_OVHkernel
			update-grub >>/dev/null 2>&1
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
			_get_ip
			test_domain=$(curl -sH 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$domain&type=A" | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" | head -1)
			if [[ $test_domain != "${ip}" ]]; then
				whiptail --title "$ERROR_TITLE_DOMAINCHK" --msgbox "${ERROR_TEXT_DOMAINCHK_1}$domain${ERROR_TEXT_DOMAINCHK_2}" --ok-button "$BUTTON_OK" 8 72
				domain=""
			else
				whiptail --title "$INFO_TITLE_DOMAINCHK" --msgbox "${INFO_TEXT_DOMAINCHK_1}$domain${INFO_TEXT_DOMAINCHK_2}" --ok-button "$BUTTON_OK" 8 72
				hostname=$domain
			fi
		done
	else
		domain=""
	fi
}

function _askhostname() {
	hostname=$(whiptail --title "$INFO_TITLE_HOSTNAME" --inputbox "$INFO_TEXT_HOSTNAME" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
}

function _chhostname() {
	if [[ $hostname != "" ]]; then
		old_hostname=$(cat /etc/hostname)
		echo "${hostname}" >/etc/hostname
		sed -i "s/127.0.1.1\s*${old_hostname}/127.0.1.1	${hostname}/g" /etc/hosts >>"${OUTTO}" 2>&1
		sed -i "/127.0.0.1\s*localhost/a 127.0.0.1	${hostname}" /etc/hosts >>"${OUTTO}" 2>&1
	fi
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
			chport=$(echo "$port" | grep -P '^()([1-9]|[1-5]?[0-9]{2,4}|6[1-4][0-9]{3}|65[1-4][0-9]{2}|655[1-2][0-9]|6553[1-5])$')
			if [[ $chport == "" ]]; then 
				whiptail --title "$ERROR_TITLE_SSH" --msgbox "$ERROR_TEXT_SSH" --ok-button "$BUTTON_OK" 10 72 
			fi
		fi
	done
}

function _changeport() {
	if [[ -e /etc/ssh/sshd_config ]]; then
		sed -i "s/#*Port 22/Port $chport/g" /etc/ssh/sshd_config
		service ssh restart >>"${OUTTO}" 2>&1
	fi
}

function _askusrname() {
	local count=0
	local valid=false
	# https://github.com/Azure/azure-devops-utils
	local reserved_names=('adm' 'admin' 'audio' 'backup' 'bin' 'cdrom' 'crontab' 'daemon' 'dialout' 'dip' 'disk' 'fax' 'floppy' 'fuse' 'games' 'gnats' 'irc' 'kmem' 'landscape' 'libuuid' 'list' 'lp' 'mail' 'man' 'messagebus' 'mlocate' 'netdev' 'news' 'nobody' 'nogroup' 'operator' 'plugdev' 'proxy' 'root' 'sasl' 'shadow' 'src' 'ssh' 'sshd' 'staff' 'sudo' 'sync' 'sys' 'syslog' 'tape' 'tty' 'users' 'utmp' 'uucp' 'video' 'voice' 'whoopsie' 'www-data')
	while [[ $valid == false ]]; do
		username=$(whiptail --title "$INFO_TITLE_NAME" --inputbox "$INFO_TEXT_NAME" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 8 72 3>&1 1>&2 2>&3)
		# check username length
		count=$(echo -n "$username" | wc -c)
		# ensure vaild username
		valid=$(echo "$username" | grep -P '^[a-z][-a-z0-9_]*')
		_errorcolor
		if echo "${reserved_names[@]}" | grep -wq "$username"; then
			whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_1" --ok-button "$BUTTON_OK" 8 72
			valid=false
		elif [[ $count -lt 3 || $count -gt 32 ]]; then
			whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_2" --ok-button "$BUTTON_OK" 8 72
			valid=false
		elif ! [[ "$username" =~ ^[a-z][-a-z0-9_]*$ ]]; then
			whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_3" --ok-button "$BUTTON_OK" 10 72
			valid=false
		else
			valid=true
		fi
		_defaultcolor
	done
}

function _askpasswd() {
	local count=0
	local strength=""
	while [[ $strength == "" || $count -lt 8 ]]; do
		password=$(whiptail --title "$INFO_TITLE_PASSWD" --passwordbox "$INFO_TEXT_PASSWD" 8 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
		# check password length
		count=$(echo -n "$password" | wc -c)
		# ensure password strength
		strength=$(echo "$password" | grep -P '(?=^.{8,32}$)(?=^[^\s]*$)(?=.*\d)(?=.*[A-Z])(?=.*[a-z])')
		_errorcolor
		if [[ $count -lt 8 ]]; then
			whiptail --title "$ERROR_TITLE_PASSWD" --msgbox "$ERROR_TEXT_PASSWD_1" --ok-button "$BUTTON_OK" 8 72
		else
			if [[ $strength == "" ]]; then
				whiptail --title "$ERROR_TITLE_PASSWD" --msgbox \
					"$ERROR_TEXT_PASSWD_2" --ok-button "$BUTTON_OK" 10 72
			fi
		fi
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
	"--with-cf")
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
	"--with-sf")
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
	"--with-osdn")
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
	"--with-github")
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
	_skel
	# add limit shell
	_lshell
	echo -e "XXX\n19\n$INFO_TEXT_PROGRESS_3\nXXX"
	# save account info to file
	local passphrase
	passphrase=$(openssl rand -hex 64)
	# shellcheck disable=SC2091
	if ! $(openssl version | awk '$2 ~ /(^0\.)|(^1\.(0\.|1\.0))/ { exit 1 }'); then
		echo "${username}:$(echo "${password}" | openssl enc -aes-128-ecb -a -e -pass pass:"${passphrase}" -nosalt)" >/root/.admin.info
	else
		echo "${username}:$(echo "${password}" | openssl enc -aes-128-ecb -pbkdf2 -a -e -pass pass:"${passphrase}" -nosalt)" >/root/.admin.info
	fi
	mkdir -p /root/.qbuser
	cp /root/.admin.info /root/.qbuser/"${username}".info
	mkdir -p /root/.ssh
	echo "${passphrase}" >/root/.ssh/local_user
	chmod 600 /root/.ssh/local_user && chmod 700 /root/.ssh
	# create account
	if [[ -d /home/$username ]]; then
		cd /etc/skel || exit 1
		cp -fR . /home/"${username}"/
	else
		useradd "${username}" -m -G www-data -s /bin/bash
	fi
	chpasswd <<<"${username}:${password}"
	echo "${username}:$(openssl passwd -apr1 "${password}")" >/etc/htpasswd
	mkdir -p /etc/htpasswd.d/
	echo "${username}:$(openssl passwd -apr1 "${password}")" >/etc/htpasswd.d/htpasswd."${username}"
	chown -R "${username}":"${username}" /home/"${username}"
	chmod 750 /home/"${username}"
	echo "D /var/run/${username} 0750 ${username} ${username} -" >>/etc/tmpfiles.d/"${username}".conf
	systemd-tmpfiles /etc/tmpfiles.d/"${username}".conf --create >>"${OUTTO}" 2>&1
	# setup sudoers
	cp ${local_setup_template}sudoers.template /etc/sudoers.d/dashboard
	if grep "${username}" /etc/sudoers.d/quickbox >/dev/null 2>&1; then
		echo "No sudoers modification made ... " >>"${OUTTO}" 2>&1
	else
		echo "${username} ALL=(ALL:ALL) ALL" >>/etc/sudoers.d/quickbox
	fi
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
}

function _askvsftpd() {
	ip=$(ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1)
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
		dpkg-reconfigure tzdata
	fi
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
		cdn="--with-"
		cdn+=$(
			whiptail --title "$INFO_TITLE_CDN" --radiolist \
				"$INFO_TEXT_CDN_EXTRA" 12 42 4 \
				"cf" "$CHOICE_TEXT_CDN_EXTRA_CF" off \
				"sf" "$CHOICE_TEXT_CDN_EXTRA_SF" off \
				"osdn" "$CHOICE_TEXT_CDN_EXTRA_OSDN" off \
				"github" "$CHOICE_TEXT_CDN_EXTRA_GITHUB" on \
				3>&1 1>&2 2>&3
		)
	else
		cdn="--with-github"
	fi
}

function _askSwap() {
	swap_path=$(whiptail --title "$INFO_TITLE_SWAP" --inputbox "${INFO_TEXT_SWAP_1} \n${INFO_TEXT_SWAP_2}" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
	if [[ ${swap_path} == "" ]]; then
		swap_path="/root/.swapfile"
	elif [[ ! -d $(dirname ${swap_path}) ]]; then
		swap_path="/root/.swapfile"
	fi
	{
		if [[ ! -f ${swap_path} ]]; then
			touch ${swap_path} || exit 1
		fi
		echo -e "XXX\n10\n$INFO_TEXT_SWAPON_0$INFO_TEXT_DONE\nXXX"
		sleep 1
		echo -e "XXX\n10\n$INFO_TEXT_SWAPON_1\nXXX"
		dd if=/dev/zero of=${swap_path} bs=1M count=2048 >/dev/null 2>&1
		echo -e "XXX\n50\n$INFO_TEXT_SWAPON_1$INFO_TEXT_DONE\nXXX"
		sleep 1
		echo -e "XXX\n50\n$INFO_TEXT_SWAPON_2\nXXX"
		chmod 600 ${swap_path} >/dev/null 2>&1
		mkswap ${swap_path} >/dev/null 2>&1
		swapon ${swap_path} >/dev/null 2>&1
		swapon -s >/dev/null 2>&1
		echo -e "XXX\n75\n$INFO_TEXT_SWAPON_2$INFO_TEXT_DONE\nXXX"
		sleep 1
		echo -e "XXX\n75\n$INFO_TEXT_SWAPON_3\nXXX"
		cat >> /etc/fstab <<EOF
${swap_path} swap swap defaults 0 0
EOF
		echo -e "XXX\n100\n$INFO_TEXT_SWAPON_3$INFO_TEXT_DONE\nXXX"
	} | whiptail --title "$INFO_TITLE_SWAPON" --gauge "$INFO_TEXT_SWAPON_0" 8 64 0
}

function _chsource() {
	if [[ $mirror == "" ]]; then mirror="us"; fi
	if [[ $DISTRO == Debian ]]; then
		if [[ $mirror == "tuna" ]]; then
			cp ${local_setup_template}source.list/debian.tuna.template /etc/apt/sources.list
		else
			cp ${local_setup_template}source.list/debian.template /etc/apt/sources.list
			sed -i "s/COUNTRY/${mirror}/g" /etc/apt/sources.list
		fi
		sed -i "s/RELEASE/${CODENAME}/g" /etc/apt/sources.list
	else
		if [[ $mirror == "tuna" ]]; then
			cp ${local_setup_template}source.list/ubuntu.tuna.template /etc/apt/sources.list
		else
			cp ${local_setup_template}source.list/ubuntu.template /etc/apt/sources.list
			sed -i "s/COUNTRY/${mirror}/g" /etc/apt/sources.list
		fi
		sed -i "s/RELEASE/${CODENAME}/g" /etc/apt/sources.list
	fi
}

function _addPHP() {
	if [[ $DISTRO == "Ubuntu" ]]; then
		# add php7.4
		apt-key adv --recv-keys --keyserver hkp://keyserver.ubuntu.com:80 0x5a16e7281be7a449 >/dev/null 2>&1
		LC_ALL=en_US.UTF-8 add-apt-repository ppa:ondrej/php -y >/dev/null 2>&1
	elif [[ $DISTRO == "Debian" ]]; then
		# add php for debian
		printf "\n" | wget -q https://packages.sury.org/php/apt.gpg -O- | apt-key add - >/dev/null 2>&1
		cat >/etc/apt/sources.list.d/php.list <<DPHP
deb https://packages.sury.org/php/ $(lsb_release -sc) main
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
	_addPHP
	DEPLIST="sudo at bc build-essential curl wget nginx-extras subversion ssl-cert php7.4-cli php7.4-fpm php7.4 php7.4-dev php7.4-memcached memcached php7.4-curl php7.4-gd php7.4-geoip php7.4-json php7.4-mbstring php7.4-opcache php7.4-xml php7.4-xmlrpc php7.4-zip libfcgi0ldbl mcrypt libmcrypt-dev nano python-dev unzip htop iotop vnstat vnstati automake make openssl net-tools debconf-utils ntp rsync"
	for depend in $DEPLIST; do
		# shellcheck disable=SC2154
		echo -e "XXX\n12\n$INFO_TEXT_PROGRESS_Extra_2${depend}\nXXX"
		DEBIAN_FRONTEND=noninteractive apt-get -y install "${depend}" --allow-unauthenticated >>"${OUTTO}" 2>&1 || { local dependError=1; }
		if [[ $dependError == "1" ]]; then
			whiptail --title "$ERROR_TITLE_INSTALL" --msgbox "${ERROR_TEXT_INSTALL_1}${depend}" 8 64
			exit 1
		fi
	done
}

function _insngx() {
	rm -rf /etc/nginx/nginx.conf
	if [[ $CODENAME == "stretch" ]]; then
		cp ${local_setup_template}nginx/nginx.conf.new.template /etc/nginx/nginx.conf
	else
		cp ${local_setup_template}nginx/nginx.conf.old.template /etc/nginx/nginx.conf
	fi

	rm -rf /etc/nginx/sites-enabled/default
	cp ${local_setup_template}nginx/default.template /etc/nginx/sites-enabled/default

	ln -nsf /usr/bin/php7.4 /usr/bin/php
	sed -i.bak -e "s/post_max_size.*/post_max_size = 64M/" \
		-e "s/upload_max_filesize.*/upload_max_filesize = 92M/" \
		-e "s/expose_php.*/expose_php = Off/" \
		-e "s/128M/768M/" \
		-e "s/;cgi.fix_pathinfo.*/cgi.fix_pathinfo=1/" \
		-e "s/;opcache.enable.*/opcache.enable=1/" \
		-e "s/;opcache.memory_consumption.*/opcache.memory_consumption=128/" \
		-e "s/;opcache.max_accelerated_files.*/opcache.max_accelerated_files=4000/" \
		-e "s/;opcache.revalidate_freq.*/opcache.revalidate_freq=240/" /etc/php/7.4/fpm/php.ini

	phpenmod -v 7.4 opcache
	phpenmod -v 7.4 xml
	phpenmod -v 7.4 mbstring
	phpenmod -v 7.4 msgpack
	phpenmod -v 7.4 memcached

	mkdir -p /etc/nginx/ssl/
	mkdir -p /etc/nginx/snippets/
	mkdir -p /etc/nginx/apps/
	chmod 700 /etc/nginx/ssl

	cd /etc/nginx/ssl || exit 1
	openssl dhparam -out dhparam.pem 2048 >>"${OUTTO}" 2>&1

	cp ${local_setup_template}nginx/ssl-params.conf.template /etc/nginx/snippets/ssl-params.conf

	cp ${local_setup_template}nginx/proxy.conf.template /etc/nginx/snippets/proxy.conf

	svn export https://github.com/Naereen/Nginx-Fancyindex-Theme/trunk/Nginx-Fancyindex-Theme-dark /srv/fancyindex >>"${OUTTO}" 2>&1
	cp ${local_setup_template}nginx/fancyindex.conf.template /etc/nginx/snippets/fancyindex.conf
	sed -i 's/href="\/[^\/]*/href="\/fancyindex/g' /srv/fancyindex/header.html
	sed -i 's/src="\/[^\/]*/src="\/fancyindex/g' /srv/fancyindex/footer.html

	# Generate snakeoil certs should they not exists as on some providers
	if [[ ! -f /etc/ssl/certs/ssl-cert-snakeoil.pem ]]; then
		cp ${local_setup_template}openssl.cnf.template /root/.openssl.cnf
		openssl req -config /root/.openssl.cnf -x509 -nodes -days 365 -newkey rsa:1024 -keyout /etc/ssl/private/ssl-cert-snakeoil.key -out /etc/ssl/certs/ssl-cert-snakeoil.pem >/dev/null 2>&1
	fi

	mkdir -p /var/log/nginx/
	chown -R www-data.www-data /var/log/nginx/
	systemctl restart nginx
	systemctl restart php7.4-fpm
}

function _insnodejs() {
	# install Nodejs for background service
	cd /tmp || exit 1
	curl -sL https://deb.nodesource.com/setup_14.x -o nodesource_setup.sh
	bash nodesource_setup.sh >>"${OUTTO}" 2>&1
	exitstatus=$?
	counter=0
	while [[ ${exitstatus} -eq 1 ]]; do
		if [[ ${counter} -gt 2 ]]; then
			_errorcolor
			echo -e "XXX\n00\n${ERROR_TEXT_NODEJS}\nXXX"
			_defaultcolor
			echo ">> ${ERROR_TEXT_NODEJS}" >>"${OUTTO}" 2>&1
			exit 1
		else
			bash nodesource_setup.sh >>"${OUTTO}" 2>&1
			exitstatus=$?
			((counter++))
		fi
	done
	apt-get install -y nodejs >>"${OUTTO}" 2>&1
	if [[ -f /tmp/nodesource_setup.sh ]]; then
		rm nodesource_setup.sh
	fi
}

function _webconsole() {
	# setup webconsole for dashboard
	PUBLICIP=$(ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1)
	cat >/etc/profile <<EOF
echo " Welcome Back !"
if [[ -f /install/domain.info ]]; then
	echo "    * Dashboard:  https://\$(cat /install/domain.info)"
else
	echo "    * Dashboard:  https://${PUBLICIP}"
fi
echo ""
EOF
	# install shellinabox and service config
	apt-get -y install shellinabox >>"${OUTTO}" 2>&1
	service shellinabox stop >/dev/null 2>&1
	rm -rf /etc/init.d/shellinabox

	if [[ ! -f /etc/nginx/apps/"${username}".console.conf ]]; then
		cat > /etc/nginx/apps/"${username}".console.conf <<WEBC
location /${username}.console/ {
    proxy_pass        http://127.0.0.1:4200;
    #auth_basic "What's the password?";
    #auth_basic_user_file /etc/htpasswd.d/htpasswd.${username};
}
WEBC
	fi
	if (grep -q "disable-ssl" /etc/default/shellinabox); then
		sed -i 's/SHELLINABOX_ARGS="/SHELLINABOX_ARGS="--disable-ssl /g' /etc/default/shellinabox
	fi
	if (grep -q "localhost-only" /etc/default/shellinabox); then
		sed -i 's/SHELLINABOX_ARGS="/SHELLINABOX_ARGS="--localhost-only /g' /etc/default/shellinabox
	fi

	cp ${local_setup_template}systemd/shellinabox.service.template /etc/systemd/system/shellinabox.service
	cp ${local_setup_template}webconsole/00_QuickConsole.css.template /etc/shellinabox/options-enabled/00_QuickConsole.css
	chmod +x /etc/shellinabox/options-enabled/00_QuickConsole.css
	chmod 777 /etc/shellinabox/options-enabled/00_QuickConsole.css

	# enable shellinabox service
	systemctl daemon-reload >/dev/null 2>&1
	systemctl enable shellinabox.service >/dev/null 2>&1
	systemctl start shellinabox.service >/dev/null 2>&1
	# create lock
	touch /install/.shellinabox.lock
}

function _insdashboard() {
	echo -e "XXX\n27\n$INFO_TEXT_PROGRESS_7_1\nXXX"
	_insngx
	echo -e "XXX\n28\n$INFO_TEXT_PROGRESS_7_2\nXXX"
	_insnodejs
	echo -e "XXX\n29\n$INFO_TEXT_PROGRESS_7_3\nXXX"
	_webconsole
	cd && mkdir -p /srv/dashboard
	\cp -fR ${local_setup_dashboard}. /srv/dashboard
	touch /srv/dashboard/db/output.log
	/usr/local/bin/quickbox/system/theme/themeSelect-"${dash_theme}"
	IFACE=$(ip link show | grep -i broadcast | grep -m1 UP | cut -d: -f 2 | cut -d@ -f 1 | sed -e 's/ //g')
	echo "${IFACE}" >/srv/dashboard/db/interface.txt
	sed -i "s/INETFACE/${IFACE}/g" /srv/dashboard/inc/config.php
	echo "${username}" >/srv/dashboard/db/master.txt
	chown -R www-data: /srv/dashboard
	cp ${local_setup_template}nginx/dashboard.conf.template /etc/nginx/apps/dashboard.conf
	sed -i "s/\/etc\/htpasswd/\/etc\/htpasswd.d\/htpasswd.${username}/g" /etc/nginx/apps/dashboard.conf
	service nginx force-reload >/dev/null 2>&1
	case $uilang in
	"en")
		bash /usr/local/bin/quickbox/system/lang/langSelect-lang_en >/dev/null 2>&1
		touch /install/.lang_en.lock
		;;
	"zh")
		bash /usr/local/bin/quickbox/system/lang/langSelect-lang_zh-cn >/dev/null 2>&1
		touch /install/.lang_zh.lock
		;;
	*)
		bash /usr/local/bin/quickbox/system/lang/langSelect-lang_en >/dev/null 2>&1
		touch /install/.lang_en.lock
		;;
	esac
	if [[ $(vnstat -v | grep -Eo "[0-9.]+" | cut -d . -f1) == "1" ]]; then
		\cp -f /srv/dashboard/widgets/vnstat-raw.php /srv/dashboard/widgets/vnstat.php
	elif [[ $(vnstat -v | grep -Eo "[0-9.]+" | cut -d . -f1) == "2" ]]; then
		\cp -f /srv/dashboard/widgets/vnstat-json.php /srv/dashboard/widgets/vnstat.php
	fi
	touch /install/.dashboard.lock
	cd /srv/dashboard/ws || exit 1
	npm ci --production >>"${OUTTO}" 2>&1
	\cp -f ${local_setup_template}systemd/quickbox-ws.service.template /etc/systemd/system/quickbox-ws.service
	systemctl daemon-reload >/dev/null 2>&1
	systemctl enable quickbox-ws.service >/dev/null 2>&1
	systemctl start quickbox-ws.service >/dev/null 2>&1
	touch /install/.quickbox-ws.lock
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
	if [[ "$app_list" =~ "rtorrent" ]]; then
		echo -e "XXX\n30\n$INFO_TEXT_INSTALLAPP_1\nXXX"
		bash ${local_setup_script}rtorrent.sh "${OUTTO}" "${rtgui}" "${cdn}" "${rt_ver}" >/dev/null 2>&1
		echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_1$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_1$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "transmission" ]]; then
		echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_2\nXXX"
		bash ${local_setup_script}transmission.sh "${OUTTO}" "${cdn}" >/dev/null 2>&1
		echo -e "XXX\n43\n$INFO_TEXT_INSTALLAPP_2$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n43\n$INFO_TEXT_INSTALLAPP_2$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "qbittorrent" ]]; then
		echo -e "XXX\n43\n$INFO_TEXT_INSTALLAPP_3\nXXX"
		bash ${local_setup_script}qbittorrent.sh "${OUTTO}" "${cdn}" "${qbit_ver}" "${qbit_libt_ver}" >/dev/null 2>&1
		echo -e "XXX\n49\n$INFO_TEXT_INSTALLAPP_3$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n49\n$INFO_TEXT_INSTALLAPP_3$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "deluge" ]]; then
		echo -e "XXX\n49\n$INFO_TEXT_INSTALLAPP_4\nXXX"
		bash ${local_setup_script}deluge.sh "${OUTTO}" "${cdn}"  "${de_ver}" "${de_libt_ver}" >/dev/null 2>&1
		echo -e "XXX\n56\n$INFO_TEXT_INSTALLAPP_4$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n56\n$INFO_TEXT_INSTALLAPP_4$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "mktorrent" ]]; then
		echo -e "XXX\n56\n$INFO_TEXT_INSTALLAPP_5\nXXX"
		bash ${local_setup_script}mktorrent.sh "${OUTTO}" >/dev/null 2>&1
		echo -e "XXX\n62\n$INFO_TEXT_INSTALLAPP_5$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n62\n$INFO_TEXT_INSTALLAPP_5$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "ffmpeg" ]]; then
		echo -e "XXX\n62\n$INFO_TEXT_INSTALLAPP_6\nXXX"
		bash ${local_setup_script}ffmpeg.sh "${OUTTO}" >/dev/null 2>&1
		echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_6$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_6$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "filebrowser" ]]; then
		echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_7\nXXX"
		bash ${local_setup_script}filebrowser.sh "${OUTTO}" >/dev/null 2>&1
		echo -e "XXX\n75\n$INFO_TEXT_INSTALLAPP_7$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n75\n$INFO_TEXT_INSTALLAPP_7$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
	if [[ "$app_list" =~ "linuxrar" ]]; then
		echo -e "XXX\n75\n$INFO_TEXT_INSTALLAPP_8\nXXX"
		bash ${local_setup_script}linuxrar.sh "${OUTTO}" >/dev/null 2>&1
		echo -e "XXX\n80\n$INFO_TEXT_INSTALLAPP_8$INFO_TEXT_DONE\nXXX"
	else
		echo -e "XXX\n80\n$INFO_TEXT_INSTALLAPP_8$INFO_TEXT_SKIP\nXXX"
	fi
	sleep 1
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
		cd /tmp/bcm || exit 1
		git clone git://git.kernel.org/pub/scm/linux/kernel/git/firmware/linux-firmware.git >>"${OUTTO}" 2>&1
		mkdir -p /lib/firmware/bnx2/
		cp -rf /tmp/bcm/linux-firmware/bnx2/ /lib/firmware
	fi
}

function _startinstall() {
	# record start time
	starttime=$(date +%s)
	{
		touch /install/.system.lock
		sleep 0.5
		# change hostname
		echo -e "XXX\n0\n$INFO_TEXT_PROGRESS_1\nXXX"
		if [[ $hostname != "" ]]; then
			_chhostname
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
			_changeport
			echo -e "XXX\n06\n$INFO_TEXT_PROGRESS_2$INFO_TEXT_DONE\nXXX"
		fi
		sleep 1

		# replace source.list
		echo -e "XXX\n06\n$INFO_TEXT_PROGRESS_4\nXXX"
		if [[ $chsource == 1 ]]; then
			_chsource
			echo -e "XXX\n10\n$INFO_TEXT_PROGRESS_4$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n10\n$INFO_TEXT_PROGRESS_4$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# installation dependence
		echo -e "XXX\n10\n$INFO_TEXT_PROGRESS_5\nXXX"
		_dependency
		echo -e "XXX\n15\n$INFO_TEXT_PROGRESS_5$INFO_TEXT_DONE\nXXX"
		sleep 1

		# setup admin account
		echo -e "XXX\n15\n$INFO_TEXT_PROGRESS_3\nXXX"
		_genadmin
		echo -e "XXX\n20\n$INFO_TEXT_PROGRESS_3$INFO_TEXT_DONE\nXXX"
		sleep 1

		# install dashboard
		echo -e "XXX\n20\n$INFO_TEXT_PROGRESS_7\nXXX"
		_insdashboard
		echo -e "XXX\n30\n$INFO_TEXT_PROGRESS_7$INFO_TEXT_DONE\nXXX"
		sleep 1

		# install 3rd-part apps
		echo -e "XXX\n30\n$INFO_TEXT_PROGRESS_8\nXXX"
		if [[ $app_list != "" ]]; then
			_insapps
			echo -e "XXX\n80\n$INFO_TEXT_PROGRESS_8$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n80\n$INFO_TEXT_PROGRESS_8$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# disable pubilc tracker
		echo -e "XXX\n80\n$INFO_TEXT_PROGRESS_9\nXXX"
		if [[ $denytracker == 1 ]]; then
			_denytracker
			echo -e "XXX\n85\n$INFO_TEXT_PROGRESS_9$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n85\n$INFO_TEXT_PROGRESS_9$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# setup vsftpd
		echo -e "XXX\n85\n$INFO_TEXT_PROGRESS_10\nXXX"
		if [[ $ftp == 1 ]]; then
			_setvsftpd
			echo -e "XXX\n90\n$INFO_TEXT_PROGRESS_10$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n90\n$INFO_TEXT_PROGRESS_10$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# setup BBR
		echo -e "XXX\n90\n$INFO_TEXT_PROGRESS_11\nXXX"
		if [[ $enable_bbr == 1 ]]; then
			_insbbr
			_fixbcm
			echo -e "XXX\n95\n$INFO_TEXT_PROGRESS_11$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n95\n$INFO_TEXT_PROGRESS_11$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# setup domain
		echo -e "XXX\n95\n$INFO_TEXT_PROGRESS_12\nXXX"
		if [[ $domain != "" ]]; then
			bash ${local_setup_script}lecert.sh "${OUTTO}" "$domain" >/dev/null 2>&1
			echo -e "XXX\n97\n$INFO_TEXT_PROGRESS_12$INFO_TEXT_DONE\nXXX"
		else
			echo -e "XXX\n97\n$INFO_TEXT_PROGRESS_12$INFO_TEXT_SKIP\nXXX"
		fi
		sleep 1

		# Finish
		echo -e "XXX\n97\n$INFO_TEXT_PROGRESS_13\nXXX"
		systemctl stop apache2 >/dev/null 2>&1
		systemctl disable apache2 >/dev/null 2>&1
		APACHE_PKGS='apache2 apache2-bin apache2-data'
		for depend in $APACHE_PKGS; do
			DEBIAN_FRONTEND=noninteractive apt-get -y remove "${depend}" >>"${OUTTO}" 2>&1
			DEBIAN_FRONTEND=noninteractive apt-get -y purge "${depend}" >>"${OUTTO}" 2>&1
		done
		apt-get -y autoclean >/dev/null 2>&1
		if [[ ! -f /install/.legacy.lock ]]; then
			touch /install/.legacy.lock
		fi
		rm -rf /install/.system.lock
		echo -e "XXX\n100\n$INFO_TEXT_PROGRESS_14\nXXX"
		sleep 0.5
	} | whiptail --title "$INFO_TITLE_PROGRESS" --gauge "$INFO_TEXT_PROGRESS_0" 8 64 0
	# record end time
	endtime=$(date +%s)
	timeused=$((endtime - starttime))
	timeusedmin=$((timeused / 60))
	echo -e "\n#################################################################################" >>"${OUTTO}" 2>&1
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
	# Summary list
	ip=$(ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1)
	sshport=$(grep -e '#*Port 22' < /etc/ssh/sshd_config | grep -Eo "[0-9]+" )
	if (whiptail --title "$INFO_TITLE_SUMMARY" --yesno "${INFO_TEXT_SUMMARY_1}\n\n\
${INFO_TEXT_SUMMARY_2} $(echo "$OUTTO" | cut -d " " -f 1)\n\
$(if [[ $domain != "" ]]; then printf "${INFO_TEXT_SUMMARY_20} $domain"; fi)\n\
$(if [[ $hostname != "" ]]; then printf "${INFO_TEXT_SUMMARY_3} $hostname"; fi)\n\
${INFO_TEXT_SUMMARY_4} ${ip}:$sshport\n\
${INFO_TEXT_SUMMARY_5} $username\n\
${INFO_TEXT_SUMMARY_6} $password\n\
$(if [[ $ftp == 1 ]]; then printf "${INFO_TEXT_SUMMARY_11} $ftp_ip:5757"; fi)\n\
${INFO_TEXT_SUMMARY_12} $dash_theme ${INFO_TEXT_SUMMARY_13}\
$(if [[ $chsource == 1 ]]; then printf "\n${INFO_TEXT_SUMMARY_14}"; fi)\
$(case "${cdn}" in
	"--with-cf") echo -e "\nCloudflare ${INFO_TEXT_SUMMARY_19}";;
	"--with-sf") echo -e "\nSourceforge ${INFO_TEXT_SUMMARY_19}";;
	"--with-osdn") echo -e "\nOSDN ${INFO_TEXT_SUMMARY_19}";;
	"--with-github") echo -e "\nGitHub ${INFO_TEXT_SUMMARY_19}";;
	*) echo -e "\nGitHub ${INFO_TEXT_SUMMARY_19}";;
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
" --yes-button "$BUTTON_CONFIRM" --no-button "$BUTTON_CANCLE" 28 72); then
		# call installation function
		_startinstall
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

#################################################################################
# USAGE
#################################################################################
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
  --with-APPNAME                   install an application
  --qbittorrent-version            specify the qBittorrent version
  --deluge-version                 specify the Deluge version
  --qbit-libt-version              specify the Libtorrent version for qBittorrent
  --de-libt-version                specify the Libtorrent version for Deluge
  --rtorrent-version               specify the rTorrent version

    Available applications:
    rtorrent | rutorrent | flood | transmission | qbittorrent
    deluge | mktorrent | ffmpeg | filebrowser | linuxrar

  -h, --help                       display this help and exit"
}

#################################################################################
# FLAGS INIT
#################################################################################
uilang="en"
OUTTO="/root/quickbox.$PPID.log"
ftp=1
ftp_ip=$(ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1)
onekey=0
chport=4747
chsource=0
enable_bbr=0
autoreboot=3
dash_theme="smoked"
hostname=""
timezone=""
domain=""
app_list=""
rtgui="rutorrent"
qbit_ver=""
de_ver=""
qbit_libt_ver=""
de_libt_ver=""
rt_ver=""

#################################################################################
# OPT GENERATOR
#################################################################################
if ! ARGS=$(getopt -a -o d:hrH:p:P:s:t:u: -l domain:,help,ftp-ip:,lang:,reboot,with-log,no-log,with-ftp,no-ftp,with-bbr,no-bbr,with-cf,with-sf,with-osdn,with-github,with-rtorrent,with-rutorrent,with-flood,with-transmission,with-qbittorrent,with-deluge,with-mktorrent,with-ffmpeg,with-filebrowser,with-linuxrar,qbittorrent-version:,deluge-version:,qbit-libt-version:,de-libt-version:,rtorrent-version:,hostname:,port:,username:,password:,source:,theme:,tz:,timezone: -- "$@")
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
		shift
		;;	
	-H | --hostname)
		onekey=1
		hostname="$2"
		shift
		;;
	-h | --help)
		_usage
		exit 1
		;;
	-P | --port)
		onekey=1
		chport=$(echo "$2" | grep -P '^()([1-9]|[1-5]?[0-9]{2,4}|6[1-4][0-9]{3}|65[1-4][0-9]{2}|655[1-2][0-9]|6553[1-5])$')
		if [[ -z $chport ]]; then
			_usage
			exit 1
		fi
		shift
		;;
	-u | --user)
		onekey=1
		username="$2"
		count=0
		reserved_names=('adm' 'admin' 'audio' 'backup' 'bin' 'cdrom' 'crontab' 'daemon' 'dialout' 'dip' 'disk' 'fax' 'floppy' 'fuse' 'games' 'gnats' 'irc' 'kmem' 'landscape' 'libuuid' 'list' 'lp' 'mail' 'man' 'messagebus' 'mlocate' 'netdev' 'news' 'nobody' 'nogroup' 'operator' 'plugdev' 'proxy' 'root' 'sasl' 'shadow' 'src' 'ssh' 'sshd' 'staff' 'sudo' 'sync' 'sys' 'syslog' 'tape' 'tty' 'users' 'utmp' 'uucp' 'video' 'voice' 'whoopsie' 'www-data')
		count=$(echo -n "$username" | wc -c)
		if echo "${reserved_names[@]}" | grep -wq "$username"; then
			_error "Do not use reversed user name !"
			exit 1
		elif [[ $count -lt 3 || $count -gt 32 ]]; then
			_error "User name cannot less than 3 or more than 32 characters !"
			exit 1
		elif ! [[ "$username" =~ ^[a-z][-a-z0-9_]*$ ]]; then
			_error "Your username must start from a lower case letter and the username"
			_error "must contain only lowercase letters, numbers, hyphens, and underscores."
			exit 1
		fi
		shift
		;;
	-p | --password)
		onekey=1
		password="$2"
		count=$(echo -n "$password" | wc -c)
		strength=$(echo "$password" | grep -P '(?=^.{8,32}$)(?=^[^\s]*$)(?=.*\d)(?=.*[A-Z])(?=.*[a-z])')
		if [[ $count -lt 8 ]]; then
			_error "Your password cannot less than 8 characters !"
			exit 1
		else
			if [[ $strength == "" ]]; then
				_error "Your password must consist:"
				_error "1.digital numbers"
				_error "2.at least one lower case letter"
				_error "3.one upper case letter"
				exit 1
			fi
		fi
		shift
		;;
	--lang) 
		if [[ $2 =~ "en"|"zh" ]]; then
			uilang=$2
		else
			uilang="en"
		fi
		;;
	--with-log) OUTTO="/root/quickbox.$PPID.log" ;;
	--no-log) OUTTO="/dev/null 2>&1" ;;
	--with-ftp) ftp=1 ;;
	--no-ftp) ftp=0 ;;
	--ftp-ip)
		ftp_ip="$2"
		if [[ $ftp_ip == "" ]]; then ftp_ip=$(ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1); fi
		shift
		;;
	-r | --reboot) autoreboot=1 ;;
	-t | --theme)
		if [[ "$2" =~ "defaulted"|"smoked" ]]; then
			dash_theme="$2"
		else
			_error "$2 theme not available"
			exit 1
		fi
		shift
		;;	
	--tz | --timezone)
		timezone="$2"
		if echo "${timezone}" | grep -wEq 'GMT[+,-]0?[0-9]|1[0-2]'; then
			unlink /etc/localtime
			ln -s /usr/share/zoneinfo/Etc/"${timezone}" /etc/localtime
		elif echo "${timezone}" | grep -wEq 'UTC'; then
			unlink /etc/localtime
			ln -s /usr/share/zoneinfo/Etc/"${timezone}" /etc/localtime
		elif [[ -f /usr/share/zoneinfo/"${timezone}" ]]; then
			unlink /etc/localtime
			ln -s /usr/share/zoneinfo/"${timezone}" /etc/localtime
		fi
		shift
		;;	
	-s | --source)
		if [[ "$2" =~ "us"|"au"|"cn"|"fr"|"de"|"jp"|"ru"|"uk"|"tuna" ]]; then
			chsource=1
			mirror="$2"
		else
			_error "$2 source not available"
			exit 1
		fi
		shift
		;;
	--with-bbr) enable_bbr=1 ;;
	--no-bbr) enable_bbr=0 ;;
	--with-cf) cdn="--with-cf" ;;
	--with-sf) cdn="--with-sf" ;;
	--with-osdn) cdn="--with-osdn" ;;
	--with-github) cdn="--with-github" ;;
	--with-rtorrent) app_list+=" rtorrent" ;;
	--with-rutorrent) rtgui="rutorrent" ;;
	--with-flood) rtgui="flood" ;;
	--with-transmission) app_list+=" transmission" ;;
	--with-qbittorrent) app_list+=" qbittorrent" ;;
	--with-deluge) app_list+=" deluge" ;;
	--with-mktorrent) app_list+=" mktorrent" ;;
	--with-ffmpeg) app_list+=" ffmpeg" ;;
	--with-filebrowser) app_list+=" filebrowser" ;;
	--with-linuxrar) app_list+=" linuxrar" ;;
	--qbittorrent-version) qbit_ver="--qb $2"; shift;;
	--deluge-version) de_ver="--de $2"; shift;;
	--qbit-libt-version) qbit_libt_ver="--lt $2"; shift;;
	--de-libt-version) de_libt_ver="--lt $2"; shift;;
	--rtorrent-version) rt_ver="--version $2"; shift;;
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
# Init
_init
if [[ $onekey == 1 ]]; then
	if [[ -n $username && -n $password ]]; then
		if [[ $uilang == "zh" ]]; then
			source ${local_lang}zh-cn.lang
			echo 'LANGUAGE="zh_CN.UTF-8"' >>/etc/default/locale
			echo 'LC_ALL="zh_CN.UTF-8"' >>/etc/default/locale
		else
			source ${local_lang}en.lang
		fi
		_checkroot
		_checkdistro
		_checkkernel
		_checkovz
		if [[ $domain != "" ]]; then
			_get_ip
			test_domain=$(curl -sH 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$domain&type=A" | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" | head -1)
			if [[ $test_domain != "${ip}" ]]; then
				whiptail --title "$ERROR_TITLE_DOMAINCHK" --msgbox "${ERROR_TEXT_DOMAINCHK_1}$domain${ERROR_TEXT_DOMAINCHK_2}" --ok-button "$BUTTON_OK" 8 72
				domain=""
				exit 1
			else
				hostname=$domain
			fi
		fi
		DEBIAN_FRONTEND=noninteractive dpkg-reconfigure locales >/dev/null 2>&1
		if [ $(free -m | grep Mem | awk '{print  $2}') -le 2048 ]; then
			swap_path=/root/.swapfile
			{
				if [[ ! -f ${swap_path} ]]; then
					touch ${swap_path} || exit 1
				fi
				echo -e "XXX\n10\n$INFO_TEXT_SWAPON_0$INFO_TEXT_DONE\nXXX"
				sleep 1
				echo -e "XXX\n10\n$INFO_TEXT_SWAPON_1\nXXX"
				dd if=/dev/zero of=${swap_path} bs=1M count=2048 >/dev/null 2>&1
				echo -e "XXX\n50\n$INFO_TEXT_SWAPON_1$INFO_TEXT_DONE\nXXX"
				sleep 1
				echo -e "XXX\n50\n$INFO_TEXT_SWAPON_2\nXXX"
				chmod 600 ${swap_path} >/dev/null 2>&1
				mkswap ${swap_path} >/dev/null 2>&1
				swapon ${swap_path} >/dev/null 2>&1
				swapon -s >/dev/null 2>&1
				echo -e "XXX\n75\n$INFO_TEXT_SWAPON_2$INFO_TEXT_DONE\nXXX"
				sleep 1
				echo -e "XXX\n75\n$INFO_TEXT_SWAPON_3\nXXX"
				cat >> /etc/fstab <<EOF
${swap_path} swap swap defaults 0 0
EOF
				echo -e "XXX\n100\n$INFO_TEXT_SWAPON_3$INFO_TEXT_DONE\nXXX"
			} | whiptail --title "$INFO_TITLE_SWAPON" --gauge "$INFO_TEXT_SWAPON_0" 8 64 0
    	fi
		_startinstall
	else
		_error "Onekey install need Username and Password!"
		exit 1
	fi
elif [[ $onekey == 0 ]]; then
	_selectlang
	_checkroot
	_checkdistro
	_checkkernel
	_checkovz
	_welcome

	# Install guide
	_logcheck
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
	_askapps
	_askbbr
	if [ $(free -m | grep Mem | awk '{print  $2}') -le 2048 ]; then
		_askSwap
	fi
	_askautoreboot

	# Conclusion
	_summary

	# Excute installation
fi

