(function($) {
  const service_status_list = [{
    name: "BTSYNC",
    url: "/widgets/service_status.php?service=resilio-sync",
    id: "#appstat_resilio-sync",
    time: 5000
  }, {
    name: "CIFS",
    url: "/widgets/service_status.php?service=smbd",
    id: "#appstat_smbd",
    time: 5000
  }, {
    name: "DELUGED",
    url: "/widgets/service_status.php?service=deluged",
    id: "#appstat_deluged",
    time: 5000
  }, {
    name: "DELUGE WEB",
    url: "/widgets/service_status.php?service=deluge-web",
    id: "#appstat_deluge-web",
    time: 5000
  }, {
    name: "DENYHOSTS",
    url: "/widgets/service_status.php?service=denyhosts",
    id: "#appstat_denyhosts",
    time: 5000
  }, {
    name: "FAIL2BAN",
    url: "/widgets/service_status.php?service=fail2ban",
    id: "#appstat_fail2ban",
    time: 5000
  }, {
    name: "FILEBROWSER",
    url: "/widgets/service_status.php?service=filebrowser",
    id: "#appstat_filebrowser",
    time: 5000
  }, {
    name: "FILEBROWSEREE",
    url: "/widgets/service_status.php?service=filebrowser-ee",
    id: "#appstat_filebrowser-ee",
    time: 5000
  }, {
    name: "FLEXGET",
    url: "/widgets/service_status.php?service=flexget",
    id: "#appstat_flexget",
    time: 5000
  }, {
    name: "FLOOD",
    url: "/widgets/service_status.php?service=flood",
    id: "#appstat_flood",
    time: 5000
  }, {
    name: "IRSSI",
    url: "/widgets/service_status.php?service=irssi",
    id: "#appstat_irssi",
    time: 5000
  }, {
    name: "NETDATA",
    url: "/widgets/service_status.php?service=netdata",
    id: "#appstat_netdata",
    time: 5000
  }, {
    name: "NFS",
    url: "/widgets/service_status.php?service=nfs-server",
    id: "#appstat_nfs-server",
    time: 5000
  }, {
    name: "NOVNC",
    url: "/widgets/service_status.php?service=tightvnc",
    id: "#appstat_tightvnc",
    time: 5000
  }, {
    name: "OPENVPN",
    url: "/widgets/service_status.php?service=openvpn",
    id: "#appstat_openvpn",
    time: 5000
  }, {
    name: "PLEX",
    url: "/widgets/service_status.php?service=plexmediaserver",
    id: "#appstat_plexmediaserver",
    time: 5000
  }, {
    name: "RTORRENT",
    url: "/widgets/service_status.php?service=rtorrent",
    id: "#appstat_rtorrent",
    time: 5000
  }, {
    name: "SYNCTHING",
    url: "/widgets/service_status.php?service=syncthing",
    id: "#appstat_syncthing",
    time: 5000
  }, {
    name: "TRANSMISSION",
    url: "/widgets/service_status.php?service=transmission",
    id: "#appstat_transmission",
    time: 5000
  }, {
    name: "QBITTORRENT",
    url: "/widgets/service_status.php?service=qbittorrent",
    id: "#appstat_qbittorrent",
    time: 5000
  }, {
    name: "VSFTPD",
    url: "/widgets/service_status.php?service=vsftpd",
    id: "#appstat_vsftpd",
    time: 5000
  }, {
    name: "WEB CONSOLE",
    url: "/widgets/service_status.php?service=shellinabox",
    id: "#appstat_shellinabox",
    time: 5000
  }, {
    name: "X2GO",
    url: "/widgets/service_status.php?service=x2go",
    id: "#appstat_x2go",
    time: 5000
  }, {
    name: "ZNC",
    url: "/widgets/service_status.php?service=znc",
    id: "#appstat_znc",
    time: 5000
  }];

  const system_status_list = [{
    name: "NETWORK",
    url: "/widgets/net_status.php",
    id: undefined,
    override: function (dataJSON) {
      function format(length, factor, tail, fractionDigits) {
        return (length / Math.pow(2, factor)).toFixed(fractionDigits).toString() + " " + tail;
      }

      function formatsize(length) {
        if (length >= Math.pow(2, 40)) {
          return format(length, 40, "TB/s", 2);
        } else if (length >= Math.pow(2, 30)) {
          return format(length, 30, "GB/s", 2);
        } else if (length >= Math.pow(2, 20)) {
          return format(length, 20, "MB/s", 2);
        } else if (length >= Math.pow(2, 10)) {
          return format(length, 10, "KB/s", 2);
        } else {
          return format(Math.max(0, length), 0, "B/s", 0);
        }
      }

      const duration = (dataJSON.NetTimeStamp - window.NetTimeStamp);
      for (let i = 2; i <= dataJSON.InterfaceIndex; ++i) {
        if (window.NetOutSpeed[i] !== undefined) {
          const speed = (dataJSON.NetOutSpeed[i] - window.NetOutSpeed[i]) / duration;
          const speed_str = formatsize(speed);
          $("#NetOutSpeed" + i).html(speed_str);
        }
        if (window.NetInputSpeed[i] !== undefined) {
          const speed = (dataJSON.NetInputSpeed[i] - window.NetInputSpeed[i]) / duration;
          const speed_str = formatsize(speed);
          $("#NetInputSpeed" + i).html(speed_str);
        }
      }
      window.NetOutSpeed = dataJSON.NetOutSpeed;
      window.NetInputSpeed = dataJSON.NetInputSpeed;
      window.NetTimeStamp = dataJSON.NetTimeStamp;
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
    time: 2500,
    before: function(task) {
      return $('#sysResponse').is(":visible");
    },
    after: function () {
      const element = $("#sysPre");
      element.scrollTop(element.prop("scrollHeight"));
    }
  }];

  function groupBy(xs, key) {
    return xs.reduce(function(rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  }

  let first_request = true;

  function start_status_update() {
    const task_mapping = {};
    const status_list = [].concat(service_status_list, system_status_list);
    status_list.forEach(function(item) {
      task_mapping[item.url] = item;
    });
    const socket = io(location.origin, { path: "/ws/socket.io" });
    socket.on("message", function(message) {
      if (message.success) {
        const task = task_mapping[message.pathName];
        if (task.override) {
          task.override(message.response);
        } else if (task.id !== undefined) {
          $(task.id).html(message.response);
          if (task.after) {
            task.after(task);
          }
        } else {
          console.warn("ID not found, status won't update.");
        }
      } else {
        console.error(message);
      }
    });

    // group task with time
    const task_info = groupBy(status_list, "time");
    for (let time_str in task_info) {
      if (task_info.hasOwnProperty(time_str) === false) {
        continue;
      }
      const time_number = parseInt(time_str);
      const task_list = task_info[time_str];
      const task_entity = function () {
        let delay = 0;
        for (let i = 0; i < task_list.length; ++i) {
          const task = task_list[i];
          // set a delay for each task.
          setTimeout(function() {
            if (task.before) {
              // skip if before task failed
              if (task.before(task) === false) {
                return;
              }
            }
            // only displayed element or override will be updated
            if ((task.id && $(task.id).length > 0) || task.override) {
              socket.send(task.url);
            }
          }, delay);
          // let all requests sent in half cycle evenly except first round.
          if (first_request === false) {
            delay += time_number / (task_list.length * 2);
          }
        }
      };
      Visibility.every(time_number, 10 * time_number, task_entity);
      // trigger for first time.
      task_entity();
    }
    first_request = false;
  }

  document.addEventListener("DOMContentLoaded", function() {
    Visibility.afterPrerendering(start_status_update);
  });

})(window.jQuery);
