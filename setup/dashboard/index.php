<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require_once($_SERVER['DOCUMENT_ROOT'].'/inc/config.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');

require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.header.php');
require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.menu.php');

assert(isset($version));
assert(isset($branch));
?>

<div class="mainpanel">
  <!--<div class="pageheader">
    <h2><i class="fa fa-home"></i> Dashboard</h2>
  </div>-->
  <div class="contentpanel">
    <div class="row">
      <div class="col-md-8" data-inner-id="left-panel-container">

        <!--BANDWIDTH CHART & DATA-->
        <div class="panel panel-main panel-inverse" data-inner-id="panel-server-bandwidth-interface">
          <div class="panel-heading">
            <h4 class="panel-title"><?php echo T('BANDWIDTH_DATA'); ?></h4>
          </div>
          <div class="row panel-footer panel-statistics" style="padding:0">
            <div class="col-md-12">
              <div class="table-responsive">
                <table class="table table-hover table-bordered nomargin">
                  <thead>
                    <tr>
                      <th style="width:33%;padding: 4px 4px 4px 12px"><?php echo T('NETWORK'); ?></th>
                      <th style="width:33%;padding: 4px 4px 4px 12px"><?php echo T('UPLOAD'); ?></th>
                      <th style="width:33%;padding: 4px 4px 4px 12px"><?php echo T('DOWNLOAD'); ?></th>
                    </tr>
                  </thead>
                  <tbody id="node-network-interface-rows">
                    <tr>
                      <td colspan="3" style="font-size:11px;padding: 4px 4px 4px 12px"><?php echo T('REFRESH'); ?>...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="panel panel-inverse" data-inner-id="panel-server-bandwidth-details">
          <div class="panel-heading">
            <h4 class="panel-title"><?php echo T('VIEW_ADDITIONAL_BANDWIDTH_DETAILS'); ?></h4>
          </div>
          <div class="panel-body" style="padding:0">
            <div class="row" style="padding: 0; margin: 0"><div id="bw_tables" style="padding:0;margin:0;"></div></div>
          </div>
        </div>

        <div id="service_control_widget">
          <div class="panel panel-inverse" data-inner-id="panel-server-service-control">
            <div class="panel-heading">
              <h4 class="panel-title"><?php echo T('SERVICE_CONTROL_CENTER'); ?></h4>
            </div>
            <div class="panel-body text-center" style="padding: 24px; color: #999;"><?php echo T('REFRESH'); ?>...</div>
          </div>
        </div>
        <div id="pmc_widget">
          <div class="panel panel-main panel-inverse" data-inner-id="panel-server-package-management">
            <div class="panel-heading">
              <h4 class="panel-title"><?php echo T('PACKAGE_MANAGEMENT_CENTER'); ?></h4>
            </div>
            <div class="panel-body text-center" style="padding: 24px; color: #999;"><?php echo T('REFRESH'); ?>...</div>
          </div>
        </div>

      </div>

      <div class="col-md-4 dash-right" data-inner-id="right-panel-container">
        <div class="panel panel-side panel-inverse-full panel-updates" data-inner-id="panel-server-load">
          <div class="panel-heading">
            <h4 class="panel-title text-success"><?php echo T('SERVER_LOAD'); ?></h4>
          </div>
          <div class="panel-body">
            <div class="row">
              <div class="col-sm-9">
                <h4><span id="cpuload"></span></h4>
                <p><?php echo T('SL_TXT'); ?></p>
              </div>
              <div class="col-sm-3 text-right">
                <i class="fa fa-heartbeat text-danger" style="font-size: 70px"></i>
              </div>
              <div class="row">
                <div class="col-sm-12 mt20 text-center">
                  <strong><?php echo T('UPTIME'); ?>:</strong> <span id="uptime"></span>
                </div>
              </div>
            </div>
          </div>
        </div><!-- SERVER LOAD WIDGET -->
        <div class="panel panel-side panel-inverse" data-inner-id="panel-server-cpu">
          <div class="panel-heading">
            <h4 class="panel-title"><?php echo T('CPU_STATUS'); ?></h4>
          </div>
          <div class="panel-body" style="overflow:hidden">
            <span id="node-cpu-static" class="nomargin" style="font-size:14px">
              <?php echo T('REFRESH'); ?>...
            </span>
          </div>
        </div><!-- CPU WIDGET -->
        <div class="panel panel-side panel-inverse" data-inner-id="panel-server-disk">
          <div class="panel-heading">
            <h4 class="panel-title"><?php echo T('YOUR_DISK_STATUS'); ?></h4>
          </div>
          <div class="panel-body">
            <div id="disk_data"></div>
          </div>
        </div><!-- DISK WIDGET -->

        <div class="panel panel-side panel-inverse" data-inner-id="panel-server-ram">
          <div class="panel-heading">
            <h4 class="panel-title"><?php echo T('SYSTEM_RAM_STATUS'); ?></h4>
          </div>
          <div class="panel-body">
            <div id="meterram"></div>
          </div>
        </div><!-- RAM WIDGET -->
        <div class="panel panel-inverse" id="project-commits" data-inner-id="panel-server-update">
          <div class="panel-heading">
            <h4 class="panel-title text-success"><?php echo T('RECENT_UPDATES'); ?>
              <a href="https://github.com/amefs/quickbox-lite/blob/<?php echo $branch; ?>/CHANGELOG.md#changelog-<?php echo str_replace('.', '', $version); ?>"
                title="<?php echo T('CURRENT_VERSIONS_CHANGELOG'); ?>"
                data-placement="top" class="label label-primary tooltips"
                style="font-size:10px; padding-top:0; padding-bottom:0px; top: -2px; position: relative;"
                target="_blank" rel="noopenner noreferrer">
                  QuickBox :: <span style="color: #fff;text-shadow: 0px 0px 6px #fff;"><?php echo "{$version}"; ?></span>
              </a>
            </h4>
          </div>
          <div class="panel-body ps" style="max-height: 350px; padding: 0;">
            <?php
              $current_commit = trim((string) shell_exec('git -C /etc/QuickBox/ rev-parse --short HEAD'));
?>
            <?php if ($current_commit !== '') { ?>
            <div class="alert alert-default" style="margin-bottom: 4px; text-align: center" role="alert">
                <?php echo T('QUICKBOX_COMMIT'); ?>
                <code>
                  <a href="https://github.com/amefs/quickbox-lite/commit/<?php echo $current_commit; ?>" target="_blank" rel="noopenner noreferrer" title="<?php echo T('CURRENT_COMMIT'); ?>" data-placement="top" class="tooltips">
                    <?php echo $current_commit; ?>
                  </a>...
                  <a href="https://github.com/amefs/quickbox-lite/compare/<?php echo $current_commit; ?>...<?php echo $branch; ?>" target="_blank" rel="noopenner noreferrer" title="<?php echo T('COMPARE_COMMITS'); ?>" data-placement="top" class="tooltips">
                    <?php echo T('LATEST_COMMIT'); ?>
                  </a>
                </code><br>
              </div>
              <?php } ?>
              <div id="activityfeed"></div>
            </div>
          <div class="panel-footer">
          <button onclick="boxHandler(event)" data-package="quickbox --only-core" data-operation="update" data-toggle="modal" data-target="#sysResponse" class="btn btn-success btn-quirk btn-block">
            <i class="fa fa-bell text-success"></i> <?php echo T('UPDATE'); ?>
          </button>
          </div>
        </div><!-- QUICKBOX UPDATE WIDGET -->
      </div>
    </div>
  </div><!-- contentpanel -->
</div><!-- mainpanel -->

<script>
  (function () {
    function renderNetworkInterfaces(interfaces) {
      var tbody = document.getElementById('node-network-interface-rows');
      if (!tbody) {
        return;
      }
      tbody.innerHTML = '';
      if (!Array.isArray(interfaces) || !interfaces.length) {
        var emptyRow = document.createElement('tr');
        var emptyCell = document.createElement('td');
        emptyCell.colSpan = 3;
        emptyCell.style.fontSize = '11px';
        emptyCell.style.padding = '4px 4px 4px 12px';
        emptyCell.textContent = 'N/A';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
      }
      interfaces.forEach(function (iface) {
        var row = document.createElement('tr');

        var nameCell = document.createElement('td');
        nameCell.style.fontSize = '14px';
        nameCell.style.fontWeight = 'bold';
        nameCell.style.padding = '2px 2px 2px 12px';
        nameCell.textContent = iface;
        row.appendChild(nameCell);

        var txCell = document.createElement('td');
        txCell.style.fontSize = '11px';
        txCell.style.padding = '2px 2px 2px 12px';
        txCell.innerHTML = '<span class="text-success"><span id="net_' + iface + '_tx">0B/s</span></span>';
        row.appendChild(txCell);

        var rxCell = document.createElement('td');
        rxCell.style.fontSize = '11px';
        rxCell.style.padding = '2px 2px 2px 12px';
        rxCell.innerHTML = '<span class="text-primary"><span id="net_' + iface + '_rx">0B/s</span></span>';
        row.appendChild(rxCell);

        tbody.appendChild(row);
      });
    }

    function renderSystemStatic(payload) {
      var cpu = document.getElementById('node-cpu-static');
      if (cpu && payload && payload.cpu) {
        cpu.innerHTML = payload.cpu.modelHtml + '<br/>[<span style="color:#999;font-weight:600">x' + payload.cpu.count + '</span> core]';
      }
      renderNetworkInterfaces(payload ? payload.interfaces : []);
    }

    fetch('/ws/node/system_static', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch static system info');
        }
        return response.json();
      })
      .then(renderSystemStatic)
      .catch(function (error) {
        console.warn('[ws] failed to load static system info', error);
        renderNetworkInterfaces([]);
      });
  })();
</script>

<?php
require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.scripts.php');
require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.end.php');
?>
