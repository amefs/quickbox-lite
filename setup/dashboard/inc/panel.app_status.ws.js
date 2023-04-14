// SPDX-License-Identifier: GPL-3.0-or-later

/* global Visibility, socket */
"use strict";

(function ($) {
  const service_status_list = [{
    key: "BTSYNC",
    url: "/widgets/service_status.php?service=resilio-sync",
    id: "#appstat_resilio-sync",
    time: 5000
  }, {
    key: "CIFS",
    url: "/widgets/service_status.php?service=smbd",
    id: "#appstat_smbd",
    time: 5000
  }, {
    key: "DELUGED",
    url: "/widgets/service_status.php?service=deluged",
    id: "#appstat_deluged",
    time: 5000
  }, {
    key: "DELUGE_WEB",
    url: "/widgets/service_status.php?service=deluge-web",
    id: "#appstat_deluge-web",
    time: 5000
  }, {
    key: "DENYHOSTS",
    url: "/widgets/service_status.php?service=denyhosts",
    id: "#appstat_denyhosts",
    time: 5000
  }, {
    key: "EMBY",
    url: "/widgets/service_status.php?service=emby-server",
    id: "#appstat_emby-server",
    time: 5000
  }, {
    key: "FAIL2BAN",
    url: "/widgets/service_status.php?service=fail2ban",
    id: "#appstat_fail2ban",
    time: 5000
  }, {
    key: "FILEBROWSER",
    url: "/widgets/service_status.php?service=filebrowser",
    id: "#appstat_filebrowser",
    time: 5000
  }, {
    key: "FILEBROWSEREE",
    url: "/widgets/service_status.php?service=filebrowser-ee",
    id: "#appstat_filebrowser-ee",
    time: 5000
  }, {
    key: "FLEXGET",
    url: "/widgets/service_status.php?service=flexget",
    id: "#appstat_flexget",
    time: 5000
  }, {
    key: "FLOOD",
    url: "/widgets/service_status.php?service=flood",
    id: "#appstat_flood",
    time: 5000
  }, {
    key: "JELLYFIN",
    url: "/widgets/service_status.php?service=jellyfin",
    id: "#appstat_jellyfin",
    time: 5000
  }, {
    key: "IRSSI",
    url: "/widgets/service_status.php?service=irssi",
    id: "#appstat_irssi",
    time: 5000
  }, {
    key: "NETDATA",
    url: "/widgets/service_status.php?service=netdata",
    id: "#appstat_netdata",
    time: 5000
  }, {
    key: "NFS",
    url: "/widgets/service_status.php?service=nfs-server",
    id: "#appstat_nfs-server",
    time: 5000
  }, {
    key: "NOVNC",
    url: "/widgets/service_status.php?service=tightvnc",
    id: "#appstat_tightvnc",
    time: 5000
  }, {
    key: "OPENVPN",
    url: "/widgets/service_status.php?service=openvpn",
    id: "#appstat_openvpn",
    time: 5000
  }, {
    key: "PLEX",
    url: "/widgets/service_status.php?service=plexmediaserver",
    id: "#appstat_plexmediaserver",
    time: 5000
  }, {
    key: "RCLONE",
    url: "/widgets/service_status.php?service=rclone-web",
    id: "#appstat_rclone-web",
    time: 5000
  }, {
    key: "RTORRENT",
    url: "/widgets/service_status.php?service=rtorrent",
    id: "#appstat_rtorrent",
    time: 5000
  }, {
    key: "SYNCTHING",
    url: "/widgets/service_status.php?service=syncthing",
    id: "#appstat_syncthing",
    time: 5000
  }, {
    key: "TRANSMISSION",
    url: "/widgets/service_status.php?service=transmission",
    id: "#appstat_transmission",
    time: 5000
  }, {
    key: "QBITTORRENT",
    url: "/widgets/service_status.php?service=qbittorrent",
    id: "#appstat_qbittorrent",
    time: 5000
  }, {
    key: "WEBDAV",
    url: "/widgets/service_status.php?service=webdav",
    id: "#appstat_webdav",
    time: 5000
  }, {
    key: "VSFTPD",
    url: "/widgets/service_status.php?service=vsftpd",
    id: "#appstat_vsftpd",
    time: 5000
  }, {
    key: "WEB_CONSOLE",
    url: "/widgets/service_status.php?service=ttyd",
    id: "#appstat_ttyd",
    time: 5000
  }, {
    key: "X2GO",
    url: "/widgets/service_status.php?service=x2go",
    id: "#appstat_x2go",
    time: 5000
  }, {
    key: "ZNC",
    url: "/widgets/service_status.php?service=znc",
    id: "#appstat_znc",
    time: 5000
  }];

  const system_status_list = [{
    key: "NETWORK",
    url: "/widgets/net_status.php",
    id: undefined,
    override: function (dataJSON) {
      function format (length, factor, tail, fractionDigits) {
        return (length / Math.pow(2, factor)).toFixed(fractionDigits).toString() + " " + tail;
      }

      function formatsize (length) {
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
      const length = dataJSON.NetOutSpeed.length;
      let invalid_data_flag = false;
      for (let i = 0; i < length; ++i) {
        const out_speed = (dataJSON.NetOutSpeed[i] - window.NetOutSpeed[i]) / duration;
        if (isNaN(out_speed)) {
          invalid_data_flag = true;
          console.warn(`[NaN DETECTED] out[${i}]=${out_speed}`, out_speed, dataJSON.NetOutSpeed[i], window.NetOutSpeed[i], duration, dataJSON.NetOutSpeed[i] - window.NetOutSpeed[i]);
          $("#NetOutSpeed" + i).html("N/A");
        } else {
          const out_speed_str = formatsize(out_speed);
          $("#NetOutSpeed" + i).html(out_speed_str);
        }

        const in_speed = (dataJSON.NetInputSpeed[i] - window.NetInputSpeed[i]) / duration;
        if (isNaN(in_speed)) {
          invalid_data_flag = true;
          console.warn(`[NaN DETECTED]  in[${i}]`, in_speed, dataJSON.NetInputSpeed[i], window.NetInputSpeed[i], duration, dataJSON.NetInputSpeed[i] - window.NetInputSpeed[i]);
          $("#NetInputSpeed" + i).html("N/A");
        } else {
          const in_speed_str = formatsize(in_speed);
          $("#NetInputSpeed" + i).html(in_speed_str);
        }
      }
      if (!invalid_data_flag) {
        window.NetOutSpeed = dataJSON.NetOutSpeed;
        window.NetInputSpeed = dataJSON.NetInputSpeed;
        window.NetTimeStamp = dataJSON.NetTimeStamp;
      }
    },
    time: 1000
  }, {
    key: "UPTIME",
    url: "/widgets/up.php",
    id: "#uptime",
    time: 60000
  }, {
    key: "TOP",
    url: "/widgets/load.php",
    id: "#cpuload",
    time: 60000
  }, {
    key: "BANDWIDTH",
    url: "/widgets/bw_tables.php",
    url_template: "/widgets/bw_tables.php?page={0}",
    id: "#bw_tables",
    before: function () {
      const page = localStorage.getItem("bw_tables:page");
      if (page && page.length === 1 && "shdm".includes(page)) {
        this.url = this.url_template.replace("{0}", page);
      }
      return true;
    },
    time: 60000
  }, {
    key: "DISK_USAGE",
    url: "/widgets/disk_data.php",
    id: "#disk_data",
    time: 15000
  }, {
    key: "RAM_USAGE",
    url: "/widgets/ram_stats.php",
    id: "#meterram",
    time: 10000
  }, {
    key: "SSH_OUTPUT",
    url: "/db/output.log",
    id: "#sshoutput",
    time: 2500,
    before: function (task) {
      return $("#sysResponse").is(":visible");
    },
    after: function () {
      const element = $("#sysPre");
      element.scrollTop(element.prop("scrollHeight"));
    }
  }];

  function groupBy (xs, key) {
    return xs.reduce(function (rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  }

  let first_request = true;
  let error_count = 0;

  function start_status_update () {
    const task_mapping = {};
    const status_list = [].concat(service_status_list, system_status_list);
    for (let i = 0; i < status_list.length; ++i) {
      const status = status_list[i];
      if (status.key in task_mapping) {
        console.warn(`[ws] status config key: ${status.key} duplicated,`, status);
        continue;
      }
      task_mapping[status.key] = status;
    }
    // add event listener
    socket.on("message", function (response) {
      if (response.success) {
        const task = task_mapping[response.key];
        if (task === undefined) {
          console.warn("[ws] task config not found,", response);
          return;
        }
        if (task.override && typeof (task.override) === "function") {
          task.override(response.response);
          return;
        }
        if (task.id !== undefined) {
          $(task.id).html(response.response);
          if (task.after && typeof (task.after) === "function") {
            task.after(task);
          }
        } else {
          console.warn("[ws] DOM id not found, status won't update,", response);
        }
      } else {
        ++error_count;
        console.error("[ws] request failed,", response);
      }
      if (error_count > 256) {
        console.warn("[ws] too many errors, stop status update");
        socket.close();
      }
    });

    // group task with time
    const task_info = groupBy(status_list, "time");
    for (const time_str in task_info) {
      const time_interval = parseInt(time_str);
      const task_list = task_info[time_str];
      const task_entity = function () {
        let delay = 0;
        for (let i = 0; i < task_list.length; ++i) {
          const task = task_list[i];
          // set a delay for each task.
          setTimeout(function () {
            if (task.before && typeof (task.before) === "function") {
              // skip if before task failed
              if (task.before(task) === false) {
                return;
              }
            }
            // only displayed element or override will be updated
            if ((task.id && $(task.id).length > 0) || task.override) {
              socket.send(task);
            }
          }, delay);
          // let all requests sent in half cycle evenly except first round.
          if (first_request === false) {
            delay += time_interval / (task_list.length * 2);
          }
        }
      };
      Visibility.every(time_interval, 10 * time_interval, task_entity);
      // trigger for first time.
      task_entity();
    }
    first_request = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    Visibility.afterPrerendering(start_status_update);
  });
})(window.jQuery);
