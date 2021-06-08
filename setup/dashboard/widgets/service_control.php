<?php
  include('..inc/config.php');
  include('..inc/panel.header.php');
  include('..inc/panel.menu.php');
  require_once($_SERVER['DOCUMENT_ROOT'].'/inc/package_info.php');
?>

<!--SERVICE CONTROL CENTER-->
<div class="panel panel-inverse" data-inner-id="panel-server-service-control">
  <div class="panel-heading">
    <h4 class="panel-title"><?php echo T('SERVICE_CONTROL_CENTER'); ?></h4>
  </div>
  <div class="panel-body" style="padding: 0">
    <div class="table-responsive">
      <table class="table table-hover nomargin" style="font-size:14px">
        <thead>
          <tr>
            <th class="text-center"><?php echo T('SERVICE_STATUS'); ?></th>
            <th class="text-center"><?php echo T('RESTART_SERVICES'); ?></th>
            <th class="text-center"><?php echo T('ENABLE_DISABLE_SERVICES'); ?></th>
          </tr>
        </thead>
        <tbody>
        <?php
        foreach ($packageList as &$package) {
            if (!isset($package["services"]) || !file_exists($package["lockfile"])) {
                continue;
            }
            $services = $package["services"];
            foreach ($services as $service => $info) {
                ?>
          <tr>
            <td><span id="appstat_<?php echo $service; ?>"></span><?php echo $info["name"]; ?>
            <?php if (isset($info["tooltips"])) { ?>
            <span class="tooltips" data-toggle="tooltip" title="<?php echo $info["tooltips"]; ?>" data-placement="right"><i class="tooltips fa <?php echo $info["tooltipsicon"]; ?>"></i><span></td>
            <?php } ?>
            <td class="text-center"><button onclick="serviceUpdateHandler(event)" data-service="<?php echo $service; ?>" data-operation="enable,restart" class="btn btn-xs btn-default"><i class="fa fa-refresh text-info"></i> <?php echo T('REFRESH'); ?></button></td>
            <td class="text-center"><?php echo isEnabled($service, $info["username"]); ?></td>
          </tr>
        <?php
            }
        }
        ?>
        </tbody>
      </table>
    </div><!-- table-responsive -->
  </div>
</div><!-- panel -->
