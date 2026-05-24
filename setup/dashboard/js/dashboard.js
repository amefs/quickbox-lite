// SPDX-License-Identifier: GPL-3.0-or-later
// Dashboard homepage runtime logic extracted from dashboard-page.tsx.
/* global io */

(function () {
  var runtime = window.quickboxRuntime || {};
  var supported = ["da", "de", "en", "es", "fr", "zh"];
  var aliases = { "zh-cn": "zh", "zh-hans-cn": "zh" };

  function normalizeLocale(value) {
    if (typeof value !== "string") { return "en"; }
    var normalized = value.toLowerCase().replace(/_/g, "-").replace(/^lang-/, "");
    normalized = aliases[normalized] || normalized;
    if (supported.indexOf(normalized) >= 0) { return normalized; }
    var primaryLocale = normalized.split("-")[0];
    return supported.indexOf(primaryLocale) >= 0 ? primaryLocale : "en";
  }

  function persistLocale(locale) {
    localStorage.setItem("quickbox:locale", locale);
    document.cookie = "quickbox_locale=" + encodeURIComponent(locale) + "; Path=/; SameSite=Lax";
  }

  var messages = (runtime && typeof runtime.messages === "object" && runtime.messages !== null) ? runtime.messages : {};
  window.quickboxApiBase = (runtime && typeof runtime.basePath === "string") ? runtime.basePath : "";
  window.quickboxLocale = normalizeLocale(runtime ? runtime.locale : undefined);
  window.quickboxMessages = Object.assign({ enabled: "Enabled", disabled: "Disabled", refresh: "Refresh" }, messages);
  persistLocale(window.quickboxLocale);

  window.quickboxSetLocale = function (locale) {
    window.quickboxLocale = normalizeLocale(locale);
    persistLocale(window.quickboxLocale);
    if (window.socket && window.socket.connected) {
      window.socket.emit("i18n", window.quickboxLocale);
    }
  };

  window.quickboxWidgetUrl = function (url) {
    var separator = url.indexOf("?") >= 0 ? "&" : "?";
    return window.quickboxApiBase + url + separator + "locale=" + encodeURIComponent(window.quickboxLocale);
  };
})();

(function () {
  var socket = io(location.origin, { path: (window.quickboxApiBase || "") + "/socket.io" });
  window.socket = socket;
  socket.on("connect", function () {
    socket.emit("i18n", window.quickboxLocale || "en");
  });

  function resetPanel() {
    for (var i = localStorage.length - 1; i >= 0; i -= 1) {
      var key = localStorage.key(i);
      if (key && key.indexOf("lobipanel") === 0) {
        localStorage.removeItem(key);
      }
    }
    location.reload();
  }

  function fetchJson(url) {
    return fetch(window.quickboxWidgetUrl(url), { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) { throw new Error("Failed to fetch " + url); }
      return response.json();
    });
  }

  var serviceStatusItems = [
    { service: "resilio-sync", id: "#appstat_resilio-sync" },
    { service: "smbd", id: "#appstat_smbd" },
    { service: "deluged", id: "#appstat_deluged" },
    { service: "deluge-web", id: "#appstat_deluge-web" },
    { service: "denyhosts", id: "#appstat_denyhosts" },
    { service: "emby-server", id: "#appstat_emby-server" },
    { service: "fail2ban", id: "#appstat_fail2ban" },
    { service: "filebrowser", id: "#appstat_filebrowser" },
    { service: "filebrowser-ee", id: "#appstat_filebrowser-ee" },
    { service: "flexget", id: "#appstat_flexget" },
    { service: "flood", id: "#appstat_flood" },
    { service: "jellyfin", id: "#appstat_jellyfin" },
    { service: "irssi", id: "#appstat_irssi" },
    { service: "netdata", id: "#appstat_netdata" },
    { service: "nfs-server", id: "#appstat_nfs-server" },
    { service: "tightvnc", id: "#appstat_tightvnc" },
    { service: "openvpn", id: "#appstat_openvpn" },
    { service: "peerbanhelper", id: "#appstat_peerbanhelper" },
    { service: "plexmediaserver", id: "#appstat_plexmediaserver" },
    { service: "rclone-web", id: "#appstat_rclone-web" },
    { service: "rtorrent", id: "#appstat_rtorrent" },
    { service: "sabnzbd", id: "#appstat_sabnzbd" },
    { service: "syncthing", id: "#appstat_syncthing" },
    { service: "transmission", id: "#appstat_transmission" },
    { service: "qbittorrent", id: "#appstat_qbittorrent" },
    { service: "qbittorrent-clientblocker", id: "#appstat_qbittorrent-clientblocker" },
    { service: "webdav", id: "#appstat_webdav" },
    { service: "vsftpd", id: "#appstat_vsftpd" },
    { service: "ttyd", id: "#appstat_ttyd" },
    { service: "x2go", id: "#appstat_x2go" },
    { service: "znc", id: "#appstat_znc" }
  ];
  var lastServiceStatusResponse = {};

  function ensureServiceStatusPlaceholders() {
    serviceStatusItems.forEach(function (item) {
      var $status = window.jQuery(item.id);
      var cached = lastServiceStatusResponse[item.service];
      if ($status.length > 0 && $status.html() === "" && cached) {
        $status.html(cached);
      }
    });
  }

  function formatNetworkSpeed(length) {
    var suffixList = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
    var numeric = Number(length);
    var idx = 0;
    if (!isFinite(numeric) || numeric <= 0) {
      return "0 B/s";
    }
    while (numeric >= 1024 && idx < suffixList.length - 1) {
      numeric /= 1024;
      idx += 1;
    }
    return numeric.toFixed(idx > 0 ? 2 : 0) + " " + suffixList[idx];
  }

  function updateServiceStatus(response) {
    if (!response || typeof response !== "object") {
      ensureServiceStatusPlaceholders();
      return;
    }
    Object.keys(response).forEach(function (service) {
      if (response[service] !== undefined && response[service] !== "") {
        lastServiceStatusResponse[service] = response[service];
      }
    });
    serviceStatusItems.forEach(function (item) {
      if (response[item.service] !== undefined) {
        window.jQuery(item.id).html(response[item.service] || lastServiceStatusResponse[item.service] || "");
      }
    });
    ensureServiceStatusPlaceholders();
  }

  function initializeServiceToggles() {
    ensureServiceStatusPlaceholders();
    window.jQuery(".toggle-en, .toggle-dis").each(function () {
      var $toggle = window.jQuery(this);
      if ($toggle.parent(".toggle-slide").length > 0 || $toggle.parent(".toggle-modern").length > 0) {
        return;
      }
      $toggle.toggles({
        on: $toggle.hasClass("toggle-en"),
        height: 26,
        width: 100,
        text: $toggle.hasClass("toggle-en") ? { on: window.quickboxMessages.enabled } : { off: window.quickboxMessages.disabled }
      });
    });
    window.jQuery(".tooltips").tooltip();
  }

  function initializePackageTable() {
    var $ = window.jQuery;
    var currentPage = 0;
    if ($.fn.DataTable.isDataTable("#dataTable1")) {
      currentPage = $("#dataTable1").DataTable().page();
      $("#dataTable1").DataTable().destroy();
    }
    var table = $("#dataTable1").DataTable();
    $(table.table().container()).find("input[type='search']").attr({
      id: "dataTable1-search",
      name: "dataTable1-search"
    });
    if (currentPage > 0) {
      table.page(currentPage).draw(false);
    }
    $(".tooltips").tooltip();
  }

  function updateNetworkStatus(dataJSON) {
    if (window.ts === undefined || window.net === undefined) {
      window.net = dataJSON.net;
      window.ts = dataJSON.ts;
      return;
    }
    var duration = dataJSON.ts - window.ts;
    if (duration < 1e-5) {
      return;
    }
    var invalidData = false;
    Object.keys(dataJSON.net).forEach(function (networkInterface) {
      var ifaceCells = window.netInterfaceCells && window.netInterfaceCells[networkInterface];
      var previous = window.net[networkInterface];
      var current = dataJSON.net[networkInterface];
      if (!previous || !current) {
        invalidData = true;
        return;
      }
      var outSpeed = (current.tx_bytes - previous.tx_bytes) / duration;
      if (isNaN(outSpeed)) {
        invalidData = true;
        console.warn("[NaN DETECTED] " + networkInterface + "/tx", outSpeed, current, previous, duration);
      } else {
        if (ifaceCells && ifaceCells.tx) {
          ifaceCells.tx.textContent = formatNetworkSpeed(outSpeed);
        }
      }
      var inSpeed = (current.rx_bytes - previous.rx_bytes) / duration;
      if (isNaN(inSpeed)) {
        invalidData = true;
        console.warn("[NaN DETECTED] " + networkInterface + "/rx", inSpeed, current, previous, duration);
      } else {
        if (ifaceCells && ifaceCells.rx) {
          ifaceCells.rx.textContent = formatNetworkSpeed(inSpeed);
        }
      }
    });
    if (!invalidData) {
      window.net = dataJSON.net;
      window.ts = dataJSON.ts;
    }
  }

  function updateSshOutput(task, response) {
    var el = window.jQuery(task.id);
    if (typeof response === "object" && response !== null && "content" in response) {
      var previousEnd = task._endOffset;
      if (previousEnd < 0 || response.end < previousEnd || response.start > previousEnd) {
        task._rawContent = response.content;
        task._endOffset = response.end;
      } else if (response.end > previousEnd && response.content) {
        var overlap = Math.max(0, previousEnd - response.start);
        var nextContent = overlap > 0 ? response.content.slice(overlap) : response.content;
        if (nextContent) {
          task._rawContent = (task._rawContent || "") + nextContent;
        }
        task._endOffset = response.end;
      }
      var display = task._rawContent || "";
      if (window.AnsiUp) {
        display = new window.AnsiUp().ansi_to_html(display);
      }
      el.html(display);
    } else {
      task._rawContent = "";
      task._endOffset = -1;
      var display = response;
      if (window.AnsiUp) {
        display = new window.AnsiUp().ansi_to_html(display);
      }
      el.html(display);
    }
    var container = document.getElementById("sysPre");
    if (window.__psSysPre) {
      window.__psSysPre.update();
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function createStatusTasks() {
    var hasSsrServiceControl = window.jQuery("#service_control_widget [data-inner-id='panel-server-service-control']").length > 0;
    var hasSsrPackageManagement = window.jQuery("#pmc_widget [data-inner-id='panel-server-package-management']").length > 0;
    return [
      {
        key: "SERVICE_STATUS_ALL",
        url: "/node/service_status_all",
        override: updateServiceStatus,
        bootstrap: false,
        time: 5000
      },
      {
        key: "SERVICE_CONTROL",
        url: "/node/service_control",
        id: "#service_control_widget",
        after: initializeServiceToggles,
        bootstrap: !hasSsrServiceControl,
        time: 15000
      },
      {
        key: "PMC",
        url: "/node/pmc",
        id: "#pmc_widget",
        after: initializePackageTable,
        bootstrap: !hasSsrPackageManagement,
        time: 30000
      },
      {
        key: "NETWORK",
        url: "/node/net_status",
        override: updateNetworkStatus,
        bootstrap: true,
        time: 1000
      },
      { key: "UPTIME", url: "/node/up", id: "#uptime", bootstrap: true, time: 60000 },
      { key: "TOP", url: "/node/load", id: "#cpuload", bootstrap: true, time: 60000 },
      {
        key: "BANDWIDTH",
        url: "/node/bw_tables",
        urlTemplate: "/node/bw_tables?page={0}",
        id: "#bw_tables",
        before: function (task) {
          var page = localStorage.getItem("bw_tables:page");
          if (page && page.length === 1 && "shdmt".indexOf(page) >= 0) {
            task.url = task.urlTemplate.replace("{0}", page);
          }
          return true;
        },
        bootstrap: true,
        time: 60000
      },
      { key: "DISK_USAGE", url: "/node/disk_data", id: "#disk_data", bootstrap: true, time: 15000 },
      { key: "RAM_USAGE", url: "/node/ram_stats", id: "#meterram", bootstrap: true, time: 10000 },
      {
        key: "SSH_OUTPUT",
        url: "/db/output.log",
        id: "#sshoutput",
        time: 2000,
        _endOffset: -1,
        _requestLength: 65536,
        before: function (task) {
          if (!window.jQuery("#sysResponse").is(":visible")) {
            return false;
          }
          if (task._endOffset >= 0) {
            task.url = "/db/output.log?offset=" + task._endOffset + "&length=" + task._requestLength;
          } else {
            task.url = "/db/output.log?length=" + task._requestLength;
          }
          return true;
        },
        override: function (response) {
          updateSshOutput(this, response);
        }
      }
    ];
  }

  function groupByTime(tasks) {
    return tasks.reduce(function (mapping, task) {
      var key = String(task.time);
      mapping[key] = mapping[key] || [];
      mapping[key].push(task);
      return mapping;
    }, {});
  }

  function startStatusUpdates() {
    var statusList = createStatusTasks();
    var taskMapping = {};
    var pendingRequests = {};
    var pendingRequestByKey = {};
    var firstRequest = true;
    var errorCount = 0;
    var bootstrapDispatched = false;
    var requestSeq = 0;
    var pendingRequestTimeoutMs = 15000;
    var sshOutputTask;

    statusList.forEach(function (task) {
      if (task.key in taskMapping) {
        console.warn("[ws] status config key: " + task.key + " duplicated,", task);
        return;
      }
      taskMapping[task.key] = task;
      if (task.key === "SSH_OUTPUT") {
        sshOutputTask = task;
      }
    });

    function clearPendingRequestById(requestId) {
      var pending = pendingRequests[requestId];
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeoutId);
      if (pendingRequestByKey[pending.task.key] === requestId) {
        delete pendingRequestByKey[pending.task.key];
      }
      delete pendingRequests[requestId];
    }

    function clearAllPendingRequests(reason) {
      var requestIds = Object.keys(pendingRequests);
      requestIds.forEach(clearPendingRequestById);
      if (requestIds.length > 0) {
        console.warn("[ws] cleared " + requestIds.length + " pending request(s): " + reason);
      }
    }

    function queueTask(task, delay) {
      setTimeout(function () {
        var request = Object.assign({}, task);
        if (request.before && typeof request.before === "function" && request.before(request) === false) {
          return;
        }
        if (!((request.id && window.jQuery(request.id).length > 0) || request.override)) {
          return;
        }
        var pendingRequestId = pendingRequestByKey[request.key];
        if (pendingRequestId && pendingRequests[pendingRequestId]) {
          return;
        }
        request.requestId = request.key + ":" + (++requestSeq);
        var timeoutId = setTimeout(function () {
          if (pendingRequests[request.requestId]) {
            console.warn("[ws] request timed out: " + request.requestId);
            clearPendingRequestById(request.requestId);
            if (socket.connected) {
              queueTask(task, 0);
            }
          }
        }, pendingRequestTimeoutMs);
        pendingRequests[request.requestId] = {
          request,
          task,
          timeoutId
        };
        pendingRequestByKey[request.key] = request.requestId;
        request.locale = window.quickboxLocale || "en";
        socket.send(request);
      }, delay);
    }

    function dispatchBootstrapTasks() {
      if (bootstrapDispatched) {
        return;
      }
      bootstrapDispatched = true;
      var bootstrapTasks = statusList.filter(function (task) { return task.bootstrap; });
      bootstrapTasks.forEach(function (task, index) {
        queueTask(task, index * 50);
      });
      if (taskMapping.SERVICE_STATUS_ALL) {
        queueTask(taskMapping.SERVICE_STATUS_ALL, bootstrapTasks.length * 50 + 100);
      }
    }

    socket.on("message", function (response) {
      var pending = response.requestId ? pendingRequests[response.requestId] : undefined;
      var request = pending ? pending.request : undefined;
      var task = pending ? pending.task : taskMapping[response.key];
      if (response.requestId) {
        clearPendingRequestById(response.requestId);
      }
      if (response.success) {
        if (!task) {
          console.warn("[ws] task config not found,", response);
          return;
        }
        if (task.override && typeof task.override === "function") {
          task.override.call(task, response.response, response, request);
          return;
        }
        if (task.id !== undefined) {
          window.jQuery(task.id).html(response.response);
          if (task.after && typeof task.after === "function") {
            task.after(task);
          }
        } else {
          console.warn("[ws] DOM id not found, status won't update,", response);
        }
      } else {
        errorCount += 1;
        console.error("[ws] request failed,", response);
      }
      if (errorCount > 256) {
        console.warn("[ws] too many errors, stop status update");
        socket.close();
      }
    });

    socket.on("connect", function () {
      clearAllPendingRequests("socket reconnected");
      bootstrapDispatched = false;
      dispatchBootstrapTasks();
      if (sshOutputTask && window.jQuery("#sysResponse").is(":visible")) {
        queueTask(sshOutputTask, 0);
      }
    });
    socket.on("disconnect", function () {
      clearAllPendingRequests("socket disconnected");
    });
    socket.on("connect_error", function () {
      clearAllPendingRequests("socket connect error");
    });

    if (socket.connected) {
      dispatchBootstrapTasks();
    }

    var taskInfo = groupByTime(statusList);
    Object.keys(taskInfo).forEach(function (timeString) {
      var timeInterval = parseInt(timeString, 10);
      var taskList = taskInfo[timeString];
      var taskEntity = function () {
        var delay = 0;
        taskList.forEach(function (task) {
          if (firstRequest === true && (task.bootstrap || task.key === "SERVICE_STATUS_ALL")) {
            return;
          }
          queueTask(task, delay);
          if (firstRequest === false) {
            delay += timeInterval / (taskList.length * 2);
          }
        });
      };
      window.Visibility.every(timeInterval, 10 * timeInterval, taskEntity);
      taskEntity();
    });
    firstRequest = false;
  }

  function showAlert(message) {
    if (window.bootbox && typeof window.bootbox.alert === "function") {
      window.bootbox.alert({
        message,
        backdrop: true,
        size: "large"
      });
      return;
    }
    window.alert(message);
  }

  socket.on("exec", function (response) {
    if (response && response.success === false) {
      var message = response.message || "";
      var output = response.stdout || response.stderr || "";
      output = output.replace(/\\u001b[()][B0UK]/g, "");
      if (window.AnsiUp) {
        output = new window.AnsiUp().ansi_to_html(output);
      }
      message = message + "<br><code>" + response.cmd + "</code>";
      if (output) {
        message += "<hr><div class='exec-output' style='display: inline-grid'>" + output + "</div>";
      }
      showAlert(message);
      return;
    }
    if (response && response.cmd && (response.cmd.indexOf("systemctl") === 0 || response.cmd.indexOf("box:lang") === 0)) {
      setTimeout(function () {
        location.reload();
      }, 100);
    }
  });

  function exec(command) {
    if (typeof command !== "string") {
      showAlert("Invalid service parameter: '" + command + "'");
      return;
    }
    socket.emit("exec", command);
  }

  function checkParameters(params) {
    if (!params || typeof params !== "object") {
      return true;
    }
    var missing = "";
    Object.keys(params).forEach(function (key) {
      if (!params[key]) {
        missing += "'" + key + "', ";
      }
    });
    missing = missing.replace(/, $/, "");
    if (missing) {
      showAlert("Parameter: " + missing + " required but not found");
      return false;
    }
    return true;
  }

  function closestDatasetTarget(initialTarget, datasetKey) {
    var target = initialTarget;
    while (target && target.dataset && target.dataset[datasetKey] === undefined) {
      target = target.parentElement;
    }
    return target;
  }

  function packageHandler(template) {
    return function (event) {
      if (!checkParameters({ event })) {
        return;
      }
      var target = event.target;
      if (!target || !target.dataset) {
        return;
      }
      exec(template + "::" + target.dataset.package);
    };
  }

  function serviceUpdateHandler(event) {
    if (!checkParameters({ event })) {
      return;
    }
    var target = closestDatasetTarget(event.target, "service");
    if (!target || !target.dataset) {
      return;
    }
    var service = target.dataset.service;
    var operations = target.dataset.operation || "";
    operations.split(",").forEach(function (operation) {
      exec("systemctl:" + operation + ":" + service);
    });
  }

  function boxHandler(event) {
    if (!checkParameters({ event })) {
      return;
    }
    var target = closestDatasetTarget(event.target, "package");
    if (!target || !target.dataset) {
      return;
    }
    exec("box:" + target.dataset.operation + ":" + target.dataset.package);
  }

  window.packageInstallHandler = packageHandler("installpackage");
  window.packageRemoveHandler = packageHandler("removepackage");
  window.serviceUpdateHandler = serviceUpdateHandler;
  window.boxHandler = boxHandler;

  function appendSmallOption(container, element) {
    if (!container) { return; }
    var wrapper = document.createElement("small");
    wrapper.appendChild(element);
    container.appendChild(wrapper);
  }

  function renderDashboardConfig(payload) {
    var langContainer = document.getElementById("node-language-options");
    var themeContainer = document.getElementById("node-theme-options");
    var bwContainer = document.getElementById("node-bw-page-options");

    if (langContainer && Array.isArray(payload.languages)) {
      langContainer.innerHTML = "";
      payload.languages.forEach(function (lang) {
        var option = document.createElement("div");
        option.style.cursor = "pointer";
        option.dataset.locale = lang.key;
        option.onclick = function () {
          window.quickboxSetLocale(lang.key);
          location.reload();
        };
        var img = document.createElement("img");
        img.className = "lang-flag";
        img.src = "/lang/flag_" + lang.file + ".png";
        img.alt = "";
        img.setAttribute("aria-hidden", "true");
        option.appendChild(img);
        option.appendChild(document.createTextNode(lang.title));
        appendSmallOption(langContainer, option);
      });
    }

    if (themeContainer && Array.isArray(payload.themes)) {
      themeContainer.innerHTML = "";
      payload.themes.forEach(function (theme) {
        var option = document.createElement("div");
        option.style.cursor = "pointer";
        option.setAttribute("data-toggle", "modal");
        option.setAttribute("data-target", "#themeSelect" + theme.file + "Confirm");
        var img = document.createElement("img");
        img.className = "lang-flag";
        img.src = "/img/themes/opt_" + theme.file + ".png";
        img.alt = "";
        img.setAttribute("aria-hidden", "true");
        option.appendChild(img);
        option.appendChild(document.createTextNode(theme.title));
        appendSmallOption(themeContainer, option);
      });
    }

    if (bwContainer && Array.isArray(payload.bwPages)) {
      bwContainer.innerHTML = "";
      payload.bwPages.forEach(function (page) {
        var option = document.createElement("div");
        option.style.cursor = "pointer";
        option.onclick = function () {
          localStorage.setItem("bw_tables:page", page.key);
          location.reload();
        };
        option.textContent = page.title;
        appendSmallOption(bwContainer, option);
      });
    }
  }

  function renderNetworkInterfaces(interfaces) {
    var tbody = document.getElementById("node-network-interface-rows");
    if (!tbody) { return; }
    tbody.innerHTML = "";
    window.netInterfaceCells = {};
    if (!Array.isArray(interfaces) || !interfaces.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 3;
      emptyCell.style.fontSize = "11px";
      emptyCell.style.padding = "4px 4px 4px 12px";
      emptyCell.textContent = "N/A";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }
    interfaces.forEach(function (iface) {
      var row = document.createElement("tr");

      var ifaceCell = document.createElement("td");
      ifaceCell.style.fontSize = "14px";
      ifaceCell.style.fontWeight = "bold";
      ifaceCell.style.padding = "2px 2px 2px 12px";
      ifaceCell.textContent = String(iface);

      var txCell = document.createElement("td");
      txCell.style.fontSize = "11px";
      txCell.style.padding = "2px 2px 2px 12px";
      var txWrap = document.createElement("span");
      txWrap.className = "text-success";
      var txValue = document.createElement("span");
      txValue.textContent = "0B/s";
      txWrap.appendChild(txValue);
      txCell.appendChild(txWrap);

      var rxCell = document.createElement("td");
      rxCell.style.fontSize = "11px";
      rxCell.style.padding = "2px 2px 2px 12px";
      var rxWrap = document.createElement("span");
      rxWrap.className = "text-primary";
      var rxValue = document.createElement("span");
      rxValue.textContent = "0B/s";
      rxWrap.appendChild(rxValue);
      rxCell.appendChild(rxWrap);

      row.appendChild(ifaceCell);
      row.appendChild(txCell);
      row.appendChild(rxCell);
      tbody.appendChild(row);

      window.netInterfaceCells[iface] = {
        tx: txValue,
        rx: rxValue
      };
    });
  }

  function renderSystemStatic(payload) {
    var cpu = document.getElementById("node-cpu-static");
    if (cpu && payload && payload.cpu) {
      cpu.innerHTML = payload.cpu.modelHtml + "<br/>[<span style='color:#999;font-weight:600'>x" + payload.cpu.count + "</span> core]";
    }
    renderNetworkInterfaces(payload ? payload.interfaces : []);
  }

  function applyDashboardTheme(theme) {
    fetch(window.quickboxApiBase + "/node/theme", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme })
    }).then(function (response) {
      if (!response.ok) { throw new Error("Failed to apply theme"); }
      location.reload();
    }).catch(function (error) {
      console.warn("[ws] failed to apply theme", error);
    });
  }

  function loadNodeFragments() {
    fetchJson("/node/dashboard_config").then(renderDashboardConfig).catch(function (error) {
      console.warn("[ws] failed to load dashboard config", error);
    });
    fetchJson("/node/system_static").then(renderSystemStatic).catch(function (error) {
      console.warn("[ws] failed to load static system info", error);
      renderNetworkInterfaces([]);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var psElements = document.querySelectorAll(".ps");
    if (typeof window.PerfectScrollbar === "function") {
      psElements.forEach(function (element) {
        var psInstance = new window.PerfectScrollbar(element);
        if (element.id === "sysPre") {
          window.__psSysPre = psInstance;
        }
      });
    } else {
      // Fallback: keep scrollable containers usable even if Perfect Scrollbar fails to load.
      psElements.forEach(function (element) {
        element.style.setProperty("overflow", "auto", "important");
      });
    }

    var reset = document.getElementById("node-panel-reset");
    if (reset) { reset.addEventListener("click", resetPanel); }
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof Element)) { return; }
      var themeButton = target.closest("[data-click-handler='themeSelect']");
      if (themeButton && themeButton instanceof HTMLElement && themeButton.dataset.theme) {
        applyDashboardTheme(themeButton.dataset.theme);
      }
      var packageInstallButton = target.closest("[data-click-handler='packageInstall']");
      if (packageInstallButton) {
        window.packageInstallHandler(event);
        return;
      }
      var packageRemoveButton = target.closest("[data-click-handler='packageRemove']");
      if (packageRemoveButton) {
        window.packageRemoveHandler(event);
        return;
      }
      var serviceUpdateButton = target.closest("[data-click-handler='serviceUpdate']");
      if (serviceUpdateButton) {
        window.serviceUpdateHandler(event);
        return;
      }
      var boxHandlerButton = target.closest("[data-click-handler='boxHandler']");
      if (boxHandlerButton) {
        window.boxHandler(event);
        if (boxHandlerButton instanceof HTMLElement && boxHandlerButton.dataset.refreshAfterClose === "true") {
          setTimeout(function () {
            location.reload();
          }, 150);
        }
      }
    });
    loadNodeFragments();
    if (window.jQuery) {
      window.jQuery(function ($) {
        $(".tooltips").tooltip({ container: "body" });
        initializeServiceToggles();
        initializePackageTable();
      });
    }
    if (window.Visibility) {
      window.Visibility.afterPrerendering(startStatusUpdates);
    } else {
      startStatusUpdates();
    }
  });
})();


