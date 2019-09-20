

![QB-lite](https://i.loli.net/2019/09/16/nqx5mwdDVW3lY6a.png)

# QuickBox-Lite

[English Ver](https://github.com/amefs/quickbox-lite/blob/master/README.md)

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

![Version](https://img.shields.io/badge/version-0.1.0-orange?style=flat-square)![GNU v3.0 License](https://img.shields.io/badge/license-GNU%20v3.0%20License-blue.svg?style=flat-square)

---

## 如何安装

### 安装须知

硬件需求:

- CPU: 至少能够兼容 64 bit 
- 内存: 大于 1GB (推荐使用更多内存)
- 硬盘: 20GB HDD 

系统支持 (仅支持 amd64):

![Ubuntu18.04](https://img.shields.io/badge/Ubuntu%2018.04-passing-brightgreen.svg?style=flat-square)![Ubuntu16.04](https://img.shields.io/badge/Ubuntu%2016.04-passing-brightgreen.svg?style=flat-square)![Debian9](https://img.shields.io/badge/Debian%209-passing-brightgreen.svg?style=flat-square)![Debian10](https://img.shields.io/badge/Debian%2010-passing-brightgreen.svg?style=flat-square)

服务器支持:

- Bare-metal server（裸金属服务器）
- Dedicated server （独立服务器）
- 使用 KVM/Xen/VMware 等虚拟技术的 VPS (OpenVZ 不受支持)

**注意 OVH 默认内核**

> grsec 是一个 OVH 自定义内核中带有的模块，它会造成面板无法读取部分进程数据，因此强烈推荐使用一个 mainline 默认内核，或者是不带有 grsec 模块的内核。如果你使用 So You Start (SYS) 主机，则安装时选择 distribution kernel 即可解决该问题。否则 QuickBox 需要在安装时替换内核。

### 安装项目

**你需要首先以 root 身份登录**

**运行以下指令来抓取最新的代码 ...**

```
mkdir -p /root/.ssh

cat > /root/.ssh/QuickBox_Lite <<EOF
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAgEA3l10kdInhy1NEo5lHk7+pTaL76xKBP186Irq3cqo6PN8sFDuuD6D
MYV7/aIlVTqtqod0pkSGH3OGliRbEYyvnq/e9phKVJAmKFyli37pahVxbwjhldYJortlBh
hp6N/vUVDUaEG4arwwkgF2OaFIskrf0Rt6AqBgsnXOr7HIXgvAe9jaMj6jvt4+p9h1I+1J
855soB/ZEbNpazp9CGr8CAAoy8p2xWwA21iWWo0dfcZzhIt0QavfCZkPLZvZUp4L2oBhIx
MJUogSia0xiV5ZnyWwVs6WByPo+ZQ39WD9tnsFsPgazYN2NdByQB4re6GYlnndq5aO7XbJ
HkEPaqmlfN86sRoH6GZ60bebtDbwMoBvpw9Ixo2q6vKnakZY+G0PJ3q4Di7POeKgHXXeSV
q8gjD/LVbdExF4UP4DFm+M2A2oHuispSKCo6tRn89xrGLKeAxREZBaTsPMoVoYcymwJSIG
pncbpENb12P3HW9BnCICAg5iAdY9xuHhnGaNOF/vqj4mwbaMmiAP/2aGI6RfSgx2w6J+7Y
Vg1uz6uXzdZOP4yxhiuy4I2wvjCGXk2Z32uDW+5lMrXnh9+d7dCxctlk///d+G3L00nW9f
iRxwfSPsw431QFQTsGWNqG1S2kzEX+ahca2a64cwBSVhXlu3CZ0gQSJJH9Jwpk5h8wRAFz
EAAAdIKu4SsyruErMAAAAHc3NoLXJzYQAAAgEA3l10kdInhy1NEo5lHk7+pTaL76xKBP18
6Irq3cqo6PN8sFDuuD6DMYV7/aIlVTqtqod0pkSGH3OGliRbEYyvnq/e9phKVJAmKFyli3
7pahVxbwjhldYJortlBhhp6N/vUVDUaEG4arwwkgF2OaFIskrf0Rt6AqBgsnXOr7HIXgvA
e9jaMj6jvt4+p9h1I+1J855soB/ZEbNpazp9CGr8CAAoy8p2xWwA21iWWo0dfcZzhIt0Qa
vfCZkPLZvZUp4L2oBhIxMJUogSia0xiV5ZnyWwVs6WByPo+ZQ39WD9tnsFsPgazYN2NdBy
QB4re6GYlnndq5aO7XbJHkEPaqmlfN86sRoH6GZ60bebtDbwMoBvpw9Ixo2q6vKnakZY+G
0PJ3q4Di7POeKgHXXeSVq8gjD/LVbdExF4UP4DFm+M2A2oHuispSKCo6tRn89xrGLKeAxR
EZBaTsPMoVoYcymwJSIGpncbpENb12P3HW9BnCICAg5iAdY9xuHhnGaNOF/vqj4mwbaMmi
AP/2aGI6RfSgx2w6J+7YVg1uz6uXzdZOP4yxhiuy4I2wvjCGXk2Z32uDW+5lMrXnh9+d7d
Cxctlk///d+G3L00nW9fiRxwfSPsw431QFQTsGWNqG1S2kzEX+ahca2a64cwBSVhXlu3CZ
0gQSJJH9Jwpk5h8wRAFzEAAAADAQABAAACAGlnES9h11zLC2KFXsccGLaFgZVtLHTrFz8/
Qg851hD+AZet9UoeT5+0r05NgrbAprtTk+aQSqcz4pLeztAlyMVGhkCLdYhZ/8xYBhx2Xv
vrCCbipdOZbl3VyBA4mFNLeqwnzVdR97GYXMmIqdqtacEhnrAG/zGphcxx7TP46Ioztdy+
sMbqTEHYJQj4oKYT/17cNI8+KW2rhofOZKAN3kOIl83pvZzdEhbnCfYIN/d7jxw/4i6S4p
kxFTHAUyZHRkUfX2v5xQx69ZaPIxEDSSYX/ltXd2QREIjlShUlEX5jGBKHuGS8MNdXZCCi
bGgg9Cw3vexs5HkJOlH98unTWl5Q3Kn+PiMd6JzZL/4urRw9dJcvwPNjt4AdoYNGIS/ot5
1O053uruyr8G0tBAoxU6pEXF2aNX7O7W9JEmVnjfEVVGfO9ndDclvLsRx/HRN76MUn+jLr
+dwhQ3KTxBHqSKz4qM9Cw4qUmiNz/9owBe4a3dWXPFZbMJW7376WCVag3X9k+tpOfZN7na
WxKzQPRLy4KwK1RYvB1L4/6WvsjY16LyAts3OC2zVcnBEairxIJfSxosRrJTuRXdm6J5j/
J0xPkmDTclM0mK0lsDLJUs515LSB5t/fZwRcmfMduFIAm4HmAoz9LO2aU3+zabCUb1vaCM
fwTMZxSzTjJJLJg+ZxAAABAFUQ+xYPIm4+G8aU/mQd1XGhqcehc8cr7Xa0znC5AQ3ekimQ
eJuzDG/3mFmuZVX/SXLdvL5q3VSbTtOsdyRwP29C2W6OjaRBWyTylOoOF0MeqoAt7TpuT7
qVVeg7gOUhFq42iwVC9a98sK4AU42UKQkZI64UNPM7aBVDsfWrq7DjeqV5ndpSl/qoQiGD
dSsK/o8Web7iZYkFman7yr3pKCfqKJPJXulfKGz0Nn8li3jpymPI6LzOuDa6pHYiGR30v9
bJdwDvqeWKdtxSVhxhY8cfHnYDu7U1I3F/+o3u3yuycnVGcUyfajvjRgrMVaWaEYjjW51b
SMrdJ/k5p/tbJDkAAAEBAP8HGSnWswCsyKHKJp7lcrbMfSiZ7XMAh+ub72eMhKlNDzPpaH
ht8UWjYAYS5k8dhO+R2A+UMlwcATAMmki1u4BpCH3BFW8vqJ8almv/iCLJPsXoONNbJzly
qWeiCDD/GnjTrxEpSPJIQkNDO6tHgXYnHLwEOMkowr7bHnNyR7nEmQzbYaGrDpG1R0Jcib
dnwnPOkK6AyZYZhHiaNo2KoBqQAyeFgyOV2MuS08o6hZC1sLSrrT8K4P/T2fka6u6eXHXu
MjWVFVx5InZiLg1japhwDoVSty3FXqXwIV21noupw/pT1Vsb/LBpfqdlrlwzI7+RKpK+LE
TAlO4tK1G+lqUAAAEBAN82ep5JNgYKd5iG569WFk2Qw9PxPBIL7zPDLRSKjv42yL27CUZu
HJNaXNOKBwrQi2JaH8hkaxer0SwmPqBdQg2me8ryoUuXnbykiebS8PFpCmUxt3PJkFItb8
hpqet+QoOjrzy4PWbG3EC5TYPL+KFbV1UaVn/1iXgMwmp3JAU9uvtU7I0ZPJEKMBREUwKC
j2Bbs2qXjw/RPTzHdOrgqqH2xEqopjFfb2TIkqFiwjDaLWgtBkALgNIGMJwZd+zDDGesag
UtS/CVn9KJCpVOGBGUb/RXyy5Gky74c1O4fwhdtam6+3sZTzZ9yr43hAH863MQ+Ku0Mtmy
BxajCtespJ0AAAANZWZzQGFtZWZzLm5ldAECAwQFBg==
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

### 如何直接安装开发者模式?

**在抓取源码时使用如下指令 ...**

```
mkdir /install/ && touch /install/.developer.lock; \
apt-get -yqq update; apt-get -yqq upgrade; apt-get -yqq install git lsb-release dos2unix; \
mkdir /install/ && touch /install/.developer.lock \
git clone --branch "development" ssh://git@github.com:amefs/quickbox-lite.git /etc/QuickBox; \
dos2unix /etc/QuickBox/setup.sh; \
bash /etc/QuickBox/setup.sh
```

### 已经安装 QuickBox 希望切换到开发者模式?

**运行如下指令以切换分支 ...**

```
mkdir /install/ && touch /install/.developer.lock \
sudo box update quickbox
```

---

## 默认安装的功能

- LShell - (为用户安装的 Limit Shell)
- pureftp - vsftp (FTP客户端)
- SSH Server
- 默认开启 HTTPS
- QuickBox 面板

---

## 可选的软件

### 安装时可选的软件

- rTorrent (*0.9.4-0.9.8*)
  - ruTorrent
  - flood
- Transmission (*2.94*)
- qBittorrent (*4.1.7*)
- Deluge (*1.3.15, 2.0.3*)
- mktorrent (可以使用 `createtorrent` 在命令行中使用表单快速创建种子)
- FFmpeg
- Linux RAR
- File Browser
- BBR

### 面板中可选的软件

- Autodl-irssi
- BTSync
- FlexGet
- Netdata
- noVNC
- Plex
- Syncthing
- x2Go

### 命令行中可选的软件

- Denyhosts
- Fail2ban
- Let's Encrypt
- ZNC