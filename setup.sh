#!/bin/bash
#
# [QuickBox Lite Installation Guide Script]
#
# GitHub:   https://github.com/amefs/quickbox-lite
# Author:   Amefs
# Current version:  v1.0.0
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

function _init() {
    
    _defaultcolor

    # initialization environment
    local_prefix=/etc/QuickBox/
    local_setup_script=${local_prefix}setup/scripts/
    local_setup_template=${local_prefix}setup/templates/
    local_setup_sources=${local_prefix}setup/sources/
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
    RELEASE=$(lsb_release -rs)
    CODENAME=$(lsb_release -cs)
    SETNAME=$(lsb_release -rc)
    OSARCH=$(dpkg --print-architecture)
    export LANG="en_US.UTF-8" >/dev/null 2>&1
    export LC_ALL="en_US.UTF-8" >/dev/null 2>&1
    export LANGUAGE="en_US.UTF-8" >/dev/null 2>&1
    {
    # prepare scripts
    echo -e "XXX\n00\nPreparing scripts... \nXXX"
    # install base packages
    DEBIAN_FRONTEND=noninteractive apt-get -qq -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update >/dev/null 2>&1
    echo -e "XXX\n10\nPreparing scripts... \nXXX"
    if [[ $DISTRO == Ubuntu && $CODENAME == xenial ]]; then
        apt-get -y install git curl dos2unix python-minimal apt-transport-https software-properties-common dnsutils unzip  > /dev/null 2>&1
    elif [[ $DISTRO == Ubuntu && $CODENAME == bionic ]]; then
        apt-get -y install git curl dos2unix python apt-transport-https software-properties-common dnsutils unzip  > /dev/null 2>&1
    elif [[ $DISTRO == Debian ]]; then
        apt-get -y install git curl dos2unix python apt-transport-https software-properties-common gnupg2 ca-certificates dnsutils unzip  > /dev/null 2>&1
    fi
    echo -e "XXX\n20\nPreparing scripts... \nXXX"
    dos2unix $(find ${local_prefix} -type f) > /dev/null 2>&1
    chmod +x $(find ${local_prefix} -type f) > /dev/null 2>&1
    if [[ -d /usr/local/bin/quickbox ]]; then
        rm -rf /usr/local/bin/quickbox
    fi
    ln -s ${local_packages} /usr/local/bin/quickbox
    echo -e "XXX\n30\nPreparing scripts... Done.\nXXX"
    sleep 0.5

    # install net-tools for IP detection
    echo -e "XXX\n30\nGetting network status... \nXXX"
    apt-get -qq -y install net-tools > /dev/null 2>&1
    echo -e "XXX\n70\nGetting network status... Done.\nXXX"
    sleep 0.5
    
    # setup location infomation
    echo -e "XXX\n70\nSetting up location... \nXXX"
    if [[ ! $(grep "^en_US.UTF-8 UTF-8" /etc/locale.gen >/dev/null 2>&1) && ! $(grep "^zh_CN.UTF-8 UTF-8" /etc/locale.gen >/dev/null 2>&1) ]]; then
        sed -i "s/^[a-z]/# &/g" /etc/locale.gen
        echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
        echo "zh_CN.UTF-8 UTF-8" >> /etc/locale.gen
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
    local menu_choice=$(whiptail --title "Installation Language" --menu "Choose a language" --nocancel 12 72 4 \
"English" "        Install with English" \
"Chinese Simpified" "        安装为简体中文" 3>&1 1>&2 2>&3 )
            case $menu_choice in
                "English") 
                    source ${local_lang}en.lang
                    echo 'LANGUAGE="en_US.UTF-8"' >> /etc/default/locale
                    echo 'LC_ALL="en_US.UTF-8"' >> /etc/default/locale
                    ;;
                "Chinese Simpified") 
                    source ${local_lang}zh-cn.lang
                    echo 'LANGUAGE="zh_CN.UTF-8"' >> /etc/default/locale
                    echo 'LC_ALL="zh_CN.UTF-8"' >> /etc/default/locale
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
    elif [[ ! "$CODENAME" =~ ("xenial"|"bionic"|"stretch"|"buster") ]]; then
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
        exit 1;
    fi
}

function _logcheck() {
    if (whiptail --title "$INFO_TITLE_LOG" --yesno "$INFO_TEXT_LOG" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
        OUTTO="/root/quickbox.$PPID.log";
    else
        OUTTO="/dev/null 2>&1";
    fi
}

function _askhostname() {
    hostname=""
    hostname=$(whiptail --title "$INFO_TITLE_HOSTNAME" --inputbox "$INFO_TEXT_HOSTNAME" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
}

function _chhostname() {
    if [[ $hostname != "" ]]; then
        echo "$hostname">/etc/hostname
        echo "127.0.0.1 $hostname">/etc/hosts
    fi
}

function _askchport() {
    chport=""
    while [[ $chport == "" ]]; do
    chport=$(whiptail --title "$INFO_TITLE_SSH" --radiolist \
        "$INFO_TEXT_SSH" 12 40 4 \
        "22" "$CHOICE_TEXT_SSH_1" off \
        "4747" "$CHOICE_TEXT_SSH_2" on \
        --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3 )
    done
}

function _changeport() {
    if [[ -e /etc/ssh/sshd_config ]]; then
        sed -i "s/#*Port 22/Port $chport/g" /etc/ssh/sshd_config
        service ssh restart >> ${OUTTO} 2>&1
    fi
}

function _askusrname() {
    local count=0
    local valid=""
    while [[ $username == "root" || $username == "admin" || $count -lt 3 || $valid == "" ]]; do
        username=$(whiptail --title "$INFO_TITLE_NAME" --inputbox "$INFO_TEXT_NAME" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 8 72 3>&1 1>&2 2>&3)
        # check username length
        count=`echo -n $username | wc -c`
        # ensure vaild username
        valid=`echo "$username" | grep -P '^[a-z][-a-z0-9_]*'`
        _errorcolor
        if [[ $username == "root" || $username == "admin" ]]; then whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_1" --ok-button "$BUTTON_OK" 8 72; fi
        if [[ $count -lt 3 ]]; then 
            whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_2" --ok-button "$BUTTON_OK" 8 72; 
        else
            if [[ $valid == "" ]]; then 
                whiptail --title "$ERROR_TITLE_NAME" --msgbox "$ERROR_TEXT_NAME_3"  --ok-button "$BUTTON_OK" 8 72; 
            fi
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
        count=`echo -n $password | wc -c`
        # ensure password strength
        strength=`echo "$password" | grep -P '(?=^.{8,32}$)(?=^[^\s]*$)(?=.*\d)(?=.*[A-Z])(?=.*[a-z])'`
        _errorcolor
        if [[ $count -lt 8 ]]; then 
                whiptail --title "$ERROR_TITLE_PASSWD" --msgbox "$ERROR_TEXT_PASSWD_1" --ok-button "$BUTTON_OK" 8 72;
        else
            if [[ $strength == "" ]]; then 
                whiptail --title "$ERROR_TITLE_PASSWD" --msgbox \
                "$ERROR_TEXT_PASSWD_2" --ok-button "$BUTTON_OK" 10 72; 
            fi
        fi
        _defaultcolor
    done
}

function _skel() {
    echo -e "XXX\n17\n$INFO_TEXT_PROGRESS_3_1\nXXX"
    mkdir -p /etc/skel
    cp -rf ${local_setup_template}skel /etc
    cd /tmp
    wget -t2 -T5 -q -N -O GeoLiteCity.dat.gz https://sourceforge.net/projects/seedbox-software-for-linux/files/all-platform/GeoLiteCity.dat.gz/download
    gunzip GeoLiteCity.dat.gz >/dev/null 2>&1
    mkdir -p /usr/share/GeoIP
    rm -rf GeoLiteCity.dat.gz
    mv GeoLiteCity.dat /usr/share/GeoIP/GeoIPCity.dat
    (echo y;echo o conf prerequisites_policy follow;echo o conf commit)>/dev/null 2>&1|cpan Digest::SHA1 >>"${OUTTO}" 2>&1
    (echo y;echo o conf prerequisites_policy follow;echo o conf commit)>/dev/null 2>&1|cpan Digest::SHA >>"${OUTTO}" 2>&1
}

function _lshell() {
    echo -e "XXX\n18\n$INFO_TEXT_PROGRESS_3_2\nXXX"
    apt-get -y install lshell > /dev/null 2>&1
    cp ${local_setup_template}lshell/lshell.conf.template /etc/lshell.conf
}


function _genadmin() {
    # add skel template
    _skel
    # add limit shell
    _lshell
    echo -e "XXX\n19\n$INFO_TEXT_PROGRESS_3\nXXX"
    # save account info to file
    local passphrase=$(openssl rand -hex 64)
    if [[ $CODENAME == xenial ]]; then
        echo "${username}:$(echo ${password} | openssl enc -aes-128-ecb -a -e -pass pass:${passphrase} -nosalt)" > /root/.admin.info
    else
        echo "${username}:$(echo ${password} | openssl enc -aes-128-ecb -pbkdf2 -a -e -pass pass:${passphrase} -nosalt)" > /root/.admin.info
    fi
    mkdir -p /root/.qbuser
    cp /root/.admin.info /root/.qbuser/${username}.info
    mkdir -p /root/.ssh
    echo ${passphrase} > /root/.ssh/local_user
    chmod 600 /root/.ssh/local_user && chmod 700 /root/.ssh
    # create account
    if [[ -d /home/"$username" ]]; then
        cd /etc/skel
        cp -fR . /home/$username/
    else
        useradd "${username}" -m -G www-data -s /bin/bash
    fi
    chpasswd<<<"${username}:${password}"
    echo "${username}:$(openssl passwd -apr1 ${password})" > /etc/htpasswd
    mkdir -p /etc/htpasswd.d/
    echo "${username}:$(openssl passwd -apr1 ${password})" > /etc/htpasswd.d/htpasswd.${username}
    chown -R $username:$username /home/${username}
    chmod 750 /home/${username}
    echo "D /var/run/${username} 0750 ${username} ${username} -" >> /etc/tmpfiles.d/${username}.conf
    systemd-tmpfiles /etc/tmpfiles.d/${username}.conf --create >>"${OUTTO}" 2>&1
    # setup sudoers
    cp ${local_setup_template}sudoers.template /etc/sudoers.d/dashboard
    if grep ${username} /etc/sudoers.d/quickbox >/dev/null 2>&1; then
        echo "No sudoers modification made ... " >>"${OUTTO}" 2>&1
    else
        echo "${username} ALL=(ALL:ALL) ALL" >> /etc/sudoers.d/quickbox;
    fi
    # setup bash custom
    if [ ! -f /root/.bash_qb ]; then
        cat >>/root/.bashrc<<'EOF'

if [ -f ~/.bash_qb ]; then
    . ~/.bash_qb
fi
EOF
        cp ${local_setup_template}bash_qb.template /root/.bash_qb
    fi
}

function _askmount() {
    # get all disk mount
    local mountpoint=$(df -h | tr -s ' ' | cut -d " " -f 1 | grep /dev/)
    local LIST=()
    local extralength=0
    # create list for mountpoint (onlu for / and /home)
    for dev in ${mountpoint[@]}; do
        local dirs=$(df -h $dev | grep /dev/ | tr -s ' ' | cut -d " " -f 6,6)
        if [[ $dirs == "/" || $dirs == "/home" ]]; then
            LIST+=( "$dirs" "  $(df -h $dev | grep /dev/ | tr -s ' ' | cut -d " " -f 1)    $(df -h $dev | grep /dev/ | tr -s ' ' | cut -d " " -f 2)" off )
        fi
        if [ "$(echo -n "$(df -h $dev | grep /dev/ | tr -s ' ' | cut -d " " -f 1)" | wc -m)" -gt "10" ]; then extralength=1; fi
    done
    device=""
    if [[ $extralength == 1 ]]; then
        local width=56
    else
        local width=40
    fi
    while [[ $device == "" ]]; do
        device=$(whiptail --title "$INFO_TITLE_MOUNT" --radiolist \
        "$(if [[ $extralength == 1 ]]; then echo "      "; fi)$INFO_TEXT_MOUNT" 12 ${width} 4 \
        "  ${LIST[@]}" \
         --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3 )
    done
    device=$(echo $device | tr -d "[:space:]")
}

function _askvsftpd() {
    ip=$(ip addr show |grep 'inet '|grep -v 127.0.0.1 |awk '{print $2}'| cut -d/ -f1 | head -n 1);
    if (whiptail --title "$INFO_TITLE_FTP" --yesno "$INFO_TEXT_FTP" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
        ftp=1;
        ftp_ip=""
        ftp_ip=$(whiptail --title "$INFO_TITLE_FTP_IP" --inputbox "${INFO_TEXT_FTP_IP_1} $ip\n${INFO_TEXT_FTP_IP_2}" 10 72 --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3)
        if [[ $ftp_ip == "" ]]; then ftp_ip=$ip; fi
    else
        ftp=0;
    fi
}

function _setvsftpd() {
    apt-get -y install vsftpd >> ${OUTTO} 2>&1
    systemctl stop vsftpd >/dev/null 2>&1
    cp ${local_setup_template}vsftpd/openssl.cnf.template /root/.openssl.cnf
    openssl req -config /root/.openssl.cnf -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/vsftpd.pem -out /etc/ssl/private/vsftpd.pem >/dev/null 2>&1
    cp ${local_setup_template}vsftpd/vsftpd.conf.template /etc/vsftpd.conf
    sed -i 's/^\(pasv_min_port=\).*/\110090/' /etc/vsftpd.conf
    sed -i 's/^\(pasv_max_port=\).*/\110100/' /etc/vsftpd.conf
    echo "pasv_address="$ftp_ip >> /etc/vsftpd.conf
    iptables -I INPUT -p tcp --destination-port 10090:10100 -j ACCEPT >> ${OUTTO} 2>&1
    echo "" > /etc/vsftpd.chroot_list
    systemctl start vsftpd >/dev/null 2>&1
}

function _askdashtheme() {
    dash_theme=""
    while [[ $dash_theme == "" ]]; do
    dash_theme=$(whiptail --title "$INFO_TITLE_THEME" --radiolist \
        "$INFO_TEXT_THEME" 12 48 4 \
        "defaulted" "$CHOICE_TEXT_THEME_1" off \
        "smoked" "$CHOICE_TEXT_THEME_2" on \
        3>&1 1>&2 2>&3 )
    done
}

function _askchsource() {
    if (whiptail --title "$INFO_TITLE_SOURCE" --yesno "$INFO_TEXT_SOURCE" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
        chsource=1;
        mirror=$(whiptail --title "$INFO_TITLE_SOURCE" --radiolist \
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
3>&1 1>&2 2>&3 )
    else
        chsource=0;
    fi
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
    # add php7.2
        apt-key adv --recv-keys --keyserver hkp://keyserver.ubuntu.com:80 0x5a16e7281be7a449 >/dev/null 2>&1
        LC_ALL=en_US.UTF-8 add-apt-repository ppa:ondrej/php -y >/dev/null 2>&1
    elif [[ $DISTRO == "Debian" ]]; then
    # add php for debian
        printf "\n" | wget -q https://packages.sury.org/php/apt.gpg -O- | apt-key add - >/dev/null 2>&1
        cat >/etc/apt/sources.list.d/php.list<<DPHP
deb https://packages.sury.org/php/ $(lsb_release -sc) main
DPHP
    fi
    DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update >> ${OUTTO}  2>&1
    echo -e "XXX\n12\n$INFO_TEXT_PROGRESS_Extra_1\nXXX"
    DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade --allow-unauthenticated >> ${OUTTO} 2>&1
    # auto solve dpkg lock
    if [ "$?" -eq 2 ]; then
        rm -f /var/lib/dpkg/updates/0*
        locks=$(find /var/lib/dpkg/lock* && find /var/cache/apt/archives/lock*)
        if [[ ${locks} == $(find /var/lib/dpkg/lock* && find /var/cache/apt/archives/lock*) ]]; then
            for l in ${locks}; do
                rm -rf ${l}
            done
            dpkg --configure -a >> ${OUTTO} 2>&1
            DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" update >> ${OUTTO} 2>&1
            DEBIAN_FRONTEND=noninteractive apt-get -yqq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade >> ${OUTTO} 2>&1
        fi
        apt-get check >/dev/null 2>&1
        if [ "$?" -ne 0 ]; then
            apt-get install -f >> ${OUTTO} 2>&1
            apt-get check >/dev/null 2>&1
            if [ "$?" -ne 0 ]; then
                whiptail --title "$ERROR_TITLE_INSTALL" --msgbox "$ERROR_TEXT_INSTALL_1" --ok-button "$BUTTON_OK" 8 72
                exit 1
            fi
        fi
    fi
}

function _dependency() {
    _addPHP
    DEPLIST="sudo bc curl wget nginx-extras subversion ssl-cert php-memcached memcached php7.2 php7.2-cli php7.2-curl php7.2-dev php7.2-fpm php7.2-gd php7.2-geoip php7.2-json php7.2-mbstring php7.2-opcache php7.2-xml php7.2-xmlrpc php7.2-zip libfcgi0ldbl mcrypt libmcrypt-dev nano python-dev unzip htop iotop vnstat vnstati automake make openssl net-tools debconf-utils ntp rsync"
    for depend in $DEPLIST; do
        echo -e "XXX\n12\n$INFO_TEXT_PROGRESS_Extra_2${depend}\nXXX"
        apt-get -y install ${depend} --allow-unauthenticated >> ${OUTTO} 2>&1 || { local dependError=1; }
        if [[ $dependError == "1" ]]; then
            whiptail --title "$ERROR_TITLE_INSTALL" --msgbox "$ERROR_TEXT_INSTALL_1${depend}" 8 64; 
            exit 1;
        fi
    done
}

function _insngx() {
    rm -rf /etc/nginx/nginx.conf
    if [[ $CODENAME =~ ("bionic"|"stretch"|"buster") ]]; then
    cp ${local_setup_template}nginx/nginx.conf.new.template /etc/nginx/nginx.conf
    else
    cp ${local_setup_template}nginx/nginx.conf.old.template /etc/nginx/nginx.conf
    fi

    rm -rf /etc/nginx/sites-enabled/default
    cp ${local_setup_template}nginx/default.template /etc/nginx/sites-enabled/default

    ln -nsf /usr/bin/php7.2 /usr/bin/php
    sed -i.bak -e "s/post_max_size.*/post_max_size = 64M/" \
-e "s/upload_max_filesize.*/upload_max_filesize = 92M/" \
-e "s/expose_php.*/expose_php = Off/" \
-e "s/128M/768M/" \
-e "s/;cgi.fix_pathinfo.*/cgi.fix_pathinfo=1/" \
-e "s/;opcache.enable.*/opcache.enable=1/" \
-e "s/;opcache.memory_consumption.*/opcache.memory_consumption=128/" \
-e "s/;opcache.max_accelerated_files.*/opcache.max_accelerated_files=4000/" \
-e "s/;opcache.revalidate_freq.*/opcache.revalidate_freq=240/" /etc/php/7.2/fpm/php.ini

    phpenmod -v 7.2 opcache
    phpenmod -v 7.2 xml
    phpenmod -v 7.2 mbstring
    phpenmod -v 7.2 msgpack
    phpenmod -v 7.2 memcached

    mkdir -p /etc/nginx/ssl/
    mkdir -p /etc/nginx/snippets/
    mkdir -p /etc/nginx/apps/
    chmod 700 /etc/nginx/ssl

    cd /etc/nginx/ssl
    openssl dhparam -out dhparam.pem 2048 >> ${OUTTO} 2>&1

    cp ${local_setup_template}nginx/ssl-params.conf.template /etc/nginx/snippets/ssl-params.conf

    cp ${local_setup_template}nginx/proxy.conf.template /etc/nginx/snippets/proxy.conf

    svn export https://github.com/Naereen/Nginx-Fancyindex-Theme/trunk/Nginx-Fancyindex-Theme-dark /srv/fancyindex >> ${OUTTO} 2>&1
    cp ${local_setup_template}nginx/fancyindex.conf.template /etc/nginx/snippets/fancyindex.conf
    sed -i 's/href="\/[^\/]*/href="\/fancyindex/g' /srv/fancyindex/header.html
    sed -i 's/src="\/[^\/]*/src="\/fancyindex/g' /srv/fancyindex/footer.html

    # Generate snakeoil certs should they not exists as on some providers
    if [[ ! -f /etc/ssl/certs/ssl-cert-snakeoil.pem ]]; then
    cp ${local_setup_template}openssl.cnf.template /root/.openssl.cnf
    openssl req -config /root/.openssl.cnf -x509 -nodes -days 365 -newkey rsa:1024 -keyout /etc/ssl/private/ssl-cert-snakeoil.key -out /etc/ssl/certs/ssl-cert-snakeoil.pem
    fi

    systemctl restart nginx
    systemctl restart php7.2-fpm
}

function _webconsole() {
    # setup webconsole for dashboard
    PUBLICIP=$(ip addr show |grep 'inet '|grep -v 127.0.0.1 |awk '{print $2}'| cut -d/ -f1 | head -n 1);
cat >/etc/profile<<EOF
echo " Welcome Back !"
echo "    * Dashboard:  https://${PUBLICIP}"
echo ""
EOF
    # install shellinabox and service config
    apt-get -y install shellinabox >>"${OUTTO}" 2>&1;
    service shellinabox stop >/dev/null 2>&1
    rm -rf /etc/init.d/shellinabox

    if [[ ! -f /etc/nginx/apps/${username}.console.conf ]]; then
        cat > /etc/nginx/apps/${username}.console.conf <<WEBC
location /${username}.console/ {
    proxy_pass        http://127.0.0.1:4200;
    #auth_basic "What's the password?";
    #auth_basic_user_file /etc/htpasswd.d/htpasswd.${username};
}
WEBC
    fi
    if [[ -z $(grep disable-ssl /etc/default/shellinabox) ]]; then
        sed -i 's/SHELLINABOX_ARGS="/SHELLINABOX_ARGS="--disable-ssl /g' /etc/default/shellinabox
    fi
    if [[ -z $(grep localhost-only /etc/default/shellinabox) ]]; then
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
    echo -e "XXX\n29\n$INFO_TEXT_PROGRESS_7_2\nXXX"
    _webconsole
    cd && mkdir -p /srv/dashboard
    \cp -fR ${local_setup_dashboard}. /srv/dashboard
    touch /srv/dashboard/db/output.log
    /usr/local/bin/quickbox/system/theme/themeSelect-${dash_theme}
    IFACE=$(ip link show|grep -i broadcast|grep -m1 UP|cut -d: -f 2|cut -d@ -f 1|sed -e 's/ //g');
    echo "${IFACE}" > /srv/dashboard/db/interface.txt
    sed -i "s/INETFACE/${IFACE}/g" /srv/dashboard/widgets/stat.php;
    sed -i "s/INETFACE/${IFACE}/g" /srv/dashboard/widgets/data.php;
    sed -i "s/INETFACE/${IFACE}/g" /srv/dashboard/widgets/bw_tables.php;
    sed -i "s/INETFACE/${IFACE}/g" /srv/dashboard/inc/config.php;
    echo "${username}" > /srv/dashboard/db/master.txt
    # fix Disk Widget
    if [[ $device == "/home" ]]; then
        rm -f /srv/dashboard/widgets/disk_data.php
        cp ${local_setup_dashboard}widgets/disk_datah.php /srv/dashboard/widgets/disk_data.php
    else
        rm -f /srv/dashboard/widgets/disk_data.php
        cp ${local_setup_dashboard}widgets/disk_data.php /srv/dashboard/widgets/disk_data.php
    fi
    chown -R www-data: /srv/dashboard
    cp ${local_setup_template}nginx/dashboard.conf.template /etc/nginx/apps/dashboard.conf
    sed -i "s/\/etc\/htpasswd/\/etc\/htpasswd.d\/htpasswd.${username}/g" /etc/nginx/apps/dashboard.conf
    service nginx force-reload > /dev/null 2>&1
    case $lang_ui in
        "en") 
            $(bash /usr/local/bin/quickbox/system/lang/langSelect-lang_en) >/dev/null 2>&1
            touch /install/.lang_en.lock;;
        "zh-cn") 
            $(bash /usr/local/bin/quickbox/system/lang/langSelect-lang_zh-cn) >/dev/null 2>&1
            touch /install/.lang_zh.lock;;
    esac
    
    touch /install/.dashboard.lock
}

function _askapps() {
    app_list=$(whiptail --title "$INFO_TITLE_APPS" --checklist --separate-output --separate-output "$INFO_TEXT_APPS" --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 16 56 8 \
"rtorrent" "$CHOICE_TEXT_APPS_1" OFF \
"transmission" "$CHOICE_TEXT_APPS_2" OFF \
"qbittorrent" "$CHOICE_TEXT_APPS_3" OFF \
"deluge" "$CHOICE_TEXT_APPS_4" OFF \
"mktorrent" "$CHOICE_TEXT_APPS_5" OFF \
"ffmpeg" "$CHOICE_TEXT_APPS_6" ON \
"filebrowser" "$CHOICE_TEXT_APPS_7" OFF \
"linuxrar" "$CHOICE_TEXT_APPS_8" ON 3>&1 1>&2 2>&3 )
    _askrtgui
}

function _askbbr() {
    enable_bbr=""
    while [[ $enable_bbr == "" ]]; do
        enable_bbr=$(whiptail --title "$INFO_TITLE_BBR" --radiolist \
            "$INFO_TEXT_BBR" 12 32 4 \
            "0" "$CHOICE_TEXT_BBR_1" on \
            "1" "$CHOICE_TEXT_BBR_2" off \
            3>&1 1>&2 2>&3 )
    done
    if [[ $enable_bbr == 1 && $CODENAME == xenial ]]; then
        if (whiptail --title "$INFO_TITLE_XENIAL_BBR" --yesno "$INFO_TEXT_XENIAL_BBR" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
                enable_bbr=1
            else
                enable_bbr=0
        fi
    fi
}

function _insbbr() {
    $(bash /usr/local/bin/quickbox/system/auxiliary/install-BBR.sh -l ${OUTTO}) >/dev/null 2>&1
}

function _askrtgui() {
    if [[ "$app_list" =~ "rtorrent" ]]; then
        rtgui=""
        while [[ $rtgui == "" ]]; do
        rtgui=$(whiptail --title "$INFO_TITLE_RTGUI" --radiolist \
            "$INFO_TEXT_RTGUI" 12 56 4 \
            "rutorrent" "$CHOICE_TEXT_RTGUI_1" off \
            "flood" "$CHOICE_TEXT_RTGUI_2" off \
            --ok-button "$BUTTON_OK" --cancel-button "$BUTTON_CANCLE" 3>&1 1>&2 2>&3 )
        done
    fi
}

function _insapps() {
    if [[ "$app_list" =~ "rtorrent" ]]; then 
        echo -e "XXX\n30\n$INFO_TEXT_INSTALLAPP_1\nXXX"
        $(${local_setup_script}rtorrent.sh ${OUTTO} ${rtgui}) >/dev/null 2>&1
        echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_1$INFO_TEXT_DONE\nXXX"
    else
        echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_1$INFO_TEXT_SKIP\nXXX"
    fi
    sleep 1
    if [[ "$app_list" =~ "transmission" ]]; then 
        echo -e "XXX\n36\n$INFO_TEXT_INSTALLAPP_2\nXXX"
        $(${local_setup_script}transmission.sh ${OUTTO}) >/dev/null 2>&1
        echo -e "XXX\n43\n$INFO_TEXT_INSTALLAPP_2$INFO_TEXT_DONE\nXXX"
    else
        echo -e "XXX\n43\n$INFO_TEXT_INSTALLAPP_2$INFO_TEXT_SKIP\nXXX"
    fi
    sleep 1
    if [[ "$app_list" =~ "qbittorrent" ]]; then 
        echo -e "XXX\n43\n$INFO_TEXT_INSTALLAPP_3\nXXX"
        $(${local_setup_script}qbittorrent.sh ${OUTTO}) >/dev/null 2>&1
        echo -e "XXX\n49\n$INFO_TEXT_INSTALLAPP_3$INFO_TEXT_DONE\nXXX"
    else
        echo -e "XXX\n49\n$INFO_TEXT_INSTALLAPP_3$INFO_TEXT_SKIP\nXXX"
    fi
    sleep 1
    if [[ "$app_list" =~ "deluge" ]]; then 
        echo -e "XXX\n49\n$INFO_TEXT_INSTALLAPP_4\nXXX"
        $(${local_setup_script}deluge.sh ${OUTTO}) >/dev/null 2>&1
        echo -e "XXX\n56\n$INFO_TEXT_INSTALLAPP_4$INFO_TEXT_DONE\nXXX"
    else
        echo -e "XXX\n56\n$INFO_TEXT_INSTALLAPP_4$INFO_TEXT_SKIP\nXXX"
    fi
    sleep 1
    if [[ "$app_list" =~ "mktorrent" ]]; then 
        echo -e "XXX\n56\n$INFO_TEXT_INSTALLAPP_5\nXXX"
        $(${local_setup_script}mktorrent.sh ${OUTTO}) >/dev/null 2>&1
        echo -e "XXX\n62\n$INFO_TEXT_INSTALLAPP_5$INFO_TEXT_DONE\nXXX"
    else
        echo -e "XXX\n62\n$INFO_TEXT_INSTALLAPP_5$INFO_TEXT_SKIP\nXXX"
    fi
    sleep 1
    if [[ "$app_list" =~ "ffmpeg" ]]; then 
        echo -e "XXX\n62\n$INFO_TEXT_INSTALLAPP_6\nXXX"
        $(${local_setup_script}ffmpeg.sh ${OUTTO}) >/dev/null 2>&1
        echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_6$INFO_TEXT_DONE\nXXX"
    else
        echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_6$INFO_TEXT_SKIP\nXXX"
    fi
    sleep 1
    if [[ "$app_list" =~ "filebrowser" ]]; then 
        echo -e "XXX\n69\n$INFO_TEXT_INSTALLAPP_7\nXXX"
        $(${local_setup_script}filebrowser.sh ${OUTTO}) >/dev/null 2>&1
        echo -e "XXX\n75\n$INFO_TEXT_INSTALLAPP_7$INFO_TEXT_DONE\nXXX"
    else
        echo -e "XXX\n75\n$INFO_TEXT_INSTALLAPP_7$INFO_TEXT_SKIP\nXXX"
    fi
    sleep 1
    if [[ "$app_list" =~ "linuxrar" ]]; then 
        echo -e "XXX\n75\n$INFO_TEXT_INSTALLAPP_8\nXXX"
        $(${local_setup_script}linuxrar.sh ${OUTTO}) >/dev/null 2>&1
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
            denytracker=1;
        else
            denytracker=0;
        fi
    fi
}

function _denytracker() {
    cp ${local_setup_template}tracker/trackers.template /etc/trackers
    cp ${local_setup_template}tracker/denypublic.template /etc/cron.daily/denypublic
    chmod +x /etc/cron.daily/denypublic
    cat ${local_setup_template}tracker/hostsTrackers.template >> /etc/hosts
}

function _finish() {
    sleep 1
}

function _askautoreboot() {
    if (whiptail --title "$INFO_TITLE_AUTOREBOOT" --yesno "$INFO_TEXT_AUTOREBOOT" --defaultno --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
        autoreboot=1;
    else
        autoreboot=0;
    fi
}

function _fixbcm() {
    if lspci | grep -i bcm > /dev/null; then
        mkdir -p /tmp/bcm
        cd /tmp/bcm
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
        if [[ $chport == "4747" ]]; then
            _changeport
            echo -e "XXX\n06\n$INFO_TEXT_PROGRESS_2$INFO_TEXT_DONE\nXXX"
        else
            echo -e "XXX\n06\n$INFO_TEXT_PROGRESS_2$INFO_TEXT_SKIP\nXXX"
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
        _setvsftpd
        echo -e "XXX\n90\n$INFO_TEXT_PROGRESS_10$INFO_TEXT_DONE\nXXX"
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

        # Finish
        echo -e "XXX\n95\n$INFO_TEXT_PROGRESS_12\nXXX"
        service apache2 disable >/dev/null 2>&1
        service apache2 stop >/dev/null 2>&1
        APACHE_PKGS='apache2 apache2-bin apache2-data'
        apt-get -y remove ${APACHE_PKGS} >/dev/null 2>&1
        apt-get -y purge ${APACHE_PKGS} >/dev/null 2>&1
        apt-get -y autoclean >/dev/null 2>&1
        rm -rf /install/.system.lock
        echo -e "XXX\n100\n$INFO_TEXT_PROGRESS_13\nXXX"
        sleep 0.5
    } | whiptail --title "$INFO_TITLE_PROGRESS" --gauge "$INFO_TEXT_PROGRESS_0" 8 64 0
    # record end time
    endtime=$(date +%s)
    timeused=$(( $endtime - $starttime ))
    timeusedmin=$(expr $timeused / 60)
    echo -e "\n#################################################################################" >>"${OUTTO}" 2>&1;
    echo "Install finished in $timeusedmin Min" >>"${OUTTO}" 2>&1;
    if [[ $autoreboot == 1 ]]; then reboot; fi
    if (whiptail --title "$INFO_TITLE_FIN" --yesno "$INFO_TEXT_FIN_1$timeusedmin$INFO_TEXT_FIN_MIN\n$INFO_TEXT_FIN_2" --yes-button "$BUTTON_YES" --no-button "$BUTTON_NO" 8 72); then
        reboot;
    else
        exit 0;
    fi
}

function _summary() {
    # Summary list
    ip=$(ip addr show |grep 'inet '|grep -v 127.0.0.1 |awk '{print $2}'| cut -d/ -f1 | head -n 1);
    if (whiptail --title "$INFO_TITLE_SUMMARY" --yesno "${INFO_TEXT_SUMMARY_1}\n\n\
${INFO_TEXT_SUMMARY_2} $(echo $OUTTO | cut -d " " -f 1 )\n\
$(if [[ $hostname != "" ]]; then echo "${INFO_TEXT_SUMMARY_3}$hostname\n"; fi)\
${INFO_TEXT_SUMMARY_4} $ip:$chport\n\
${INFO_TEXT_SUMMARY_5} $username\n\
${INFO_TEXT_SUMMARY_6} $password\n\
\"$device\" ${INFO_TEXT_SUMMARY_7}\n\
$(if [[ $ftp == 1 ]]; then echo "${INFO_TEXT_SUMMARY_11} $ftp_ip:5757\n"; fi)\
${INFO_TEXT_SUMMARY_12} $dash_theme ${INFO_TEXT_SUMMARY_13}\n\
$(if [[ $chsource == 1 ]]; then echo "${INFO_TEXT_SUMMARY_14}\n"; fi)\
$(if [[ $app_list != "" ]]; then
    echo "\n${INFO_TEXT_SUMMARY_15}"
    for i in "${app_list[@]}"; do
        echo -e "${i} "
    done
    echo "\n"
fi)\
$(if [[ "$app_list" =~ "rtorrent" ]]; then echo "$rtgui ${INFO_TEXT_SUMMARY_16}\n"; fi)\
$(if [[ $enable_bbr == 1 ]]; then echo "${INFO_TEXT_SUMMARY_18}\n"; fi)\
$(if [[ $autoreboot == 1 ]]; then echo "${INFO_TEXT_SUMMARY_17}\n"; fi)\
" --yes-button "$BUTTON_CONFIRM" --no-button "$BUTTON_CANCLE" 28 72); then
        # call installation function
        _startinstall
        elif (whiptail --title "$INFO" --yesno "$INFO_TEXT_ABORT" --yes-button "$BUTTON_EDIT" --no-button "$BUTTON_ABORT" 8 72); then
            # display a menu for each question
            local menu_choice=$(whiptail --title "$INFO_TITLE_EDIT" --menu "$INFO_TEXT_EDIT" 18 72 12 \
"hostname" "$CHOICE_TEXT_EDIT_1" \
"ssh port" "$CHOICE_TEXT_EDIT_2" \
"user name" "$CHOICE_TEXT_EDIT_3" \
"password" "$CHOICE_TEXT_EDIT_4" \
"primary root" "$CHOICE_TEXT_EDIT_5" \
"ftp" "$CHOICE_TEXT_EDIT_7" \
"dashboard theme" "$CHOICE_TEXT_EDIT_8" \
"source.list" "$CHOICE_TEXT_EDIT_9" \
"softwares" "$CHOICE_TEXT_EDIT_10" \
"BBR" "$CHOICE_TEXT_EDIT_12" \
"autoreboot" "$CHOICE_TEXT_EDIT_11" 3>&1 1>&2 2>&3 )
            case $menu_choice in
                "hostname") _askhostname;;
                "ssh port") _askchport;;
                "user name") _askusrname;;
                "password") _askpasswd;;
                "primary root") _askmount;;
                "ftp") _askvsftpd;;
                "dashboard theme") _askdashtheme;;
                "source.list") _askchsource;;
                "softwares") _askapps;;
                "BBR") _askbbr;;
                "autoreboot") _askautoreboot;;
            esac
        _summary
        else
            # Abort Installation
            exit 1;
    fi
}

# Init
_init
_selectlang
_checkroot
_checkdistro
_checkkernel
_checkovz
_welcome

# Install guide
_logcheck
_askhostname
_askchport
_askusrname
_askpasswd
_askmount
_askvsftpd
_askdashtheme
_askchsource
_askapps
_askdenytracker
_askbbr
_askautoreboot

# Conclusion
_summary

# Excute installation