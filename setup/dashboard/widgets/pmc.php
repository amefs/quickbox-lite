<?php
  include('..inc/config.php');
  include('..inc/panel.header.php');
  include('..inc/panel.menu.php');
  require_once($_SERVER['DOCUMENT_ROOT'].'/inc/package_info.php');
?>


<!--PACKAGE MANAGEMENT CENTER-->
<div class="panel panel-main panel-inverse" data-inner-id="panel-server-package-management">
  <div class="panel-heading">
    <h4 class="panel-title"><?php echo T('PACKAGE_MANAGEMENT_CENTER'); ?></h4>
  </div>
  <div class="panel-body text-center" style="padding:0;">
    <div class="alert alert-danger">
      <button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>
      <div align = "center"><?php echo T('PMC_NOTICE_TXT'); ?></div>
    </div>
    <div class="table-responsive ps-container">
      <table id="dataTable1" class="table table-bordered table-striped-col" style="font-size: 12px">
        <thead>
          <tr>
            <th><?php echo T('NAME'); ?></th>
            <th><?php echo T('DETAILS'); ?></th>
            <th><?php echo T('AVAILABILITY'); ?></th>
          </tr>
        </thead>
        <tbody>
          <?php
            foreach ($packageList as &$package) {
                if (isset($package["skip"]) && $package["skip"]) {
                    continue;
                }
                $packageLowercase = strtolower($package["package"]);
                $packageUppercase = strtoupper($package["package"]); ?>
            <tr>
              <td><?php echo $package["name"]; ?></td>
              <td><?php echo T($package["description"]); ?></td>
              <?php if (file_exists($package["lockfile"])) { ?>
                <td style="vertical-align: middle; text-align: center"><button data-toggle="modal" data-target="#<?php echo $packageLowercase; ?>RemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></button></td>
              <?php } elseif ($package["boxonly"]) { ?>
                <td style="vertical-align: middle; text-align: center"><button data-toggle="tooltip" title="<?php echo T($package["install"]); ?>" data-placement="top" class="btn btn-xs btn-danger disabled tooltips"><?php echo T('BOX'); ?></button></td>
              <?php } else { ?>
                <td style="vertical-align: middle; text-align: center"><button onclick="packageInstallHandler(event)" data-toggle="modal" data-target="#sysResponse" data-package="<?php echo $packageLowercase; ?>" id="<?php echo $packageLowercase; ?>Install" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></button></td>
              <?php } ?>
            </tr>
          <?php
            } ?>
        </tbody>
      </table>
      <?php if (($username == "{$master}") && file_exists('/install/.install.lock')) { ?>
        <p style="font-size:10px" style="padding-bottom:12px">
        <hr />
        <?php echo T('CLEAR_LOCK_TXT'); ?>&nbsp; &nbsp; &nbsp; &nbsp;<button onclick="boxHandler(event)" data-package="dpkg" data-operation="fix" data-toggle="modal" data-target="#sysResponse" class="btn btn-xs btn-default"><?php echo T('CLEAR_LOCK'); ?></button>
        </p>
      <?php } ?>
    </div>
  </div>
</div><!-- package center panel -->