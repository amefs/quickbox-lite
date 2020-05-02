<?php
  include ('..inc/config.php');
  include ('..inc/panel.header.php');
  include ('..inc/panel.menu.php');
?>


          <!--PACKAGE MANAGEMENT CENTER-->
          <div class="panel panel-main panel-inverse">
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
                    <tr>
                      <td>autodl-irssi</td>
                      <td><?php echo T('AUTODL'); ?></td>
                      <?php if (file_exists("/install/.autodlirssi.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#autodlirssiRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-autodlirssi=true" data-toggle="modal" data-target="#sysResponse" id="autodlirssiInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>BTSync</td>
                      <td><?php echo T('BTSYNC'); ?></td>
                      <?php if (file_exists("/install/.btsync.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#btsyncRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-btsync=true" data-toggle="modal" data-target="#sysResponse" id="btsyncInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>Deluge</td>
                      <td><?php echo T('DELUGE'); ?></td>
                      <?php if (file_exists("/install/.deluge.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#delugeRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-deluge=true" data-toggle="modal" data-target="#sysResponse" id="delugeInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>Denyhosts</td>
                      <td><?php echo T('DENYHOSTS'); ?></td>
                      <?php if (file_exists("/install/.denyhosts.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#denyhostsRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><button data-toggle="tooltip" title="<?php echo T('BOX_TOOLTIP_DENYHOSTS'); ?>" data-placement="top" class="btn btn-xs btn-danger disabled tooltips"><?php echo T('BOX'); ?></button></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>Fail2ban</td>
                      <td><?php echo T('FAIL2BAN'); ?></td>
                      <?php if (file_exists("/install/.fail2ban.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#fail2banRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><button data-toggle="tooltip" title="<?php echo T('BOX_TOOLTIP_FAIL2BAN'); ?>" data-placement="top" class="btn btn-xs btn-danger disabled tooltips"><?php echo T('BOX'); ?></button></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>File Browser</td>
                      <td><?php echo T('FILEBROWSER'); ?></td>
                      <?php if (file_exists("/install/.filebrowser.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#filebrowserRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-filebrowser=true" data-toggle="modal" data-target="#sysResponse" id="filebrowserInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>FBE</td>
                      <td><?php echo T('FILEBROWSEREE'); ?></td>
                      <?php if (file_exists("/install/.filebrowser-ee.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#filebrowsereeRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-filebrowser-ee=true" data-toggle="modal" data-target="#sysResponse" id="filebrowsereeInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>FlexGet</td>
                      <td><?php echo T('FLEXGET'); ?></td>
                      <?php if (file_exists("/install/.$username.flexget.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#flexgetRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-flexget=true" data-toggle="modal" data-target="#sysResponse" id="flexgetInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                    <td>Flood</td>
                      <td><?php echo T('FLOOD'); ?></td>
                      <?php if (file_exists("/install/.flood.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#floodRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-flood=true" data-toggle="modal" data-target="#sysResponse" id="floodInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>Let's Encrypt</td>
                      <td><?php echo T('LECERT'); ?></td>
                      <?php if (file_exists("/install/.lecert.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#lecertRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><button data-toggle="tooltip" title="<?php echo T('BOX_TOOLTIP_LECERT'); ?>" data-placement="top" class="btn btn-xs btn-danger disabled tooltips"><?php echo T('BOX'); ?></button></td>
                      <?php } ?>
                    </tr>
                    <tr>
                    <td>Netdata</td>
                      <td><?php echo T('NETDATA'); ?></td>
                      <?php if (file_exists("/install/.netdata.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#netdataRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-netdata=true" data-toggle="modal" data-target="#sysResponse" id="netdataInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                    <td>noVNC</td>
                      <td><?php echo T('NOVNC'); ?></td>
                      <?php if (file_exists("/install/.novnc.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#novncRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-novnc=true" data-toggle="modal" data-target="#sysResponse" id="novncInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>Plex</td>
                      <td><?php echo T('PLEX'); ?></td>
                      <?php if (file_exists("/install/.plex.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#plexRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-plex=true" data-toggle="modal" data-target="#sysResponse" id="plexInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>rTorrent</td>
                      <td><?php echo T('RTORRENT'); ?></td>
                      <?php if (file_exists("/install/.rtorrent.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#rtorrentRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-rtorrent=true" data-toggle="modal" data-target="#sysResponse" id="rtorrentInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>ruTorrent</td>
                      <td><?php echo T('RUTORRENT'); ?></td>
                      <?php if (file_exists("/install/.rutorrent.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#rutorrentRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-rutorrent=true" data-toggle="modal" data-target="#sysResponse" id="rutorrentInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                    <td>Syncthing</td>
                    <td><?php echo T('SYNCTHING'); ?></td>
                    <?php if (file_exists("/install/.syncthing.lock")) { ?>
                      <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#syncthingRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                    <?php } else { ?>
                      <td style="vertical-align: middle; text-align: center"><a href="?installpackage-syncthing=true" data-toggle="modal" data-target="#sysResponse" id="syncthingInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                    <?php } ?>
                    </tr>
                    <tr>
                    <td>Transmission</td>
                    <td><?php echo T('TRANSMISSION'); ?></td>
                    <?php if (file_exists("/install/.transmission.lock")) { ?>
                      <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#transmissionRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                    <?php } else { ?>
                      <td style="vertical-align: middle; text-align: center"><a href="?installpackage-transmission=true" data-toggle="modal" data-target="#sysResponse" id="transmissionInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                    <?php } ?>
                    </tr>
                    <tr>
                    <td>qBittorrent</td>
                    <td><?php echo T('QBITTORRENT'); ?></td>
                    <?php if (file_exists("/install/.qbittorrent.lock")) { ?>
                      <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#qbittorrentRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                    <?php } else { ?>
                      <td style="vertical-align: middle; text-align: center"><a href="?installpackage-qbittorrent=true" data-toggle="modal" data-target="#sysResponse" id="qbittorrentInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                    <?php } ?>
                    </tr>
                    <tr>
                      <td>x2Go</td>
                      <td><?php echo T('X2GO'); ?></td>
                      <?php if (file_exists("/install/.x2go.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#x2goRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="?installpackage-x2go=true" data-toggle="modal" data-target="#sysResponse" id="x2goInstall" class="btn btn-xs btn-default"><?php echo T('INSTALL'); ?></a></td>
                      <?php } ?>
                    </tr>
                    <tr>
                      <td>ZNC</td>
                      <td><?php echo T('ZNC'); ?></td>
                      <?php if (file_exists("/install/.znc.lock")) { ?>
                        <td style="vertical-align: middle; text-align: center"><a href="javascript:void()" data-toggle="modal" data-target="#zncRemovalConfirm" class="btn btn-xs btn-success"><?php echo T('INSTALLED'); ?></a></td>
                      <?php } else { ?>
                        <td style="vertical-align: middle; text-align: center"><button data-toggle="tooltip" title="<?php echo T('BOX_TOOLTIP_ZNC'); ?>" data-placement="top" class="btn btn-xs btn-danger disabled tooltips"><?php echo T('BOX'); ?></button></td>
                      <?php } ?>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div><!-- package center panel -->
