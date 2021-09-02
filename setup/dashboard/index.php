<?php
  require_once($_SERVER['DOCUMENT_ROOT'].'/inc/config.php');
  require_once($_SERVER['DOCUMENT_ROOT'].'/inc/localize.php');
  require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.system.php');

  require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.header.php');
  require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.menu.php');

  assert(isset($version));
  assert(isset($branch));

  $sysCpuInfo       = SystemInfo::cpuinfo();
  $sysInterfaceInfo = SystemInfo::enuminterface();
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
                  <tbody>
                    <?php for ($i = 0; $i < count($sysInterfaceInfo); ++$i) { ?>
                    <tr>
                      <td style="font-size:14px;font-weight:bold;padding: 2px 2px 2px 12px"><?php echo $sysInterfaceInfo[$i]; ?></td>
                      <td style="font-size:11px;padding: 2px 2px 2px 12px"><span class="text-success"><span id="NetOutSpeed<?php echo $i; ?>">0B/s</span></span></td>
                      <td style="font-size:11px;padding: 2px 2px 2px 12px"><span class="text-primary"><span id="NetInputSpeed<?php echo $i; ?>">0B/s</span></span></td>
                    </tr>
                    <?php } ?>
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

        <!--SERVICE CONTROL CENTER-->
        <?php require($_SERVER['DOCUMENT_ROOT'].'/widgets/service_control.php'); ?>
        <!-- panel -->

        <!--PACKAGE MANAGEMENT CENTER-->
        <?php require($_SERVER['DOCUMENT_ROOT'].'/widgets/pmc.php'); ?>
        <!-- panel -->

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
            <span class="nomargin" style="font-size:14px">
              <?php echo $sysCpuInfo['model']; ?><br/>
              [<span style="color:#999;font-weight:600">x<?php echo $sysCpuInfo['count']; ?></span> core]
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
              <a href="https://github.com/amefs/quickbox-lite/compare/<?php echo $version.'...'.$branch; ?>" 
                title="<?php echo T('CURRENT_VERSIONS_CHANGELOG'); ?>"
                data-placement="top" class="label label-primary tooltips"
                style="font-size:10px; padding-top:0; padding-bottom:0px; top: -2px; position: relative;"
                target="_blank" rel="noopener">
                  QuickBox :: <span style="color: #fff;text-shadow: 0px 0px 6px #fff;"><?php echo "{$version}"; ?></span>
              </a>
            </h4>
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

<?php
  require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.scripts.php');
  require($_SERVER['DOCUMENT_ROOT'].'/inc/panel.end.php');
?>
