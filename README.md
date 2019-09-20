

![QB-lite](https://i.loli.net/2019/09/16/nqx5mwdDVW3lY6a.png)

# Project QuickBox-Lite

[中文版](https://github.com/amefs/quickbox-lite/blob/master/README_zh.md)

---

This project is a modified version of QuickBox community edition. The aim of this project is to build a lightweight QuickBox software kit. Most of the functions of QuickBox CE will be retained, but only the most commonly used stable third party software will be included. The prebuilt BT client will also be included, which can greatly reduce the installation time as well as CPU requirement to compile them. Most of the softwares will be available as modules, the panel no longer needs the support of ruTorrent, you can select what you need, this is also why the project named 'Lite'.

---

## Main feature

1. Graphical installation guide (Multi-language available)
2. Use nginx instead of apache
3. Modular installation
4. Latest OS support
5. up to date apps (include prebuild deb packages)

---

## Script status

![Version](https://img.shields.io/badge/version-0.1.0-orange?style=flat-square)![GNU v3.0 License](https://img.shields.io/badge/license-GNU%20v3.0%20License-blue.svg?style=flat-square)

---

## How to install

### before install

Hard ware requirement:

- CPU: At least a 64bit Compatible x86_64 CPU
- RAM: large than 1GB (recommend more for better performance)
- Storage: 20GB HDD (for seeding, you need more)

OS Support (amd64 only):

![Ubuntu18.04](https://img.shields.io/badge/Ubuntu%2018.04-passing-brightgreen.svg?style=flat-square)![Ubuntu16.04](https://img.shields.io/badge/Ubuntu%2016.04-passing-brightgreen.svg?style=flat-square)![Debian9](https://img.shields.io/badge/Debian%209-passing-brightgreen.svg?style=flat-square)![Debian10](https://img.shields.io/badge/Debian%2010-passing-brightgreen.svg?style=flat-square)

Server Support:

- Bare-metal server
- Dedicated server
- VPS with KVM/Xen/VMware (OpenVZ is not supported)

**OVH DEFAULT KERNEL NOTICE!**

> grsec is built into OVH's custom kernel and it absolutely wrecks havoc when using these panels where we depend on the ability for one user (www-data) to see the processes of another running user ($username).
> This can be seen clearly by using a task manager such as htop.
> With grsec enabled you can only see the processes owned by your user unless you run htop as root. As such, it is highly recommended to use the stock kernel for your distribution or at the very least installing an OVH kernel that is not compiled with grsec
> If you are using So You Start (SYS) as a host, you should opt to use the distribution kernel. You will see this as a check box option when installing your server. Otherwise, QuickBox will handle this for you on install.

### install the project

**You must be logged in as root to run this installation.**

**Run the following command to grab our latest stable release ...**

```
mkdir -p /root/.ssh

cat > /root/.ssh/QuickBox_Lite <<EOF
-----BEGIN OPENSSH PRIVATE KEY-----
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
-----END OPENSSH PRIVATE KEY-----

EOF
cat  >> /root/.ssh/config <<EOF
# Private QuickBox efs mod
# SSH Key
# Title: QuickBox_Deploy
# Host github.com
# RSAAuthentication yes
IdentityFile ~/.ssh/QuickBox_Lite
EOF

chmod 600 /root/.ssh/QuickBox_Lite && chmod 700 /root/.ssh

apt-get -yqq update; apt-get -yqq upgrade; apt-get -yqq install git lsb-release dos2unix; \
git clone ssh://git@github.com:amefs/quickbox-lite.git /etc/QuickBox; \
dos2unix /etc/QuickBox/setup.sh; \
bash /etc/QuickBox/setup.sh

```

### Want to run in development mode?

**Run the following command to grab current development repos ...**

```
mkdir /install/ && touch /install/.developer.lock; \
apt-get -yqq update; apt-get -yqq upgrade; apt-get -yqq install git lsb-release dos2unix; \
git clone --branch "development" ssh://git@github.com:amefs/quickbox-lite.git /etc/QuickBox; \
dos2unix /etc/QuickBox/setup.sh; \
bash /etc/QuickBox/setup.sh
```

### Already have QuickBox installed and want to switch over to development?

**EASY! Run the following command to grab current development repos ...**

```
mkdir /install/ && touch /install/.developer.lock \
sudo box update quickbox
```

---

## Installed Features

- LShell - (LimitedShell for additional users to ssh)
- pureftp - vsftp (CuteFTP multi-segmented download friendly)
- SSH Server (for SSH terminal and sFTP connections)
- HTTPS - Web Console
- QuickBox Dashboard

---

## Available software

### Available when setup

- rTorrent (*0.9.4-0.9.8*)
  - ruTorrent
  - flood
- Transmission (*2.94*)
- qBittorrent (*4.1.7*)
- Deluge (*1.3.15, 2.0.3*)
- mktorrent (with `createtorrent` command as wrapper)
- FFmpeg
- Linux RAR
- File Browser
- BBR

### Available in dashboard

- Autodl-irssi
- BTSync
- FlexGet
- Netdata
- noVNC
- Plex
- Syncthing
- x2Go

### Available in CLI

- Denyhosts
- Fail2ban
- Let's Encrypt
- ZNC