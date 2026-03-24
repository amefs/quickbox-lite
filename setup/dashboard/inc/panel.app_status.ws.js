// SPDX-License-Identifier: GPL-3.0-or-later

/* global Visibility, socket */
"use strict";

(function ($) {
  const service_status_items = [{
    service: "resilio-sync",
    id: "#appstat_resilio-sync"
  }, {
    service: "smbd",
    id: "#appstat_smbd"
  }, {
    service: "deluged",
    id: "#appstat_deluged"
  }, {
    service: "deluge-web",
    id: "#appstat_deluge-web"
  }, {
    service: "denyhosts",
    id: "#appstat_denyhosts"
  }, {
    service: "emby-server",
    id: "#appstat_emby-server"
  }, {
    service: "fail2ban",
    id: "#appstat_fail2ban"
  }, {
    service: "filebrowser",
    id: "#appstat_filebrowser"
  }, {
    service: "filebrowser-ee",
    id: "#appstat_filebrowser-ee"
  }, {
    service: "flexget",
    id: "#appstat_flexget"
  }, {
    service: "flood",
    id: "#appstat_flood"
  }, {
    service: "jellyfin",
    id: "#appstat_jellyfin"
  }, {
    service: "irssi",
    id: "#appstat_irssi"
  }, {
    service: "netdata",
    id: "#appstat_netdata"
  }, {
    service: "nfs-server",
    id: "#appstat_nfs-server"
  }, {
    service: "tightvnc",
    id: "#appstat_tightvnc"
  }, {
    service: "openvpn",
    id: "#appstat_openvpn"
  }, {
    service: "peerbanhelper",
    id: "#appstat_peerbanhelper"
  }, {
    service: "plexmediaserver",
    id: "#appstat_plexmediaserver"
  }, {
    service: "rclone-web",
    id: "#appstat_rclone-web"
  }, {
    service: "rtorrent",
    id: "#appstat_rtorrent"
  }, {
    service: "sabnzbd",
    id: "#appstat_sabnzbd"
  }, {
    service: "syncthing",
    id: "#appstat_syncthing"
  }, {
    service: "transmission",
    id: "#appstat_transmission"
  }, {
    service: "qbittorrent",
    id: "#appstat_qbittorrent"
  }, {
    service: "qbittorrent-clientblocker",
    id: "#appstat_qbittorrent-clientblocker"
  }, {
    service: "webdav",
    id: "#appstat_webdav"
  }, {
    service: "vsftpd",
    id: "#appstat_vsftpd"
  }, {
    service: "ttyd",
    id: "#appstat_ttyd"
  }, {
    service: "x2go",
    id: "#appstat_x2go"
  }, {
    service: "znc",
    id: "#appstat_znc"
  }];

  const system_status_list = [{
    key: "SERVICE_STATUS_ALL",
    url: "/node/service_status_all.php",
    override: function (response) {
      for (let i = 0; i < service_status_items.length; ++i) {
        const item = service_status_items[i];
        if (response[item.service] !== undefined) {
          $(item.id).html(response[item.service]);
        }
      }
    },
    bootstrap: false,
    time: 5000
  }, {
    key: "SERVICE_CONTROL",
    url: "/node/service_control.php",
    id: "#service_control_widget",
    after: function () {
      $(".toggle-en, .toggle-dis").each(function () {
        const $toggle = $(this);
        if ($toggle.parent(".toggle-slide").length > 0 || $toggle.parent(".toggle-modern").length > 0) {
          return;
        }
        $toggle.toggles({
          on: $toggle.hasClass("toggle-en"),
          height: 26,
          width: 100,
          text: $toggle.hasClass("toggle-en") ? {
            on: "Enabled"
          } : {
            off: "Disabled"
          }
        });
      });
      $(".tooltips").tooltip();
    },
    bootstrap: true,
    time: 15000
  }, {
    key: "PMC",
    url: "/node/pmc.php",
    id: "#pmc_widget",
    after: function () {
      let currentPage = 0;
      if ($.fn.DataTable.isDataTable("#dataTable1")) {
        currentPage = $("#dataTable1").DataTable().page();
        $("#dataTable1").DataTable().destroy();
      }
      const table = $("#dataTable1").DataTable();
      if (currentPage > 0) {
        table.page(currentPage).draw(false);
      }
      $(".tooltips").tooltip();
    },
    bootstrap: true,
    time: 30000
  }, {
    key: "NETWORK",
    url: "/node/net_status.php",
    id: undefined,
    override: function (dataJSON) {
      function formatsize (length) {
        const suffixList = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
        let numeric = Number(length);
        if (!isFinite(numeric) || numeric <= 0) {
          return "0 B/s";
        }
        let idx = 0;
        while (numeric >= 1024 && idx < suffixList.length - 1) {
          numeric /= 1024;
          ++idx;
        }
        return numeric.toFixed(idx > 0 ? 2 : 0) + " " + suffixList[idx];
      }

      if (window.ts === undefined || window.net === undefined) {
        window.net = dataJSON.net;
        window.ts = dataJSON.ts;
        return;
      }

      const duration = (dataJSON.ts - window.ts);
      if (duration < 1e-5) {
        return;
      }

      const interfaces = Object.keys(dataJSON.net);
      let invalid_data_flag = false;
      for (const network_interface of interfaces) {
        const out_speed = (dataJSON.net[network_interface].tx_bytes - window.net[network_interface].tx_bytes) / duration;
        if (isNaN(out_speed)) {
          invalid_data_flag = true;
          console.warn(`[NaN DETECTED] ${network_interface}/tx`, out_speed, dataJSON.net[network_interface], window.net[network_interface], duration);
        } else {
          const out_speed_str = formatsize(out_speed);
          $(`#net_${network_interface}_tx`).html(out_speed_str);
        }

        const in_speed = (dataJSON.net[network_interface].rx_bytes - window.net[network_interface].rx_bytes) / duration;
        if (isNaN(in_speed)) {
          invalid_data_flag = true;
          console.warn(`[NaN DETECTED] ${network_interface}/rx`, in_speed, dataJSON.net[network_interface], window.net[network_interface], duration);
        } else {
          const in_speed_str = formatsize(in_speed);
          $(`#net_${network_interface}_rx`).html(in_speed_str);
        }
      }
      if (!invalid_data_flag) {
        window.net = dataJSON.net;
        window.ts = dataJSON.ts;
      }
    },
    bootstrap: true,
    time: 1000
  }, {
    key: "UPTIME",
    url: "/node/up.php",
    id: "#uptime",
    bootstrap: true,
    time: 60000
  }, {
    key: "TOP",
    url: "/node/load.php",
    id: "#cpuload",
    bootstrap: true,
    time: 60000
  }, {
    key: "BANDWIDTH",
    url: "/node/bw_tables.php",
    url_template: "/node/bw_tables.php?page={0}",
    id: "#bw_tables",
    before: function () {
      const page = localStorage.getItem("bw_tables:page");
      if (page && page.length === 1 && "shdmt".includes(page)) {
        this.url = this.url_template.replace("{0}", page);
      }
      return true;
    },
    bootstrap: true,
    time: 60000
  }, {
    key: "DISK_USAGE",
    url: "/node/disk_data.php",
    id: "#disk_data",
    bootstrap: true,
    time: 15000
  }, {
    key: "RAM_USAGE",
    url: "/node/ram_stats.php",
    id: "#meterram",
    bootstrap: true,
    time: 10000
  }, {
    key: "SSH_OUTPUT",
    url: "/db/output.log",
    id: "#sshoutput",
    time: 500,
    _endOffset: -1,
    _requestLength: 65536,
    // eslint-disable-next-line no-unused-vars
    before: function (task) {
      if (!$("#sysResponse").is(":visible")) {
        return false;
      }
      const lengthQuery = "?length=" + this._requestLength;
      if (this._endOffset >= 0) {
        this.url = "/db/output.log?offset=" + this._endOffset + "&length=" + this._requestLength;
      } else {
        this.url = "/db/output.log" + lengthQuery;
      }
      return true;
    },
    override: function (response) {
      var el = $(this.id);
      if (typeof response === "object" && response !== null && "content" in response) {
        const previousEnd = this._endOffset;
        if (previousEnd < 0 || response.end < previousEnd || response.start > previousEnd) {
          el.text(response.content);
          this._endOffset = response.end;
        } else if (response.end > previousEnd && response.content) {
          const overlap = Math.max(0, previousEnd - response.start);
          const nextContent = overlap > 0 ? response.content.slice(overlap) : response.content;
          if (nextContent) {
            el.append(document.createTextNode(nextContent));
          }
          this._endOffset = response.end;
        }
      } else {
        el.text(response);
        this._endOffset = -1;
      }
      var container = $("#sysPre");
      container.scrollTop(container.prop("scrollHeight"));
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
  let bootstrap_dispatched = false;
  let request_seq = 0;

  function start_status_update () {
    const task_mapping = {};
    const pending_requests = {};
    const status_list = system_status_list.slice();
    for (let i = 0; i < status_list.length; ++i) {
      const status = status_list[i];
      if (status.key in task_mapping) {
        console.warn(`[ws] status config key: ${status.key} duplicated,`, status);
        continue;
      }
      task_mapping[status.key] = status;
    }

    function queueTask(task, delay) {
      setTimeout(function () {
        const request = Object.assign({}, task);
        if (request.before && typeof (request.before) === "function") {
          if (request.before(request) === false) {
            return;
          }
        }
        if ((request.id && $(request.id).length > 0) || request.override) {
          request.requestId = request.key + ":" + (++request_seq);
          pending_requests[request.requestId] = {
            request: request,
            task: task
          };
          socket.send(request);
        }
      }, delay);
    }

    function dispatchBootstrapTasks () {
      if (bootstrap_dispatched) {
        return;
      }
      bootstrap_dispatched = true;
      const bootstrapTasks = status_list.filter(function (task) { return task.bootstrap; });
      for (let i = 0; i < bootstrapTasks.length; ++i) {
        queueTask(bootstrapTasks[i], i * 50);
      }
      const batchTask = task_mapping.SERVICE_STATUS_ALL;
      if (batchTask) {
        queueTask(batchTask, bootstrapTasks.length * 50 + 100);
      }
    }

    // add event listener
    socket.on("message", function (response) {
      const pending = response.requestId ? pending_requests[response.requestId] : undefined;
      const request = pending ? pending.request : undefined;
      const task = pending ? pending.task : task_mapping[response.key];
      if (response.requestId) {
        delete pending_requests[response.requestId];
      }
      if (response.success) {
        if (task === undefined) {
          console.warn("[ws] task config not found,", response);
          return;
        }
        if (task.override && typeof (task.override) === "function") {
          task.override.call(task, response.response, response, request);
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

    socket.on("connect", function () {
      dispatchBootstrapTasks();
    });
    if (socket.connected) {
      dispatchBootstrapTasks();
    } else {
      setTimeout(function () {
        dispatchBootstrapTasks();
      }, 500);
    }

    // group task with time
    const task_info = groupBy(status_list, "time");
    for (const time_str in task_info) {
      const time_interval = parseInt(time_str);
      const task_list = task_info[time_str];
      const task_entity = function () {
        let delay = 0;
        for (let i = 0; i < task_list.length; ++i) {
          const task = task_list[i];
          if (first_request === true && (task.bootstrap || task.key === "SERVICE_STATUS_ALL")) {
            continue;
          }
          // set a delay for each task.
          queueTask(task, delay);
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
  // socket.emit("i18n", "zh");
})(window.jQuery);
