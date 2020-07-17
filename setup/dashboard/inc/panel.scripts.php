</section>

<!-- AUTODL UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="autodlirssiRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="AutodlirssiRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="AutodlirssiRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> autodl-irssi?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_AUTODL_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="autodlirssi" id="autodlirssiRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- BTSYNC UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="btsyncRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="BTSyncRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="BTSyncRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> BTSync?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_BTSYNC_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="btsync" id="btsyncRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- DELUGE UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="delugeRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="DelugeRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="DelugeRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> Deluge?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_DELUGE_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="deluge" id="delugeRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- FILEBROWSER UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="filebrowserRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="filebrowserRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="filebrowserRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> File Browser?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_FILEBROWSER_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="filebrowser" id="filebrowserRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- FILEBROWSEREE UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="filebrowsereeRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="filebrowsereeRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="filebrowsereeRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> File Browser?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_FILEBROWSEREE_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="filebrowser-ee" id="filebrowsereeRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- FLEXGET UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="flexgetRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="flexgetRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="flexgetRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> FlexGet?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_FLEXGET_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="flexget" id="flexgetRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- FLOOD UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="floodRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="floodRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="floodRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> Flood?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_FLOOD_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="flood" id="floodRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- NETDATA UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="netdataRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="netdataRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="netdataRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> Netdata?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_NETDATA_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="netdata" id="netdataRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- NOVNC UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="novncRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="novncRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="novncRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> noVNC?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_NOVNC_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="novnc" id="novncRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- PLEX UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="plexRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="PlexRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="PlexRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> Plex?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_PLEX_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="plex" id="plexRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- RTORRENT UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="rtorrentRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="rtorrentRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="rtorrentRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> rTorrent?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_RTORRENT_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="rtorrent" id="rtorrentRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- RUTORRENT UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="rutorrentRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="rutorrentRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="rutorrentRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> ruTorrent?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_RUTORRENT_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="rutorrent" id="rutorrentRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- SYNCTHING UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="syncthingRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="SyncthingRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="SyncthingRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> Syncthing?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_SYNCTHING_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="syncthing" id="syncthingRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- TRANSMISSION UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="transmissionRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="TransmissionRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="TransmissionRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> Transmission?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_TRANSMISSION_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="transmission" id="transmissionRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- QBITTORRENT UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="qbittorrentRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="qBittorrentRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="qBittorrentRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> qBittorrent?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_QBITTORRENT_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="qbittorrent" id="qbittorrentRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- X2GO UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="x2goRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="x2goRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="x2goRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> x2go?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_X2GO_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="x2go" id="x2goRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- ZNC UNINSTALL MODAL -->
<div class="modal bounceIn animated" id="zncRemovalConfirm" tabindex="-1" role="dialog" aria-labelledby="ZNCRemovalConfirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="ZNCRemovalConfirm"><?php echo T('UNINSTALL_TITLE'); ?> ZNC?</h4>
      </div>
      <div class="modal-body">
        <?php echo T('UNINSTALL_ZNC_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <button onclick="packageRemoveHandler(event)" data-dismiss="modal" data-toggle="modal" data-target="#sysResponse" data-package="znc" id="zncRemove" class="btn btn-primary"><?php echo T('AGREE'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<!-- THEME SELECT MODAL -->
<?php $option = array();
              $option[] = array('file' => 'defaulted', 'title' =>'Defaulted');
              $option[] = array('file' => 'smoked', 'title' =>'Smoked'); { ?>
<?php foreach($option as $theme) { ?>
<div class="modal bounceIn animated" id="themeSelect<?php echo $theme['file'] ?>Confirm" tabindex="-1" role="dialog" aria-labelledby="ThemeSelect<?php echo $theme['file'] ?>Confirm" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="ThemeSelect<?php echo $theme['file'] ?>Confirm"><?php echo $theme['title'] ?></h4>
      </div>
      <div class="modal-body">
        <?php echo T('THEME_CHANGE_TXT'); ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
        <a href="?themeSelect-<?php echo $theme['file'] ?>=true" id="themeSelect<?php echo $theme['file'] ?>Go" class="btn btn-primary"><?php echo T('AGREE'); ?></a>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->
<?php } ?>
<?php } ?>
<!-- SYSTEM RESPONSE MODAL -->
<div class="modal bounceIn animated" id="sysResponse" tabindex="-1" role="dialog" aria-labelledby="sysResponse" aria-hidden="true">
  <div class="modal-dialog" style="width: 600px">
    <div class="modal-content" style="background:rgba(0, 0, 0, 0.6);border:2px solid rgba(0, 0, 0, 0.2)">
      <div class="modal-header" style="background:rgba(0, 0, 0, 0.4);border:0!important">
        <h4 class="modal-title" style="color:#fff"><?php echo T('SYSTEM_RESPONSE_TITLE'); ?></h4>
      </div>
      <div class="modal-body ps-container" style="background:rgba(0, 0, 0, 0.4); max-height:600px;" id="sysPre">
        <pre style="color: rgb(83, 223, 131) !important;" class="sysout ps-child"><span id="sshoutput"></span></pre>
      </div>
      <div class="modal-footer" style="background:rgba(0, 0, 0, 0.4);border:0!important">
        <button onclick="boxHandler(event)" data-package="log" data-operation="clean" data-dismiss="modal" class="btn btn-xs btn-danger"><?php echo T('CLOSE_REFRESH'); ?></button>
      </div>
    </div><!-- modal-content -->
  </div><!-- modal-dialog -->
</div><!-- modal -->

<!-- VERSION UPDATE CHECK MODAL >
<div class="modal bounceIn animated" id="versionChecker" tabindex="-1" role="dialog" aria-labelledby="VersionChecker" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="VersionChecker">Select Your Update Branch</h4>
      </div>
      <div class="modal-body">
        Take your pick between updates.<br/><br/>Select to update your dashboard on the Stable branches (fully tested) or opt to hop on our Testing branches. <br/><br/>You may run the update interchangeably and swap back to a stable branch and visa versa.
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default pull-left" data-dismiss="modal">Close</button>
        <a href="?updatetestingQuickBox=true" class="btn btn-primary" data-toggle="modal" data-target="#sysResponse" data-dismiss="modal" aria-label="Close">TESTING</a>
        <a href="?updateQuickBox=true" class="btn btn-success" data-toggle="modal" data-target="#sysResponse" data-dismiss="modal" aria-label="Close">STABLE</a>
      </div>
    </div><!- modal-content ->
  </div><!- modal-dialog ->
</div><!- modal -->

<!-- COMMIT COMPARISON MODAL >
<div class="modal bounceIn animated" id="commitComparison" tabindex="-1" role="dialog" aria-labelledby="CommitComparison" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
        <h4 class="modal-title" id="CommitComparison">Choose A Module For Comparison</h4>
      </div>
      <div class="modal-body">
        Dashboard - <a href="https://github.com/QuickBox/quickbox_dashboard/compare/<?php echo $version ?>...master" target="blank"><?php echo $version ?> ... latest commit</a><br/>
        Packages - <a href="https://github.com/QuickBox/quickbox_packages/compare/<?php echo $version ?>...master" target="blank"><?php echo $version ?> ... latest commit</a><br/>
        Setup - <a href="https://github.com/QuickBox/quickbox_setup/compare/<?php echo $version ?>...master" target="blank"><?php echo $version ?> ... latest commit</a><br/>
        Themes - <a href="https://github.com/QuickBox/quickbox_themes/compare/<?php echo $version ?>...master" target="blank"><?php echo $version ?> ... latest commit</a><br/>
        RUTorrent - <a href="https://github.com/QuickBox/quickbox_rutorrent/compare/<?php echo $version ?>...master" target="blank"><?php echo $version ?> ... latest commit</a><br/>
        RUTorrent Plugins - <a href="https://github.com/QuickBox/quickbox_rutorrent-plugins/compare/<?php echo $version ?>...master" target="blank"><?php echo $version ?> ... latest commit</a><br/>
        club-QuickBox - <a href="https://github.com/QuickBox/club-QuickBox/compare/<?php echo $version ?>...master" target="blank"><?php echo $version ?> ... latest commit</a><br/>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal"><?php echo T('CANCEL'); ?></button>
      </div>
    </div><!- modal-content ->
  </div><!- modal-dialog ->
</div><!- modal -->

<!--script src="js/script.js"></script-->
<script src="lib/jquery-ui/jquery-ui.min.js"></script>
<script src="lib/jquery.ui.touch-punch.min.js"></script>
<script src="lib/bootstrap/js/bootstrap.min.js"></script>
<script src="lib/visibility/visibility.fallback.js"></script>
<script src="lib/visibility/visibility.core.js"></script>
<script src="lib/visibility/visibility.timers.js"></script>
<script src="lib/socket.io/socket.io.js"></script>
<script src="lib/lazysizes/lazysizes.min.js" async></script>
<script src="lib/bootbox/bootbox.all.min.js" async></script>
<script src="js/quick.js"></script>
<script src="inc/panel.app_status.ws.js"></script>
<script src="inc/panel.app_service.ws.js"></script>

<!-- async load function -->
<script>
  function asyncLoad(url, func) {
    var script = document.createElement('script'),
        orgins = document.getElementsByTagName('script')[0];
    script.src = url;
    if (func) { script.addEventListener('load', function (e) { func(null, e); }, false); }
    orgins.parentNode.insertBefore(script, orgins);
  }
</script>

<script>
asyncLoad("lib/lobipanel/js/lobipanel.min.js", function() {
$(function() {
  $('.panel').lobiPanel({
      reload: {
        icon: 'fa fa-refresh'
      },
      unpin: {
        icon: 'fa fa-arrows'
      },
      minimize: {
        icon: 'fa fa-chevron-up',
        icon2: 'fa fa-chevron-down'
      },
      close: {
        icon: 'fa fa-times-circle'
      },
      expand: {
        icon: 'fa fa-expand',
        icon2: 'fa fa-compress'
      },
      dropdown: {
        icon: 'fa fa-cog'
      },
      close: false,
      save: true,
      sortable: true,
      stateful: true,
      draggable: true,
      reload: false,
      resize: true,
      editTitle: false,
      expand: false
  });
  $('#rutorrent').on('loaded.lobiPanel', function (ev, lobiPanel) {
    var $body = lobiPanel.$el.find('.panel-body');
    $body.html('<div>' + $body.html() + '</div>');
  });
});
});
</script>

<script>
asyncLoad("lib/jquery-toggles/toggles.js", function() {
$(function() {
  // Left Panel Toggles
  $(".leftpanel-toggle").toggles({
      on: true,
      height: 11,
  });
  $(".leftpanel-toggle-off").toggles({ height: 11 });
  // Toggles
  $(".toggle-en").toggles({
    on: true,
    height: 26,
    width: 100,
    text: {
      on: "<?php echo T('ENABLED') ?>",
    },
  });
  $(".toggle-dis").toggles({
    on: false,
    height: 26,
    width: 100,
    text: {
      off: "<?php echo T('DISABLED') ?>",
    },
  });
  $(".toggle-pen").toggles({
    on: true,
    height: 16,
    width: 90,
    text: {
      on: "<?php echo T('INSTALLED') ?>",
      off: "<?php echo T('UNINSTALLING') ?>",
    },
  });
  $(".toggle-pdis").toggles({
    on: false,
    height: 16,
    width: 90,
    text: {
      off: "<?php echo T('UNINSTALLED') ?>",
      on: "<?php echo T('INSTALLING') ?>",
    },
  });
});
});
</script>

<script>
asyncLoad("lib/perfect-scrollbar/js/perfect-scrollbar.jquery.min.js", function() {
$(function() {
  $('.leftpanel').perfectScrollbar();
  $('.leftpanel').perfectScrollbar({ wheelSpeed: 1, wheelPropagation: true, minScrollbarLength: 20 });
  $('.leftpanel').perfectScrollbar('update');
  $('.modal-body').perfectScrollbar();
  $('.modal-body').perfectScrollbar({ wheelSpeed: 1, wheelPropagation: true, minScrollbarLength: 20 });
  $('.modal-body').perfectScrollbar('update');
  $('.sysout').perfectScrollbar();
  $('.sysout').perfectScrollbar({ wheelSpeed: 1, wheelPropagation: true, minScrollbarLength: 20 });
  $('.sysout').perfectScrollbar('update');
});
});
</script>

<script>
asyncLoad("lib/jquery-gritter/js/jquery.gritter.min.js", function() {
$(function() {
  'use strict';

  function gritterHandler(packagename, fullname) {
    return function() {
        $.gritter.add({
        title: `<?php echo T('UNINSTALLING_TITLE'); ?> ${packagename}`,
        text: `<?php echo T('UNINSTALLING_TXT_1'); ?> ${fullname || packagename} <?php echo T('UNINSTALLING_TXT_2'); ?>`,
        class_name: 'with-icon times-circle danger',
        sticky: true
      });
    }
  }

  $('#autodlirssiRemove').click(gritterHandler('AutoDL-iRSSi'));
  $('#btsyncRemove').click(gritterHandler('BTSync', 'Bittorrent Sync'));
  $('#delugeRemove').click(gritterHandler('Deluge'));
  $('#filebrowserRemove').click(gritterHandler('filebrowser'));
  $('#filebrowsereeRemove').click(gritterHandler('filebrowser-ee', 'File Browser Enhanced'));
  $('#flexgetRemove').click(gritterHandler('flexget'));
  $('#floodRemove').click(gritterHandler('flood'));
  $('#netdataRemove').click(gritterHandler('netdata'));
  $('#novncRemove').click(gritterHandler('novnc'));
  $('#plexRemove').click(gritterHandler('Plex', 'Plex Media Server'));
  $('#rtorrentRemove').click(gritterHandler('rtorrent'));
  $('#rutorrentRemove').click(gritterHandler('rutorrent'));
  $('#syncthingRemove').click(gritterHandler('Syncthing'));
  $('#transmissionRemove').click(gritterHandler('Transmission'));
  $('#qbittorrentRemove').click(gritterHandler('qBittorrent'));
  $('#x2goRemove').click(gritterHandler('x2go'));
  $('#zncRemove').click(gritterHandler('ZNC'));
});
});
</script>

<script>
$(document).ready(function() {
  $('#sysResponse').on('hidden.bs.modal', function () {
    location.reload();
  });
});
</script>

<script src="lib/datatables/js/jquery.dataTables.min.js"></script>
<script src="lib/datatables/js/dataTables.bootstrap.min.js"></script>
<script src="lib/select2/select2.js"></script>

<script>
$(document).ready(function() {

  'use strict';

  $('#dataTable1').DataTable();

  var exRowTable = $('#exRowTable').DataTable({
    responsive: true,
    'fnDrawCallback': function(oSettings) {
      $('#exRowTable_paginate ul').addClass('pagination-active-success');
    },
    'ajax': 'ajax/objects.txt',
    'columns': [{
      'class': 'details-control',
      'orderable': false,
      'data': null,
      'defaultContent': ''
    },
    { 'data': 'name' },
    { 'data': 'details' },
    { 'data': 'availability' }
    ],
    'order': [[1, 'asc']]
  });

  // Add event listener for opening and closing details
  $('#exRowTable tbody').on('click', 'td.details-control', function () {
    var tr = $(this).closest('tr');
    var row = exRowTable.row( tr );

    if ( row.child.isShown() ) {
      // This row is already open - close it
      row.child.hide();
      tr.removeClass('shown');
    } else {
      // Open this row
      row.child( format(row.data()) ).show();
      tr.addClass('shown');
    }
  });

  function format (d) {
    // `d` is the original data object for the row
    return '<h4>'+d.name+'<small>'+d.details+'</small></h4>'+
    '<p class="nomargin">Nothing to see here.</p>';
  }

  // Select2
  $('select').select2({ minimumResultsForSearch: Infinity });

});
</script>
