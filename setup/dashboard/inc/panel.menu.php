<?php
    require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.lang.php');
    require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.theme.php');
    require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.bw_page.php');
    require_once($_SERVER['DOCUMENT_ROOT'].'/inc/config.php');

    assert(isset($languages));
    assert(isset($themes));
    assert(isset($bw_pages));
    assert(isset($username));
    assert(isset($is_master));
    assert(isset($version));
    assert(isset($plugins));
    assert(isset($rutorrentURL));
    assert(isset($floodURL));
    assert(isset($dwURL));
    assert(isset($transmissionURL));
    assert(isset($qbittorrentURL));
    assert(isset($btsyncURL));
    assert(isset($filebrowserURL));
    assert(isset($filebrowsereeURL));
    assert(isset($flexgetURL));
    assert(isset($netdataURL));
    assert(isset($novncURL));
    assert(isset($plexURL));
    assert(isset($speedtestURL));
    assert(isset($syncthingURL));
    assert(isset($zncURL));
    assert(isset($rtorrentdlURL));
    assert(isset($delugedlURL));
    assert(isset($transmissiondlURL));
    assert(isset($qbittorrentdlURL));
    assert(isset($openvpndlURL));
?>
<body class="body">
<header>
  <div class="headerpanel">
    <div class="logopanel">
      <h2><?php require('db/branding-l.php'); ?></h2>
    </div><!-- logopanel -->
    <div class="headerbar">
      <a id="menuToggle" class="menutoggle"><i class="fa fa-bars"></i></a>
      <div class="header-right">
        <ul class="headermenu">
          <?php if (file_exists('/install/.developer.lock')) { ?>
          <li>
            <div class="btn-group">
              <button type="button" class="btn btn-logged">
                <a href="#" class="label label-warning" style="">You are on the QuickBox Development Repo</a>
              </button>
            </div>
          </li>
          <?php } ?>
          <?php if ($is_master) { ?>
          <li>
            <div id="noticePanel" class="btn-group">
              <button class="btn" data-toggle="dropdown">
                <i class="fa fa-menu"></i> QuickBox Lite Menu <span class="caret"></span>
              </button>
              <div id="noticeDropdown" class="dropdown-menu dm-notice pull-right">
                <div role="tabpanel">
                  <!-- Nav tabs -->
                  <ul class="nav nav-tabs nav-justified" role="tablist">
                    <li class="active"><a data-target="#quickplus" data-toggle="tab">QuickBox+</a></li>
                    <!--li><a data-target="#chat" data-toggle="tab">Chat</a></li-->
                    <li><a data-target="#dashadjust" data-toggle="tab">Dashboard</a></li>
                  </ul>

                  <!-- Tab panes -->
                  <div class="tab-content">
                    <div role="tabpanel" class="tab-pane active" id="quickplus">
                      <ul class="list-group">
                        <li class="list-group-item">
                          <div class="row">
                            <div class="col-xs-12">
                              <h5>QuickBox :: <span style="color: #fff;text-shadow: 0px 0px 6px #fff;"><?php echo "{$version}"; ?></span></h5>
                              <!-- Changelog and ReadME Link -->
                              <small><a href="https://github.com/amefs/quickbox-lite/blob/master/README.md" target="_blank">README.md</a></small>
                              <small><a href="https://github.com/amefs/quickbox-lite/blob/master/CHANGELOG.md#changelog-<?php echo $version; ?>" target="_blank">CHANGELOG</a></small>
                            </div>
                          </div>
                        </li>

                      </ul>
                      <!--a class="btn-more" href="">View More QuickBox <i class="fa fa-long-arrow-right"></i></a-->
                    </div><!-- tab-pane -->

                    <div role="tabpanel" class="tab-pane" id="dashadjust">
                      <ul class="list-group">
                        <li class="list-group-item">
                          <div class="row">
                            <div class="col-xs-12">
                              <div class="col-xs-12 col-md-6" style="padding: 0">
                                <h5><?php echo T('LANG_SELECT'); ?></h5>
                                <?php foreach ($languages as $lang) { ?>
                                  <small><div onclick="boxHandler(event)" data-package="<?php echo $lang['file']; ?>" data-operation="lang" style="cursor: pointer;"><img class="lang-flag lazyload" data-src="lang/flag_<?php echo $lang['file']; ?>.png" /><?php echo $lang['title']; ?></div></small>
                                <?php } ?>
                              </div>
                              <div class="col-xs-12 col-md-6" style="padding: 0">
                                <h5><?php echo T('THEME_SELECT'); ?></h5>
                                <?php foreach ($themes as $theme) { ?>
                                  <small><div data-toggle="modal" data-target="#themeSelect<?php echo $theme['file']; ?>Confirm" style="cursor: pointer;"><img class="lang-flag lazyload" data-src="img/themes/opt_<?php echo $theme['file']; ?>.png" /><?php echo $theme['title']; ?></div></small>
                                <?php } ?>
                              </div>
                              <div class="col-xs-12 col-md-6" style="padding: 0">
                                <h5><?php echo T('BW_SELECT'); ?></h5>
                                <?php foreach ($bw_pages as $page) { ?>
                                  <small><div onclick="localStorage.setItem('bw_tables:page', '<?php echo $page['key']; ?>')" style="cursor: pointer;"><?php echo T($page['title']); ?></div></small>
                                <?php } ?>
                              </div>
                            </div>
                          </div>
                        </li>
                      </ul>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </li>
          <?php } ?>
          <li>
            <div class="btn-group">
              <button type="button" class="btn btn-logged" data-toggle="dropdown">
                <?php echo "{$username}"; ?>
                <span class="caret"></span>
              </button>
              <?php require($_SERVER['DOCUMENT_ROOT'].'/db/branding-m.php'); ?>
            </div>
          </li>
        </ul>
      </div><!-- header-right -->
    </div><!-- headerbar -->
  </div><!-- header-->
</header>
<section>
  <div class="leftpanel ps-container">
    <div class="leftpanelinner">
      <ul class="nav nav-tabs nav-justified nav-sidebar">
        <li class="tooltips active" data-toggle="tooltip" title="<?php echo T('MAIN_MENU'); ?>" data-placement="bottom"><a data-toggle="tab" data-target="#mainmenu"><i class="tooltips fa fa-ellipsis-h"></i></a></li>
        <?php if (($is_master) && file_exists('/install/.rutorrent.lock')) { ?>
          <li class="tooltips" data-toggle="tooltip" title="<?php echo T('RPLUGIN_MENU'); ?>" data-placement="bottom"><a data-toggle="tab" data-target="#plugins"><i class="tooltips fa fa-puzzle-piece"></i></a></li>
        <?php } ?>
        <li class="tooltips" data-toggle="tooltip" title="<?php echo T('HELP_COMMANDS'); ?>" data-placement="bottom"><a data-toggle="tab" data-target="#help"><i class="tooltips fa fa-question-circle"></i></a></li>
      </ul>
      <div class="tab-content">
        <!-- ################# MAIN MENU ################### -->
        <div class="tab-pane active" id="mainmenu">
          <h5 class="sidebar-title"><?php echo T('MAIN_MENU'); ?></h5>
          <ul class="nav nav-pills nav-stacked nav-quirk">
            <!--li class="active"><a href="index.php"><i class="fa fa-home"></i> <span>Dashboard</span></a></li-->
            <!-- // RUTORRENT // -->
            <?php if (processExists('rtorrent', $username) && file_exists('/install/.rutorrent.lock')) { ?>
              <li><a class="grayscale" href="<?php echo "{$rutorrentURL}"; ?>" target="_blank"><img data-src="img/brands/rtorrent.png" class="brand-ico lazyload"> <span>ruTorrent</span></a></li>
            <?php } ?>
            <!-- // FLOOD // -->
            <?php if (processExists('flood', $username) && file_exists('/install/.flood.lock')) { ?>
              <li><a class="grayscale" href="<?php echo "{$floodURL}"; ?>" target="_blank"><img data-src="img/brands/flood.png" class="brand-ico lazyload"> <span>Flood</span></a></li>
            <?php } ?>
            <!-- // DELUGE-WEB // -->
            <?php if (processExists('deluge-web', $username) && file_exists('/install/.deluge.lock')) { ?>
              <li><a class="grayscale" href="<?php echo "{$dwURL}"; ?>" target="_blank"><img data-src="img/brands/deluge.png" class="brand-ico lazyload"> <span>Deluge Web</span></a></li>
            <?php } ?>
            <!-- // TRANSMISSION // -->
            <?php if (processExists('transmission-daemon', $username) && file_exists('/install/.transmission.lock')) { ?>
              <li><a href="<?php echo "{$transmissionURL}"; ?>" class="grayscale" target="_blank"><img data-src="img/brands/transmission.png" class="brand-ico lazyload"> <span>Transmission Web Control</span></a></li>
            <?php } ?>
			      <!-- // QBITTORRENT // -->
            <?php if (processExists('qbittorrent-nox', $username) && file_exists('/install/.qbittorrent.lock')) { ?>
              <li><a href="<?php echo "{$qbittorrentURL}"; ?>" class="grayscale" target="_blank"><img data-src="img/brands/qbittorrent.png" class="brand-ico lazyload"> <span>qBittorrent</span></a></li>
            <?php } ?>
            <?php if ($is_master) { ?>
              <?php if (processExists('rslsync', $username) && file_exists('/install/.btsync.lock')) { ?>
                <li><a class="grayscale" href="<?php echo "{$btsyncURL}"; ?>" target="_blank"><img data-src="img/brands/btsync.png" class="brand-ico lazyload"> <span>BTSync</span></a></li>
              <?php } ?>
              <?php if (processExists('filebrowser', $username) && file_exists('/install/.filebrowser.lock')) { ?>
                <li><a href="<?php echo "{$filebrowserURL}"; ?>" class="grayscale" target="_blank"><img data-src="img/brands/filebrowser.png" class="brand-ico lazyload"> <span>File Browser</span></a></li>
              <?php } ?>
              <?php if (processExists('filebrowser-ee', $username) && file_exists('/install/.filebrowser-ee.lock')) { ?>
                <li><a href="<?php echo "{$filebrowsereeURL}"; ?>" class="grayscale" target="_blank"><img data-src="img/brands/filebrowser.png" class="brand-ico lazyload"> <span>File Browser Enhanced</span></a></li>
              <?php } ?>
              <?php if (processExists('flexget', $username) && file_exists("/install/.{$username}.flexget.lock")) { ?>
                <li><a href="<?php echo "{$flexgetURL}"; ?>" class="grayscale" target="_blank"><img data-src="img/brands/flexget.png" class="brand-ico lazyload"> <span>FlexGet</span></a></li>
              <?php } ?>
              <?php if (processExists('netdata', 'netdata') && file_exists('/install/.netdata.lock')) { ?>
                <li><a href="<?php echo "{$netdataURL}"; ?>" class="grayscale" target="_blank"><img data-src="img/brands/netdata.png" class="brand-ico lazyload"> <span>NetData</span></a></li>
              <?php } ?>
              <?php if (processExists('Xtightvnc', $username) && file_exists('/install/.novnc.lock')) { ?>
                <li><a href="<?php echo "{$novncURL}"; ?>" class="grayscale" target="_blank"><img data-src="img/brands/novnc.png" class="brand-ico lazyload"> <span>noVNC</span></a></li>
              <?php } ?>
              <?php if (file_exists('/install/.plex.lock')) { ?>
                <li><a class="grayscale" href="<?php echo "{$plexURL}"; ?>" target="_blank"><img data-src="img/brands/plex.png" class="brand-ico lazyload"> <span>Plex</span></a></li>
              <?php } ?>
              <?php if (file_exists('/install/.speedtest.lock')) { ?>
                <li><a class="grayscale" href="<?php echo "{$speedtestURL}"; ?>" target="_blank"><img data-src="img/brands/speedtest.png" class="brand-ico lazyload"> <span>SpeedTest</span></a></li>
              <?php } ?>
              <?php if (file_exists('/install/.syncthing.lock')) { ?>
                <li><a class="grayscale" href="<?php echo "{$syncthingURL}"; ?>" target="_blank"><img data-src="img/brands/syncthing.png" class="brand-ico lazyload"> <span>Syncthing</span></a></li>
              <?php } ?>
              <?php if (file_exists('/install/.znc.lock')) { ?>
                <li><a class="grayscale" href="<?php echo "{$zncURL}"; ?>" target="_blank"><img data-src="img/brands/znc.png" class="brand-ico lazyload"> <span>ZNC</span></a></li>
              <?php } ?>
            <?php } ?>
            <?php if (file_exists('/install/.rtorrent.lock') || file_exists('/install/.deluge.lock') || file_exists('/install/.transmission.lock') || file_exists('/install/.qbittorrent.lock') || file_exists('/home/'.$username.'/openvpn/'.$username.'.zip')) { ?>
              <li class="nav-parent">
                <a href=""><i class="fa fa-download"></i> <span><?php echo T('DOWNLOADS'); ?></span></a>
                <ul class="children">
                  <?php if (file_exists('/install/.rtorrent.lock')) { ?>
                    <li><a href="<?php echo "{$rtorrentdlURL}"; ?>" target="_blank">rTorrent</a></li>
                  <?php } ?>
                  <?php if (file_exists('/install/.deluge.lock')) { ?>
                    <li><a href="<?php echo "{$delugedlURL}"; ?>" target="_blank">Deluge</a></li>
                  <?php } ?>
                  <?php if (file_exists('/install/.transmission.lock')) { ?>
                    <li><a href="<?php echo "{$transmissiondlURL}"; ?>" target="_blank">Transmission</a></li>
                  <?php } ?>
                  <?php if (file_exists('/install/.qbittorrent.lock')) { ?>
                    <li><a href="<?php echo "{$qbittorrentdlURL}"; ?>" target="_blank">qBittorrent</a></li>
                  <?php } ?>
                  <?php if (file_exists("/home/{$username}/openvpn/{$username}.zip")) { ?>
                    <li><a href="<?php echo "{$openvpndlURL}"; ?>" target="_blank">OpenVPN Config</a></li>
                  <?php } ?>
                </ul>
              </li>
            <?php } ?>
            <?php if ($is_master && processExists('shellinabox', 'shellinabox')) { ?>
            <li><a href="/<?php echo $username; ?>.console" target="_blank"><i class="fa fa-keyboard-o"></i> <span><?php echo T('WEB_CONSOLE'); ?></span></a></li>
            <?php } ?>
            <!-- /// BEGIN INSERT CUSTOM MENU /// -->
            <?php
              if (file_exists($_SERVER['DOCUMENT_ROOT'].'/custom/custom.menu.php')) {
                  include($_SERVER['DOCUMENT_ROOT'].'/custom/custom.menu.php');
              }
            ?>
            <!-- /// END INSERT CUSTOM MENU /// -->
          </ul>
        </div><!-- tab pane -->

        <!-- ######################## HELP MENU TAB ##################### -->
        <div class="tab-pane" id="help">
          <?php if ($is_master) { ?>
          <h5 class="sidebar-title"><?php echo T('QUICK_SYSTEM_TIPS'); ?></h5>
          <ul class="nav nav-pills nav-stacked nav-quirk nav-mail">
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box update quickbox</span><br/>
              <small><?php echo T('SYS_UPGRADE_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box lang COUNTRYCODE</span><br/>
              <small><?php echo T('SET_LANG_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box set interface</span><br/>
              <small><?php echo T('CHANGEINTERFACE_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box clean mem</span><br/>
              <small><?php echo T('CLEAN_MEM_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box clean log</span><br/>
              <small><?php echo T('CLEAN_LOG_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box iotest</span><br/>
              <small><?php echo T('DISKTEST_TXT'); ?></small>
            </li>
          </ul>
          <h5 class="sidebar-title"><?php echo T('SEEDBOX_COMMANDS'); ?></h5>
          <ul class="nav nav-pills nav-stacked nav-quirk nav-mail">
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box install APPNAME</span><br/>
              <small><?php echo T('APP_INSTALL_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box remove APPNAME</span><br/>
              <small><?php echo T('APP_UNINSTALL_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box update APPNAME</span><br/>
              <small><?php echo T('APP_UPGRADE_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box set password</span><br/>
              <small><?php echo T('CHANGEUSERPASS_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box fix dpkg</span><br/>
              <small><?php echo T('FIX_DPKG_TXT'); ?></small>
            </li>
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">box troubleshoot</span><br/>
              <small><?php echo T('TROUBLESHOOT_TXT'); ?></small>
            </li>
          </ul>
          <?php } ?>
          <h5 class="sidebar-title"><?php echo T('ESSENTIAL_USER_COMMANDS'); ?></h5>
          <ul class="nav nav-pills nav-stacked nav-quirk nav-mail">
            <li style="padding: 7px"><span style="font-size: 12px; color:#eee">systemctl restart rtorrent@<?php echo $username; ?>.service</span><br/>
            <small><?php echo T('SCREEN_RTORRNENT_TXT'); ?></small></li>
          </ul>
        </div><!-- tab-pane -->

        <!-- ######################## RUTORRENT PLUGINS TAB ##################### -->
        <div class="tab-pane" id="plugins">
          <h5 class="sidebar-title"><?php echo T('PLUGIN_MENU'); ?></h5>
          <ul class="nav nav-pills nav-stacked nav-quirk">
            <li class="nav-parent nav-active">
              <a href=""><i class="fa fa-puzzle-piece"></i> <span><?php echo T('PLUGINS'); ?></span></a>
              <ul class="children">
                <li class="info-quote"><p class="info-quote"><?php echo T('PMENU_NOTICE_TXT'); ?></p></li>
                <?php foreach ($plugins as $plugin) {
                $installed = file_exists("/srv/rutorrent/plugins/{$plugin}/plugin.info");
                $action    = $installed ? "?removeplugin-{$plugin}=true" : "?installplugin-{$plugin}=true"; ?>
                <li>
                  <a href="javascript:void(0)"><?php echo $plugin; ?></a>
                  <div class="toggle-wrapper pull-right" style="margin-right: -10px; margin-top: 5px;">
                  <?php if ($installed) { ?>
                    <div class="toggle-pen toggle-modern" onclick="location.href='<?php echo $action; ?>'">
                  <?php } else { ?>
                    <div class="toggle-pdis toggle-modern" onclick="location.href='<?php echo $action; ?>'">
                  <?php } ?>
                    </div>
                  </div>
                </li>
                <?php
            } ?>
              </ul>
            </li>
          </ul>
        </div><!-- tab-pane -->

      </div><!-- tab-content -->
    </div><!-- leftpanelinner -->
  </div><!-- leftpanel -->
