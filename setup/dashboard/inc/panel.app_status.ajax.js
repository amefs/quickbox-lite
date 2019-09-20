$(document).ready(function() {

  /////////////////////////////////////////////
  // BEGIN AJAX APP CALLS ON SERVICE STATUS //
  ///////////////////////////////////////////

  // <<-------- BTSYNC -------->> //
  function appstat_btsync() {
    $.ajax({url: "/widgets/app_status/app_status_btsync.php", cache:true, success: function (result) {
      $('#appstat_btsync').html(result);
      setTimeout(function(){appstat_btsync()}, 5000);
    }});
  }
  appstat_btsync();

  // <<-------- DELUGED -------->> //
  function appstat_deluged() {
    $.ajax({url: "/widgets/app_status/app_status_deluged.php", cache:true, success: function (result) {
      $('#appstat_deluged').html(result);
      setTimeout(function(){appstat_deluged()}, 5000);
    }});
  }
  appstat_deluged();

  // <<-------- DELUGE WEB -------->> //
  function appstat_delugeweb() {
    $.ajax({url: "/widgets/app_status/app_status_delugeweb.php", cache:true, success: function (result) {
      $('#appstat_delugeweb').html(result);
      setTimeout(function(){appstat_delugeweb()}, 5000);
    }});
  }
  appstat_delugeweb();

  // <<-------- DENYHOSTS -------->> //
  function appstat_denyhosts() {
    $.ajax({url: "/widgets/app_status/app_status_denyhosts.php", cache:true, success: function (result) {
      $('#appstat_denyhosts').html(result);
      setTimeout(function(){appstat_denyhosts()}, 5000);
    }});
  }
  appstat_denyhosts();

  // <<-------- FAIL2BAN -------->> //
  function appstat_fail2ban() {
    $.ajax({url: "/widgets/app_status/app_status_fail2ban.php", cache:true, success: function (result) {
      $('#appstat_fail2ban').html(result);
      setTimeout(function(){appstat_fail2ban()}, 5000);
    }});
  }
  appstat_fail2ban();

  // <<-------- FILEBROWSER -------->> //
  function appstat_filebrowser() {
    $.ajax({url: "/widgets/app_status/app_status_filebrowser.php", cache:true, success: function (result) {
      $('#appstat_filebrowser').html(result);
      setTimeout(function(){appstat_filebrowser()}, 5000);
    }});
  }
  appstat_filebrowser();

  // <<-------- FLEXGET -------->> //
  function appstat_flexget() {
    $.ajax({url: "/widgets/app_status/app_status_flexget.php", cache:true, success: function (result) {
      $('#appstat_flexget').html(result);
      setTimeout(function(){appstat_flexget()}, 5000);
    }});
  }
  appstat_flexget();

  // <<-------- FLOOD -------->> //
  function appstat_flood() {
    $.ajax({url: "/widgets/app_status/app_status_flood.php", cache:true, success: function (result) {
      $('#appstat_flood').html(result);
      setTimeout(function(){appstat_flood()}, 5000);
    }});
  }
  appstat_flood();

  // <<-------- IRSSI -------->> //
  function appstat_irssi() {
    $.ajax({url: "/widgets/app_status/app_status_irssi.php", cache:true, success: function (result) {
      $('#appstat_irssi').html(result);
      setTimeout(function(){appstat_irssi()}, 5000);
    }});
  }
  appstat_irssi();

  // <<-------- NETDATA -------->> //
  function appstat_netdata() {
    $.ajax({url: "/widgets/app_status/app_status_netdata.php", cache:true, success: function (result) {
      $('#appstat_netdata').html(result);
      setTimeout(function(){appstat_netdata()}, 5000);
    }});
  }
  appstat_netdata();

  // <<-------- NOVNC -------->> //
  function appstat_novnc() {
    $.ajax({url: "/widgets/app_status/app_status_novnc.php", cache:true, success: function (result) {
      $('#appstat_novnc').html(result);
      setTimeout(function(){appstat_novnc()}, 5000);
    }});
  }
  appstat_novnc();

  // <<-------- PLEX -------->> //
  function appstat_plex() {
    $.ajax({url: "/widgets/app_status/app_status_plex.php", cache:true, success: function (result) {
      $('#appstat_plex').html(result);
      setTimeout(function(){appstat_plex()}, 5000);
    }});
  }
  appstat_plex();

  // <<-------- RTORRENT -------->> //
  function appstat_rtorrent() {
    $.ajax({url: "/widgets/app_status/app_status_rtorrent.php", cache:true, success: function (result) {
      $('#appstat_rtorrent').html(result);
      setTimeout(function(){appstat_rtorrent()}, 5000);
    }});
  }
  appstat_rtorrent();

  // <<-------- SYNCTHING -------->> //
  function appstat_syncthing() {
    $.ajax({url: "/widgets/app_status/app_status_syncthing.php", cache:true, success: function (result) {
      $('#appstat_syncthing').html(result);
      setTimeout(function(){appstat_syncthing()}, 5000);
    }});
  }
  appstat_syncthing();

  // <<-------- TRANSMISSION -------->> //
  function appstat_transmission() {
    $.ajax({url: "/widgets/app_status/app_status_transmission.php", cache:true, success: function (result) {
      $('#appstat_transmission').html(result);
      setTimeout(function(){appstat_transmission()}, 5000);
    }});
  }
  appstat_transmission();
  
    // <<-------- QBITTORRENT -------->> //
  function appstat_qbittorrent() {
    $.ajax({url: "/widgets/app_status/app_status_qbittorrent.php", cache:true, success: function (result) {
      $('#appstat_qbittorrent').html(result);
      setTimeout(function(){appstat_qbittorrent()}, 5000);
    }});
  }
  appstat_qbittorrent();

  // <<-------- WEB CONSOLE -------->> //
  function appstat_webconsole() {
    $.ajax({url: "/widgets/app_status/app_status_webconsole.php", cache:true, success: function (result) {
      $('#appstat_webconsole').html(result);
      setTimeout(function(){appstat_webconsole()}, 5000);
    }});
  }
  appstat_webconsole();

  // <<-------- X2GO -------->> //
  function appstat_x2go() {
    $.ajax({url: "/widgets/app_status/app_status_x2go.php", cache:true, success: function (result) {
      $('#appstat_x2go').html(result);
      setTimeout(function(){appstat_x2go()}, 5000);
    }});
  }
  appstat_x2go();

  // <<-------- ZNC -------->> //
  function appstat_znc() {
    $.ajax({url: "/widgets/app_status/app_status_znc.php", cache:true, success: function (result) {
      $('#appstat_znc').html(result);
      setTimeout(function(){appstat_znc()}, 5000);
    }});
  }
  appstat_znc();
  

  ///////////////////////////////////////////
  // END AJAX APP CALLS ON SERVICE STATUS //
  /////////////////////////////////////////

  function uptime() {
    $.ajax({url: "/widgets/up.php", cache:true, success: function (result) {
      $('#uptime').html(result);
      setTimeout(function(){uptime()}, 60000);
    }});
  }
  uptime();

  function sload() {
    $.ajax({url: "/widgets/load.php", cache:true, success: function (result) {
      $('#cpuload').html(result);
      setTimeout(function(){sload()}, 60000);
    }});
  }
  sload();

  function bwtables() {
    $.ajax({url: "/widgets/bw_tables.php", cache:false, success: function (result) {
      $('#bw_tables').html(result);
      setTimeout(function(){bwtables()}, 60000);
    }});
  }
  bwtables();

  function diskstats() {
    $.ajax({url: "/widgets/disk_data.php", cache:false, success: function (result) {
      $('#disk_data').html(result);
      setTimeout(function(){diskstats()}, 15000);
    }});
  }
  diskstats();

  function ramstats() {
    $.ajax({url: "/widgets/ram_stats.php", cache:false, success: function (result) {
      $('#meterram').html(result);
      setTimeout(function(){ramstats()}, 10000);
    }});
  }
  ramstats();

  function activefeed() {
    $.ajax({url: "/widgets/activity_feed.php", cache:false, success: function (result) {
      $('#activityfeed').html(result);
      setTimeout(function(){activefeed()}, 300000);
    }});
  }
  activefeed();

  function msgoutput() {
    $.ajax({url: "/db/output.log", cache:false, success: function (result) {
      $('#sshoutput').html(result);
      setTimeout(function(){msgoutput()}, 5000);
    }});
    jQuery( function(){
      var pre = jQuery("#sysPre");
      pre.scrollTop( pre.prop("scrollHeight") );
    });
  }
  msgoutput();

  });
  //success: function (result)
