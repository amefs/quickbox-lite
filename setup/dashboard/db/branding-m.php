<?php
// SPDX-License-Identifier: GPL-3.0-or-later

assert(isset($branch));
?>
<ul class="dropdown-menu pull-right">
  <li>
  <?php if ($branch === 'master') { ?>
    <a onclick="boxHandler(event)" data-package="" data-operation="enable-dev" data-toggle="modal" data-target="#sysResponse" style="cursor: pointer;"><?php echo T('SWITCH_DEV'); ?></a>
  <?php } elseif ($branch === 'development') { ?>
    <a onclick="boxHandler(event)" data-package="" data-operation="disable-dev" data-toggle="modal" data-target="#sysResponse" style="cursor: pointer;"><?php echo T('SWITCH_MASTER'); ?></a>
  <?php } ?>
  </li>
  <li style="border-top: 1px solid #444">
    <a href="https://github.com/amefs/quickbox-lite/issues/new" target="_blank" rel="noopener"><i class="fa fa-warning text-warning"></i><?php echo T('ISSUE_REPORT_TXT'); ?></a>
  </li>
</ul>
