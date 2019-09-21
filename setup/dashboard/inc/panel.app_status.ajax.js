(($) => {
  const service_status_list = [{
    name: "BTSYNC",
    url: "/widgets/app_status/app_status_btsync.php",
    id: "#appstat_btsync",
    time: 5000
  }, {
    name: "DELUGED",
    url: "/widgets/app_status/app_status_deluged.php",
    id: "#appstat_deluged",
    time: 5000
  }, {
    name: "DELUGE WEB",
    url: "/widgets/app_status/app_status_delugeweb.php",
    id: "#appstat_delugeweb",
    time: 5000
  }, {
    name: "DENYHOSTS",
    url: "/widgets/app_status/app_status_denyhosts.php",
    id: "#appstat_denyhosts",
    time: 5000
  }, {
    name: "FAIL2BAN",
    url: "/widgets/app_status/app_status_fail2ban.php",
    id: "#appstat_fail2ban",
    time: 5000
  }, {
    name: "FILEBROWSER",
    url: "/widgets/app_status/app_status_filebrowser.php",
    id: "#appstat_filebrowser",
    time: 5000
  }, {
    name: "FLEXGET",
    url: "/widgets/app_status/app_status_flexget.php",
    id: "#appstat_flexget",
    time: 5000
  }, {
    name: "FLOOD",
    url: "/widgets/app_status/app_status_flood.php",
    id: "#appstat_flood",
    time: 5000
  }, {
    name: "IRSSI",
    url: "/widgets/app_status/app_status_irssi.php",
    id: "#appstat_irssi",
    time: 5000
  }, {
    name: "NETDATA",
    url: "/widgets/app_status/app_status_netdata.php",
    id: "#appstat_netdata",
    time: 5000
  }, {
    name: "NOVNC",
    url: "/widgets/app_status/app_status_novnc.php",
    id: "#appstat_novnc",
    time: 5000
  }, {
    name: "PLEX",
    url: "/widgets/app_status/app_status_plex.php",
    id: "#appstat_plex",
    time: 5000
  }, {
    name: "RTORRENT",
    url: "/widgets/app_status/app_status_rtorrent.php",
    id: "#appstat_rtorrent",
    time: 5000
  }, {
    name: "SYNCTHING",
    url: "/widgets/app_status/app_status_syncthing.php",
    id: "#appstat_syncthing",
    time: 5000
  }, {
    name: "TRANSMISSION",
    url: "/widgets/app_status/app_status_transmission.php",
    id: "#appstat_transmission",
    time: 5000
  }, {
    name: "QBITTORRENT",
    url: "/widgets/app_status/app_status_qbittorrent.php",
    id: "#appstat_qbittorrent",
    time: 5000
  }, {
    name: "WEB CONSOLE",
    url: "/widgets/app_status/app_status_webconsole.php",
    id: "#appstat_webconsole",
    time: 5000
  }, {
    name: "X2GO",
    url: "/widgets/app_status/app_status_x2go.php",
    id: "#appstat_x2go",
    time: 5000
  }, {
    name: "ZNC",
    url: "/widgets/app_status/app_status_znc.php",
    id: "#appstat_znc",
    time: 5000
  }];

  const system_status_list = [{
    name: "NETWORK",
    url: "/?act=rt&callback=?",
    id: undefined,
    overload: (task) => {
      function ForDight(digit, exp) {
        let Last = "";
        if (digit < 0) {
          Last = 0 + "B/s";
        } else if (digit < 1024) {
          Last = Math.round(digit * Math.pow(10, exp)) / Math.pow(10, exp) + "B/s";
        } else if (digit < 1048576) {
          digit = digit / 1024;
          Last = Math.round(digit * Math.pow(10, exp)) / Math.pow(10, exp) + "KB/s";
        } else {
          digit = digit / 1048576;
          Last = Math.round(digit * Math.pow(10, exp)) / Math.pow(10, exp) + "MB/s";
        }
        return Last;
      }
      $.getJSON(task.url, (dataJSON) => {
        for (let i = 2; i <= 10; ++i) {
          $("#NetOut" + i).html(dataJSON["NetOut" + i]);
          $("#NetInput" + i).html(dataJSON["NetInput" + i]);
        }

        $("#NetOutSpeed2").html(ForDight((dataJSON.NetOutSpeed2 - window.NetOutSpeed[2]), 3)); window.NetOutSpeed[2] = dataJSON.NetOutSpeed2;
        $("#NetOutSpeed3").html(ForDight((dataJSON.NetOutSpeed3 - window.NetOutSpeed[3]), 3)); window.NetOutSpeed[3] = dataJSON.NetOutSpeed3;
        $("#NetOutSpeed4").html(ForDight((dataJSON.NetOutSpeed4 - window.NetOutSpeed[4]), 3)); window.NetOutSpeed[4] = dataJSON.NetOutSpeed4;
        $("#NetOutSpeed5").html(ForDight((dataJSON.NetOutSpeed5 - window.NetOutSpeed[5]), 3)); window.NetOutSpeed[5] = dataJSON.NetOutSpeed5;
        $("#NetInputSpeed2").html(ForDight((dataJSON.NetInputSpeed2 - window.NetInputSpeed[2]), 3)); window.NetInputSpeed[2] = dataJSON.NetInputSpeed2;
        $("#NetInputSpeed3").html(ForDight((dataJSON.NetInputSpeed3 - window.NetInputSpeed[3]), 3)); window.NetInputSpeed[3] = dataJSON.NetInputSpeed3;
        $("#NetInputSpeed4").html(ForDight((dataJSON.NetInputSpeed4 - window.NetInputSpeed[4]), 3)); window.NetInputSpeed[4] = dataJSON.NetInputSpeed4;
        $("#NetInputSpeed5").html(ForDight((dataJSON.NetInputSpeed5 - window.NetInputSpeed[5]), 3)); window.NetInputSpeed[5] = dataJSON.NetInputSpeed5;
      });
    },
    time: 1000
  }, {
    name: "UPTIME",
    url: "/widgets/up.php",
    id: "#uptime",
    time: 60000
  }, {
    name: "TOP",
    url: "/widgets/load.php",
    id: "#cpuload",
    time: 60000
  }, {
    name: "BANDWIDTH",
    url: "/widgets/bw_tables.php",
    id: "#bw_tables",
    time: 60000
  }, {
    name: "DISK USAGE",
    url: "/widgets/disk_data.php",
    id: "#disk_data",
    time: 15000
  }, {
    name: "RAM USAGE",
    url: "/widgets/ram_stats.php",
    id: "#meterram",
    time: 10000
  }, {
    name: "QUICKBOX FEED",
    url: "/widgets/activity_feed.php",
    id: "#activityfeed",
    time: 300000
  }, {
    name: "SSH OUTPUT",
    url: "/db/output.log",
    id: "#sshoutput",
    time: 5000,
    after: () => {
      const element = $("#sysPre");
      element.scrollTop(element.prop("scrollHeight"));
    }
  }];

  function groupBy(xs, key) {
    return xs.reduce((rv, x) => {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  }

  // group task with time
  const task_info = groupBy([].concat(service_status_list, system_status_list), "time");

  function start_status_update(tasks) {
    // record all interval id in a global object
    window.app_status_interval_info = {};

    for (const time_str of Object.keys(tasks)) {
      const time_number = parseInt(time_str);
      const task_list = tasks[time_str];
      const task_entity = () => {
        let delay = 0;
        for (const task of task_list) {
          // set a delay for each task.
          setTimeout(() => {
            if (task.before) task.before(task);
            if (task.overload) {
              task.overload(task);
            } else {
              // only displayed element will be updated
              if (task.id && $(task.id).length > 0) {
                $.ajax({
                  url: task.url, cache: true, success: (result) => {
                    $(task.id).html(result);
                  }
                });
              }
            }
            if (task.after) task.after(task);
          }, delay);
          // make sure all requests have been sent in half cycle.
          delay += time_number / (task_list.length * 2);
        }
      };
      window.app_status_interval_info[time_str] = setInterval(task_entity, parseInt(time_number));
      task_entity();
    }
  }

  function stop_status_update() {
    if (window.app_status_interval_info !== undefined) {
      for (const time_str of Object.keys(window.app_status_interval_info)) {
        clearInterval(window.app_status_interval_info[time_str]);
      }
      window.app_status_interval_info = undefined;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    start_status_update(task_info);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        if (window.app_status_interval_info === undefined) {
          start_status_update(task_info);
        }
      } else {
        setTimeout(stop_status_update, 5000);
      }
    });
  });

})(window.jQuery);
