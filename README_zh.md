

![QB-lite](https://i.loli.net/2019/09/16/nqx5mwdDVW3lY6a.png)

# QuickBox-Lite

[![Project](https://img.shields.io/badge/Project-English%20Ver-green?logo=git&style=for-the-badge)](https://github.com/amefs/quickbox-lite/blob/master/README.md)    [![DOC](https://img.shields.io/badge/Doc-点击此处阅读文档-1F8ACB?logo=read-the-docs&style=for-the-badge)](https://wiki.ptbox.dev/)

---

该项目是 QuickBox 社区版的 mod. 主要目的是创建一个轻量级的 QuickBox 套件。大部分 QuickBox 社区版的功能都将被保留，但是只有最为常用的第三方软件会被加入这个项目。同时这个项目会提供一些预编译的 BT 客户端来减少安装时间，同时降低对 CPU 的要求。大多数的软件会以模块的形式存在，QuickBox 面板不再依赖 ruTorrent，可以自由选择各种客户端，这也是该项目称为 Lite 的原因。

---

## 主要特性

1. 图形化的安装界面 (目前支持中英双语)
2. 使用 Nginx 替代 Apache
3. 模块化安装
4. 支持最新的 Debian 系系统
5. 最新的软件支持 (包含预编译的 deb 安装包)

---

## 当前版本

![Version](https://img.shields.io/badge/version-1.5.5-orange?style=flat-square)![GNU v3.0 License](https://img.shields.io/badge/license-GNU%20v3.0%20License-blue.svg?style=flat-square)

在执行 1.3.2 -> 1.3.3 的升级时，建议使用 SSH 运行  `box update quickbox` 进行升级操作，且需要执行两次以完成后台服务升级。若使用 WebUI 也需要执行两次。

从 1.3.6 版本开始，php 的默认版本已经升级为 7.4， 因此若你不再需要 php7.2 则可以运行 `sudo apt purge php7.2*` 来删除。

---

## 如何安装

### 安装须知

硬件需求:

- CPU: 至少能够兼容 64 bit 
- 内存: 大于 1GB (推荐使用更多内存)
- 硬盘: 20GB HDD 

系统支持 (仅支持 amd64):

![Ubuntu22.04](https://img.shields.io/badge/Ubuntu%2022.04-passing-brightgreen.svg?style=flat-square)![Ubuntu20.04](https://img.shields.io/badge/Ubuntu%2020.04-passing-brightgreen.svg?style=flat-square)![Ubuntu18.04](https://img.shields.io/badge/Ubuntu%2018.04-passing-brightgreen.svg?style=flat-square)![Ubuntu16.04](https://img.shields.io/badge/Ubuntu%2016.04-EOL-red.svg?style=flat-square)

![Debian11](https://img.shields.io/badge/Debian%2011-passing-brightgreen.svg?style=flat-square)![Debian10](https://img.shields.io/badge/Debian%2010-passing-brightgreen.svg?style=flat-square)![Debian9](https://img.shields.io/badge/Debian%209-discontinue-orange.svg?style=flat-square)

服务器支持:

- Bare-metal server（裸金属服务器）
- Dedicated server （独立服务器）
- 使用 KVM/Xen/VMware 等虚拟技术的 VPS (OpenVZ 不受支持)

**注意 OVH 默认内核**

> grsec 是一个 OVH 自定义内核中带有的模块，它会造成面板无法读取部分进程数据，因此强烈推荐使用一个 mainline 默认内核，或者是不带有 grsec 模块的内核。如果你使用 So You Start (SYS) 主机，则安装时选择 distribution kernel 即可解决该问题。否则 QuickBox 需要在安装时替换内核。

### 安装项目

**你需要首先以 root 身份登录**

#### **使用一键安装模式**

从 **1.3.3** 版本开始，可以使用一键安装:

```bash
bash <(wget -qO- https://git.io/qbox-lite -o /dev/null) COMMAND
```

**如何直接安装开发者模式?**

```bash
bash <(wget -qO- https://git.io/qbox-lite -o /dev/null) --dev COMMAND
```

目前可以使用以下参数:

```
QuickBox Lite Setup Script

使用方法: bash setup.sh -u username -p password [OPTS]

选项:
  NOTE: * is required anyway

  -d, --domain <domain>            为服务器设置以 Let's Encrypt 保护的域名
  -H, --hostname <hostname>        为服务器设置 Hostname，默认不修改
  -P, --port <1-65535>             为 SSH 服务设置端口，默认修改为 4747
  -u, --username <username*>       用户名（必要）
  -p, --password <password*>       密码（必要）
  -r, --reboot                     在安装完成后是否直接重启（默认否）
  -s, --source <us|au|cn|fr|de|jp|ru|uk|tuna>  
                                   选择一个下载源（默认不修改）
  -t, --theme <defaulted|smoked>   为仪表盘选择一个主题（默认 smoked）
  --tz,--timezone <timezone>       为服务器设置时区 (e.g. GMT-8 or Europe/Berlin)
  
  --lang <en|zh>                   选择 TUI 使用的语言（默认英语）
  --with-log,no-log                是否将安装日志写入文件（默认是）
  --with-ftp,--no-ftp              是否安装 FTP（默认是）
  --ftp-ip <ip address>            手动设置 FTP IP
  --with-bbr,--no-bbr              是否安装 BBR（默认否）
  --with-cf                        使用 cloudflare 替代 github
  --with-sf                        使用 sourceforge 替代 github
  --with-osdn                      使用 osdn(jp) 替代 github
  --with-github                    使用 github
  --with-APPNAME                   安装一个 app
  --qbittorrent-version            指定 qBittorrent 版本
  --deluge-version                 指定 Deluge 版本
  --qbit-libt-version              指定用于 qBittorrent 的 Libtorrent 版本
  --de-libt-version                指定用于 Deluge 的 Libtorrent 版本
  --rtorrent-version               指定 rTorrent 版本

    可选的 APP:
    rtorrent | rutorrent | flood | transmission | qbittorrent
    deluge | mktorrent | ffmpeg | filebrowser | linuxrar

  -h, --help                       显示该帮助文档并退出
```

用户名和密码是必须填写的参数，否则仍然会启动 TUI 安装界面。其他可选参数的功能与 TUI 安装界面相同。下面是一个使用示例：

```bash
bash <(wget -qO- https://git.io/qbox-lite -o /dev/null) -u demouser -p demo123456 --with-ffmpeg -P 1234 --with-bbr --with-deluge --with-mktorrent --with-linuxrar --with-cf --hostname vmserver --reboot
```

这段代码的意思是: 用户名为 demouser，密码为 demo123456，ssh 端口修改为1234，安装 BBR，deluge，mktorrent，linuxrar，使用 Cloudflare 的预编译包镜像源，hostname 修改为 vmserver，安装完成后自动重启。
## 对 QuickBox Lite 有疑问

如果你对 QuickBox Lite 的功能仍然有疑问或者需要汇报 Bug，请务必先阅读 [Wiki](https://wiki.ptbox.dev)。如果 Wiki 描述仍然不能解决你的疑惑，请尝试在 [issue](https://github.com/amefs/quickbox-lite/issues/new) 中提交你的问题，我会尽力解决这些问题。
