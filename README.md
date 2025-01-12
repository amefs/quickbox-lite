

![QB-lite](https://i.loli.net/2019/09/16/nqx5mwdDVW3lY6a.png)

# Project QuickBox-Lite

[![Project](https://img.shields.io/badge/Project-中文版-green?logo=git&style=for-the-badge)](https://github.com/amefs/quickbox-lite/blob/master/README_zh.md)    [![DOC](https://img.shields.io/badge/Doc-Read%20Manual%20here-1F8ACB?logo=read-the-docs&style=for-the-badge)](https://wiki.ptbox.dev/)

---

This project is a modified version of the QuickBox community edition. This project aims to build a lightweight QuickBox software kit. Most of the functions of QuickBox CE are retained, but only the most commonly used stable third party software included. The prebuilt BT client also available here, which can significantly reduce the installation time as well as CPU requirement to compile them. Most of the software is available as modules. The panel no longer needs the support of ruTorrent. You can select what you need, and this is also why the project named "Lite".

---

## Main feature

1. Graphical installation guide (Multi-language available)
2. Use Nginx instead of apache
3. Modular installation
4. Latest OS support
5. up to date apps (prebuild deb packages included)

---

## Script status

![Version](https://img.shields.io/badge/version-1.5.11-orange?style=flat-square)![GNU v3.0 License](https://img.shields.io/badge/license-GNU%20v3.0%20License-blue.svg?style=flat-square)

When upgrade from 1.3.2 to 1.3.3, very recommend to use SSH with `box update quickbox`. You also need to run the command twice to finish the service upgrade. If you are using WebUI to finish the upgrade, please also upgrade twice.

From version 1.3.6, the php version has upgraded to 7.4, so you can remove old php7.2 with `sudo apt purge php7.2*` when you don't need it anymore.

---

## How to install

### before install

Hardware requirement:

- CPU: At least a 64bit Compatible x86_64 CPU
- RAM: large than 1GB (recommend more for better performance)
- Storage: 20GB HDD (for seeding, you need more)

OS Support (amd64 only):

![Ubuntu24.04](https://img.shields.io/badge/Ubuntu%2024.04-passing-brightgreen.svg?style=flat-square)![Ubuntu22.04](https://img.shields.io/badge/Ubuntu%2022.04-passing-brightgreen.svg?style=flat-square)![Ubuntu20.04](https://img.shields.io/badge/Ubuntu%2020.04-passing-brightgreen.svg?style=flat-square)![Ubuntu18.04](https://img.shields.io/badge/Ubuntu%2018.04-EOL-red.svg?style=flat-square)![Ubuntu16.04](https://img.shields.io/badge/Ubuntu%2016.04-EOL-red.svg?style=flat-square)

![Debian12](https://img.shields.io/badge/Debian%2012-passing-brightgreen.svg?style=flat-square)![Debian11](https://img.shields.io/badge/Debian%2011-passing-brightgreen.svg?style=flat-square)![Debian10](https://img.shields.io/badge/Debian%2010-EOL-red.svg?style=flat-square)![Debian9](https://img.shields.io/badge/Debian%209-EOL-red.svg?style=flat-square)

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

#### **One-key Install mode**

One-key install is available since version **1.3.3**:

```bash
bash <(wget -qO- https://git.io/qbox-lite -o /dev/null) COMMAND
```

**Want to run in development mode?:**

```bash
bash <(wget -qO- https://git.io/qbox-lite -o /dev/null) --dev COMMAND
```

Now, it has following arguments:

```
QuickBox Lite Setup Script

Usage: bash setup.sh -u username -p password [OPTS]

Options:
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

  -h, --help                       display this help and exit
```

The username and the password is required anyway, or the TUI install method will start. The other arguments are the same function as in TUI. Here is a example:

```bash
bash <(wget -qO- https://git.io/qbox-lite -o /dev/null) -u demouser -p demo123456 --with-ffmpeg -P 1234 --with-bbr --with-deluge --with-mktorrent --with-linuxrar --with-cf --hostname vmserver --reboot
```

It means: The username being set to demouser, password is demo123456, use 1234 as ssh port, install BBR, deluge, mktorrent, linuxrar. The mirror for deb package in Cloudflare will be used for installation. Change the hostname to vmserver. The server will be automaticly restart after installation.

## Have trouble with QuickBox Lite

If you still have questions about the QuickBox Lite or need to report bugs, be sure to read the [Wiki](https://wiki.ptbox.dev) first. When you still have trouble with it, please assign an issue [here](https://github.com/amefs/quickbox-lite/issues/new), I will try my best to help you.

