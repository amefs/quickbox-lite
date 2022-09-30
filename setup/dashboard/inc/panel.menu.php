<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.lang.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.package.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.theme.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.plugin.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.bw_page.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/config.php');

$username = getMaster();

assert(isset($languages));
assert(isset($packageMap));
assert(isset($menuList));
assert(isset($downloadList));
assert(isset($themes));
assert(isset($bw_pages));
assert(isset($version));
assert(isset($branch));
assert(isset($plugins));
?>
<body class="body">
<header>
  <div class="headerpanel">
    <div class="logopanel">
      <h2><?php require($_SERVER['DOCUMENT_ROOT'].'/db/branding-l.php'); ?></h2>
    </div><!-- logopanel -->
    <div class="headerbar">
      <a id="menuToggle" class="menutoggle"><i class="fa fa-bars"></i></a>
      <div class="header-right">
        <ul class="headermenu">
          <?php if (file_exists('/install/.developer.lock')) { ?>
          <li>
            <div class="btn-group">
              <button type="button" class="btn btn-logged">
                <a href="#" class="label label-warning" style=""><?php echo T('DEV_REPO_TXT', ['branch' => $branch]); ?></a>
              </button>
            </div>
          </li>
          <?php } ?>
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
                    <li><a data-target="#configure" data-toggle="tab">Config</a></li>
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
                            </div>
                          </div>
                        </li>
                      </ul>

                    </div><!-- tab-pane -->

                    <div role="tabpanel" class="tab-pane" id="configure">
                      <ul class="list-group">
                        <li class="list-group-item">
                          <div class="row">
                            <div class="col-xs-12">
                              <div class="col-xs-12 col-md-6" style="padding: 0">
                                <h5><?php echo T('BW_SELECT'); ?></h5>
                                <?php foreach ($bw_pages as $page) { ?>
                                  <small><div onclick="localStorage.setItem('bw_tables:page', '<?php echo $page['key']; ?>');location.reload()" style="cursor: pointer;"><?php echo T($page['title']); ?></div></small>
                                <?php } ?>
                              </div>
                              <div class="col-xs-12 col-md-6" style="padding: 0">
                                <h5><?php echo T('PANEL_CONFIG'); ?></h5>
                                  <small><div onclick="resetPanel();location.reload()" style="cursor: pointer;"><?php echo T('PANEL_RESET'); ?></div></small>
                                  <script>
                                    function resetPanel() {
                                      for (let i = 0; i < localStorage.length; i++) {
                                        const key = localStorage.key(i);
                                        if (key.startsWith('lobipanel')) {
                                          localStorage.removeItem(key);
                                        }
                                      }
                                    }
                                  </script>
                              </div>
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div><!-- tab-pane -->
                  </div>
                </div>
              </div>
            </div>
          </li>
          <li>
            <div class="btn-group">
              <button type="button" class="btn btn-logged" data-toggle="dropdown">
                <?php echo $username; ?>
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
        <?php if (is_package_installed($packageMap['rutorrent'])) { ?>
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
            <?php
            foreach ($menuList as $menu) {
                if (!is_package_installed($menu)) {
                    continue;
                } ?>
              <li><a class="grayscale" href="<?php echo $menu['url']; ?>" target="_blank"><img data-src="<?php echo $menu['logo']; ?>" class="brand-ico lazyload"> <span><?php echo $menu['name']; ?></span></a></li>
            <?php
            } ?>
            <?php
            $require_download_menu = false;
foreach ($downloadList as $download) {
    if (is_package_installed($download)) {
        $require_download_menu = true;
        break;
    }
}
?>
            <?php if ($require_download_menu) { ?>
              <li class="nav-parent">
                <a href=""><i class="fa fa-download"></i> <span><?php echo T('DOWNLOADS'); ?></span></a>
                <ul class="children">
                <?php foreach ($downloadList as $download) {
                    if (!is_package_installed($download)) {
                        continue;
                    } ?>
                    <li><a href="<?php echo $download['url']; ?>" target="_blank"><?php echo $download['name']; ?></a></li>
                <?php
                } ?>
                </ul>
              </li>
            <?php } ?>
            <?php if (is_package_running($packageMap['ttyd'])) { ?>
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
