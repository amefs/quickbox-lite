<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/config.php');

$username = getMaster();

assert(isset($version));
assert(isset($branch));
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
                              <small><a href="https://github.com/amefs/quickbox-lite/blob/master/README.md" target="_blank" rel="noopenner noreferrer">README.md</a></small>
                              <small><a href="https://github.com/amefs/quickbox-lite/blob/master/CHANGELOG.md#changelog-<?php echo $version; ?>" target="_blank" rel="noopenner noreferrer">CHANGELOG</a></small>
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
                                <div id="node-language-options"></div>
                              </div>
                              <div class="col-xs-12 col-md-6" style="padding: 0">
                                <h5><?php echo T('THEME_SELECT'); ?></h5>
                                <div id="node-theme-options"></div>
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
                                <div id="node-bw-page-options"></div>
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
  <div class="leftpanel ps">
    <div class="leftpanelinner">
      <ul class="nav nav-tabs nav-justified nav-sidebar">
        <li class="tooltips active" data-toggle="tooltip" title="<?php echo T('MAIN_MENU'); ?>" data-placement="bottom"><a data-toggle="tab" data-target="#mainmenu"><i class="tooltips fa fa-ellipsis-h"></i></a></li>
        <li id="node-plugin-tab" class="tooltips" data-toggle="tooltip" title="<?php echo T('RPLUGIN_MENU'); ?>" data-placement="bottom" style="display:none;"><a data-toggle="tab" data-target="#plugins"><i class="tooltips fa fa-puzzle-piece"></i></a></li>
        <li class="tooltips" data-toggle="tooltip" title="<?php echo T('HELP_COMMANDS'); ?>" data-placement="bottom"><a data-toggle="tab" data-target="#help"><i class="tooltips fa fa-question-circle"></i></a></li>
      </ul>
      <div class="tab-content">
        <!-- ################# MAIN MENU ################### -->
        <div class="tab-pane active" id="mainmenu">
          <h5 class="sidebar-title"><?php echo T('MAIN_MENU'); ?></h5>
          <ul class="nav nav-pills nav-stacked nav-quirk">
            <li id="node-menu-loading" style="padding: 7px;"><?php echo T('REFRESH'); ?>...</li>
            <li id="node-menu-anchor" style="display:none;"></li>
            <!-- /// BEGIN INSERT CUSTOM MENU /// -->
            <?php
                  if (file_exists($_SERVER['DOCUMENT_ROOT'].'/custom/custom.menu.php')) {
                      include($_SERVER['DOCUMENT_ROOT'].'/custom/custom.menu.php');
                  }
?>
            <!-- /// END INSERT CUSTOM MENU /// -->
          </ul>
        </div><!-- tab pane -->

        <script>
          (function () {
            var labels = {
              bwPages: {
                t: <?php echo json_encode(T('Top 10 days')); ?>,
                h: <?php echo json_encode(T('Recent hours')); ?>,
                d: <?php echo json_encode(T('Last 30 days')); ?>,
                m: <?php echo json_encode(T('Last 12 months')); ?>
              }
            };

            function appendSmallOption(container, element) {
              if (!container) {
                return;
              }
              var wrapper = document.createElement('small');
              wrapper.appendChild(element);
              container.appendChild(wrapper);
            }

            function renderDashboardConfig(payload) {
              var langContainer = document.getElementById('node-language-options');
              var themeContainer = document.getElementById('node-theme-options');
              var bwContainer = document.getElementById('node-bw-page-options');

              if (langContainer && Array.isArray(payload.languages)) {
                langContainer.innerHTML = '';
                payload.languages.forEach(function (lang) {
                  var option = document.createElement('div');
                  option.style.cursor = 'pointer';
                  option.dataset.package = lang.file;
                  option.dataset.operation = 'lang';
                  option.onclick = function (event) { boxHandler(event); };

                  var img = document.createElement('img');
                  img.className = 'lang-flag';
                  img.src = 'lang/flag_' + lang.file + '.png';
                  img.alt = '';
                  img.setAttribute('aria-hidden', 'true');
                  option.appendChild(img);
                  option.appendChild(document.createTextNode(lang.title));
                  appendSmallOption(langContainer, option);
                });
              }

              if (themeContainer && Array.isArray(payload.themes)) {
                themeContainer.innerHTML = '';
                payload.themes.forEach(function (theme) {
                  var option = document.createElement('div');
                  option.style.cursor = 'pointer';
                  option.setAttribute('data-toggle', 'modal');
                  option.setAttribute('data-target', '#themeSelect' + theme.file + 'Confirm');

                  var img = document.createElement('img');
                  img.className = 'lang-flag';
                  img.src = 'img/themes/opt_' + theme.file + '.png';
                  img.alt = '';
                  img.setAttribute('aria-hidden', 'true');
                  option.appendChild(img);
                  option.appendChild(document.createTextNode(theme.title));
                  appendSmallOption(themeContainer, option);
                });
              }

              if (bwContainer && Array.isArray(payload.bwPages)) {
                bwContainer.innerHTML = '';
                payload.bwPages.forEach(function (page) {
                  var option = document.createElement('div');
                  option.style.cursor = 'pointer';
                  option.onclick = function () {
                    localStorage.setItem('bw_tables:page', page.key);
                    location.reload();
                  };
                  option.textContent = labels.bwPages[page.key] || page.title;
                  appendSmallOption(bwContainer, option);
                });
              }
            }

            fetch('/ws/node/dashboard_config', { credentials: 'same-origin' })
              .then(function (response) {
                if (!response.ok) {
                  throw new Error('Failed to fetch dashboard config');
                }
                return response.json();
              })
              .then(renderDashboardConfig)
              .catch(function (error) {
                console.warn('[ws] failed to load dashboard config', error);
              });

            function applyRutorrentPluginAction(plugin, action) {
              fetch('/ws/node/plugin', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plugin: plugin, action: action })
              })
                .then(function (response) {
                  if (!response.ok) {
                    throw new Error('Failed to apply plugin action');
                  }
                  location.reload();
                })
                .catch(function (error) {
                  console.warn('[ws] failed to apply plugin action', error);
                });
            }

            function renderRutorrentPlugins(payload) {
              var anchor = document.getElementById('node-plugin-options-anchor');
              var loading = document.getElementById('node-plugin-loading');
              if (!anchor || !payload || !Array.isArray(payload.plugins)) {
                return;
              }
              var parent = anchor.parentNode;
              if (!parent) {
                return;
              }
              var oldItems = parent.querySelectorAll('[data-node-plugin-option="true"]');
              oldItems.forEach(function (item) { item.remove(); });
              payload.plugins.forEach(function (plugin) {
                var item = document.createElement('li');
                item.dataset.nodePluginOption = 'true';

                var label = document.createElement('a');
                label.href = '#';
                label.textContent = plugin.name;
                label.onclick = function (event) { event.preventDefault(); };
                item.appendChild(label);

                var wrapper = document.createElement('div');
                wrapper.className = 'toggle-wrapper pull-right';
                wrapper.style.marginRight = '-10px';
                wrapper.style.marginTop = '5px';

                var toggle = document.createElement('div');
                toggle.className = plugin.installed ? 'toggle-pen toggle-modern' : 'toggle-pdis toggle-modern';
                toggle.onclick = function () {
                  applyRutorrentPluginAction(plugin.name, plugin.installed ? 'remove' : 'install');
                };
                wrapper.appendChild(toggle);
                item.appendChild(wrapper);
                parent.insertBefore(item, anchor);
              });
              if (loading) {
                loading.remove();
              }
              initialisePluginToggles(0);
            }

            function initialisePluginToggles(attempt) {
              if (window.jQuery && window.jQuery.fn && window.jQuery.fn.toggles) {
                window.jQuery('.toggle-pen').toggles({
                  on: true,
                  height: 16,
                  width: 90,
                  text: {
                    on: <?php echo json_encode(T('INSTALLED')); ?>,
                    off: <?php echo json_encode(T('UNINSTALLING')); ?>
                  }
                });
                window.jQuery('.toggle-pdis').toggles({
                  on: false,
                  height: 16,
                  width: 90,
                  text: {
                    off: <?php echo json_encode(T('UNINSTALLED')); ?>,
                    on: <?php echo json_encode(T('INSTALLING')); ?>
                  }
                });
                return;
              }
              if (attempt < 20) {
                window.setTimeout(function () {
                  initialisePluginToggles(attempt + 1);
                }, 100);
              }
            }

            fetch('/ws/node/plugins', { credentials: 'same-origin' })
              .then(function (response) {
                if (!response.ok) {
                  throw new Error('Failed to fetch plugin list');
                }
                return response.json();
              })
              .then(renderRutorrentPlugins)
              .catch(function (error) {
                console.warn('[ws] failed to load plugin list', error);
              });

            var anchor = document.getElementById('node-menu-anchor');
            var loading = document.getElementById('node-menu-loading');
            var pluginTab = document.getElementById('node-plugin-tab');
            if (!anchor) {
              return;
            }
            fetch('/ws/node/menu', { credentials: 'same-origin' })
              .then(function (response) {
                if (!response.ok) {
                  throw new Error('Failed to fetch menu fragment');
                }
                return response.json();
              })
              .then(function (payload) {
                if (payload && typeof payload.mainMenuHtml === 'string') {
                  anchor.insertAdjacentHTML('beforebegin', payload.mainMenuHtml);
                }
                if (loading) {
                  loading.remove();
                }
                if (pluginTab) {
                  pluginTab.style.display = payload && payload.showPluginTab ? '' : 'none';
                }
                if (window.jQuery) {
                  window.jQuery('.tooltips').tooltip({ container: 'body' });
                }
              })
              .catch(function (error) {
                console.warn('[ws] failed to load menu fragment', error);
                if (loading) {
                  loading.textContent = 'Menu unavailable';
                }
                if (pluginTab) {
                  pluginTab.style.display = 'none';
                }
              });
          })();
        </script>

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
              <a href="#"><i class="fa fa-puzzle-piece"></i> <span><?php echo T('PLUGINS'); ?></span></a>
              <ul class="children">
                <li class="info-quote"><p class="info-quote"><?php echo T('PMENU_NOTICE_TXT'); ?></p></li>
                <li id="node-plugin-loading" style="padding: 7px;"><?php echo T('REFRESH'); ?>...</li>
                <li id="node-plugin-options-anchor" style="display:none;"></li>
              </ul>
            </li>
          </ul>
        </div><!-- tab-pane -->

      </div><!-- tab-content -->
    </div><!-- leftpanelinner -->
  </div><!-- leftpanel -->
