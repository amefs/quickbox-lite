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
      function format(length, factor, tail, fractionDigits) {
        return (length / 2 ** factor).toFixed(fractionDigits).toString() + tail;
      }

      function formatsize(length) {
        if (length >= 2 ** 40) {
            return format(length, 40, "TB/s", 2);
        } else if (length >= 2 ** 30) {
            return format(length, 30, "GB/s", 2);
        } else if (length >= 2 ** 20) {
            return format(length, 20, "MB/s", 2);
        } else if (length >= 2 ** 10) {
            return format(length, 10, "KB/s", 2);
        } else {
            return format(Math.max(0, length), 0, "B/s", 0);
        }
      }

      $.getJSON(task.url, (dataJSON) => {
        for (let i = 2; i < 5; ++i) {
          if (window.NetOutSpeed[i] !== undefined) {
            const speed_str = formatsize(dataJSON.NetOutSpeed[i] - window.NetOutSpeed[i]);
            window.NetOutSpeed[i] = dataJSON.NetOutSpeed[i];
            $("#NetOutSpeed" + i).html(speed_str);
          }
          if (window.NetInputSpeed[i] !== undefined) {
            const speed_str = formatsize(dataJSON.NetInputSpeed[i] - window.NetInputSpeed[i]);
            window.NetInputSpeed[i] = dataJSON.NetInputSpeed[i];
            $("#NetInputSpeed" + i).html(speed_str);
          }
        }
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
  $.ajaxSetup({
    timeout: 5000
  });

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
                  url: task.url,
                  cache: true,

                  success: (result) => {
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
