## CHANGELOG v1.3.5:

*Changelog update Saturday, Jun 13, 2020*

### General additions

* add autoremove-torrents (According to [feature request](https://github.com/amefs/quickbox-lite/issues/27))
* add pyenv

### Function improved

- now use pyenv instead of system wide python to install FlexGet
- add notice in FlexGet install output

### Function updated

* update FlexGet reversed proxy URL
* FlexGet now use the Latest version by default

### Bug fixed

* fix typo

---

## 

## CHANGELOG v1.3.4:

*Changelog update Saturday, May 02, 2020*

### General additions

* add File Browser Enhanced

### Function improved

- add CDN selection in TUI install method
- Remember CDN selection
- Fetching package information of pre-compiled deb package, so all packages will be able to use once upload to host

### Function updated

* add setting template for BT client

### Bug fixed

* fix disk widget problem
* fix username check

---

## CHANGELOG v1.3.3:

*Changelog update Friday, Apr 10, 2020*

### General additions

* Now support qBittorrent 4.2.2 and 4.2.3
* Add One-key install mode
* Add quickbox background service
* linuxrar upgrade to 5.9.0

### Function improved

- Add Cloudflare and OSDN mirror for deb package
- Improve help information for box command
- Remove low efficiency css animation

### Function updated

* update box upgrade command

### Bug fixed

---

## CHANGELOG v1.3.2:

*Changelog update Sunday, Mar 22, 2020*

### General additions

* Now support libtorrent-rasterbar 1.1.14
* Add average traffic status in dashboard

### Function improved

- Add packages for noVNC installation for capability

### Function updated

* Now use filebrowser 2.0.16 instead of 2.1
* Use setuptools 45.3.0 for FlexGet installation
* Removed primary mount point selection in setup
* Add multi-mount point support in disk monitor widget on dashboard

### Bug fixed

- Fix configuration for qBittorrent 4.2.x
- Fix change password for qBittorrent
- Fix username error in Syncthing installation script
- Fix conflict when fail2ban against python3.7 on Stretch

---

## CHANGELOG v1.3.1:

*Changelog update Sunday, Feb 16, 2020*

### General additions

### Function improved

- Disable caching log display
- Enhance security, and it needs to **execute updating script twice** to apply changes
- Add more status into logfile for debugging

### Function updated

### Bug fixed

- Fix configuration for qBittorrent 4.2.x

---

## CHANGELOG v1.3.0:

*Changelog update Sunday, Jan 12, 2020*

### General additions

- add FlexGet upgrade
- support qBittorrent downgrade

### Function improved

- Improve size format display

### Function updated

- install qBittorrent 4.2.1 by default
- now support qBittorrent 4.2.1 and FlexGet 3
- Remove useless lib code
- Remove quota

### Bug fixed

- Fix localize.php generator
- mktorrent Wrapper

---

## CHANGELOG v1.2.0:

*Changelog update Friday, Nov 1, 2019*

### General additions

- add FlexGet template

### Function improved

- reformat all bash scripts
- Rewrite mount point scan function
- use HTTPS to protect download url
- clean cache after upgrade ruTorrent
- auto fill BT clients' authorization info and port info in FlexGet config

### Function updated

- install qBittorrent 4.1.8 by default
- now support qBittorrent 4.1.9.1

### Bug fixed

- Apache autoremove

---

## CHANGELOG v1.1.0:

*Changelog update Wednesday, Oct 2, 2019*

### General additions

- Add Template for FlexGet
- Add qBittorrent updater
- Add new IO benchmark
- Add home permission fix script
- Add mount point switcher

### Function improved

- Merge patches from tautcony
	- Improve status update in dashboard
	- Improve mobile compatibility

### Function updated

- QuickBox Lite CLI Tools are update to date
- Support qBittorrent 4.1.8 (Install via `box install qbittorrent --qb 4.1.8`)

### Bug fixed

- noVNC uninstaller auto remove list
- rTorrent updater waiting for confirm

---

## CHANGELOG v1.0.0:

*Changelog update Friday, Sep 20, 2019*

### General additions

- Porting most of the functions in QuickBox Community Edition
- add following software:
  - Netdata
  - noVNC
  - Denyhosts
  - Fail2ban
  - Flood

### Function improved

- Rewrite `box` command
- Simplify information on dashboard

### Function updated

- Nothing

### Bug fixed

- Nothing

---