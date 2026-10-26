// SPDX-License-Identifier: GPL-3.0-or-later
// Dashboard homepage runtime logic extracted from dashboard-page.tsx.
/* global io */

(function () {
  let runtime = window.quickboxRuntime || {};
  let supported = Array.isArray(runtime.locales) && runtime.locales.length > 0
    ? runtime.locales.slice()
    : ["da", "de", "en", "es", "fr", "zh"];
  let aliases = { "zh-cn": "zh", "zh-hans-cn": "zh" };

  function normalizeLocale(value) {
    if (typeof value !== "string") { return "en"; }
    let normalized = value.toLowerCase().replace(/_/g, "-").replace(/^lang-/, "");
    normalized = aliases[normalized] || normalized;
    if (supported.indexOf(normalized) >= 0) { return normalized; }
    let primaryLocale = normalized.split("-")[0];
    return supported.indexOf(primaryLocale) >= 0 ? primaryLocale : "en";
  }

  function persistLocale(locale) {
    try {
      localStorage.setItem("quickbox:locale", locale);
    } catch (error) {
      console.warn("[ws] failed to persist locale", error);
    }
    let cookie = "quickbox_locale=" + encodeURIComponent(locale) + "; Path=/; SameSite=Lax";
    if (window.location.protocol === "https:") {
      cookie += "; Secure";
    }
    document.cookie = cookie;
  }

  let messages = (runtime && typeof runtime.messages === "object" && runtime.messages !== null) ? runtime.messages : {};
  window.quickboxApiBase = (runtime && typeof runtime.basePath === "string") ? runtime.basePath : "";
  window.quickboxLocale = normalizeLocale(runtime ? runtime.locale : undefined);
  window.quickboxMessages = Object.assign({
    enabled: "Enabled",
    disabled: "Disabled",
    serviceActionPending: "Working…",
    refresh: "Refresh",
    systemResponse: "System Response",
    serviceStatusUnconfirmed: "Status not confirmed",
    serviceStatusStale: "Status may be out of date",
    serviceStatusLastConfirmedTemplate: "Last confirmed __SERVICE_STATUS_TIME__"
  }, messages);
  persistLocale(window.quickboxLocale);

  window.quickboxSetLocale = function (locale) {
    window.quickboxLocale = normalizeLocale(locale);
    persistLocale(window.quickboxLocale);
    if (typeof window.quickboxResetWidgetState === "function") {
      window.quickboxResetWidgetState();
    }
    if (window.socket && window.socket.connected) {
      window.socket.emit("i18n", window.quickboxLocale);
    }
  };

  window.quickboxWidgetUrl = function (url) {
    let separator = url.indexOf("?") >= 0 ? "&" : "?";
    return window.quickboxApiBase + url + separator + "locale=" + encodeURIComponent(window.quickboxLocale);
  };
})();

(function () {
  let socket = io(location.origin, {
    path: (window.quickboxApiBase || "") + "/socket.io",
    upgrade: (window.quickboxRuntime || {}).socketUpgrade !== false
  });
  window.socket = socket;
  socket.on("connect", function () {
    socket.emit("i18n", window.quickboxLocale || "en");
  });

  function resetPanel() {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      let key = localStorage.key(i);
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var WRITE_SOURCE = { PREFETCH: 1, WS: 2 };
  var widgetWritePriority = {};

  function markWidgetWritten(selector, source) {
    if (!selector) { return; }
    widgetWritePriority[selector] = source;
  }

  function canWriteWidget(selector, source) {
    return Boolean(selector) && source >= (widgetWritePriority[selector] || 0);
  }

  function resetWidgetWriteState() {
    widgetWritePriority = {};
  }

  window.quickboxResetWidgetState = resetWidgetWriteState;

  let runtime = window.quickboxRuntime || {};
  let fallbackServiceKeys = [
    "authelia", "resilio-sync", "smbd", "deluged", "deluge-web", "denyhosts",
    "emby-server", "fail2ban", "filebrowser", "filebrowser-ee", "flexget", "flood",
    "jellyfin", "irssi", "netdata", "nfs-server", "tightvnc", "openvpn",
    "peerbanhelper", "plexmediaserver", "rclone-web", "rtorrent", "sabnzbd",
    "syncthing", "transmission", "qbittorrent", "qbittorrent-clientblocker",
    "webdav", "vsftpd", "vouch-proxy", "ttyd", "x2go", "znc"
  ];
  let serviceStatusItems = (Array.isArray(runtime.serviceKeys) && runtime.serviceKeys.length > 0
    ? runtime.serviceKeys
    : fallbackServiceKeys
  ).map(function (service) {
    return { service, id: "#appstat_" + service };
  });
  let lastServiceStatusResponse = {};
  let serviceStatusNextAllowedAt = 0;
  let serviceStatusFailureCount = 0;
  let serviceStatusRetryTimer = null;
  let serviceActionRequestSeq = 0;
  let serviceActionRequests = {};
  let pendingServiceActionByService = {};
  let reconcileServiceControlOnReconnect = false;

  function markServiceStatusesStale(service) {
    serviceStatusItems.forEach(function (item) {
      if (service && item.service !== service) return;
      let $status = window.jQuery(item.id);
      if ($status.length === 0) return;
      let messages = window.quickboxMessages || {};
      let unconfirmed = messages.serviceStatusUnconfirmed || "Status not confirmed";
      let staleLabel = messages.serviceStatusStale || "Status may be out of date";
      if ($status.find(".badge").length === 0) {
        let $unknown = window.jQuery("<span>").attr({ title: unconfirmed, "aria-label": unconfirmed });
        $unknown.append(window.jQuery("<span>").addClass("badge badge-service-unknown-dot badge-service-stale"));
        $unknown.append(window.jQuery("<span>").addClass("badge badge-service-unknown-pulse badge-service-stale"));
        $status.empty().append($unknown);
      } else {
        $status.find(".badge").addClass("badge-service-stale");
        let $badge = $status.find("span[data-observed-at]").first();
        if ($badge.length === 0) $badge = $status.children("span").first();
        let observedAt = Number($badge.attr("data-observed-at"));
        let title = unconfirmed;
        if (observedAt) {
          let time = new Date(observedAt).toLocaleString(window.quickboxLocale || undefined);
          let template = messages.serviceStatusLastConfirmedTemplate || "Last confirmed __SERVICE_STATUS_TIME__";
          let lastConfirmed = template.split("__SERVICE_STATUS_TIME__").join(time);
          title = staleLabel + "; " + lastConfirmed;
        }
        $badge.attr("title", title).attr("aria-label", title);
      }
      lastServiceStatusResponse[item.service] = $status.html() || "";
    });
  }


  function ensureServiceStatusPlaceholders() {
    serviceStatusItems.forEach(function (item) {
      let $status = window.jQuery(item.id);
      let cached = lastServiceStatusResponse[item.service];
      if ($status.length > 0 && $status.html() === "" && cached) {
        $status.html(cached);
      }
    });
  }

  function formatNetworkSpeed(length) {
    let suffixList = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
    let numeric = Number(length);
    let idx = 0;
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
    let badges = response.badges && typeof response.badges === "object" ? response.badges : response;
    Object.keys(badges).forEach(function (service) {
      if (pendingServiceActionByService[service]) return;
      if (badges[service] !== undefined && badges[service] !== "") {
        lastServiceStatusResponse[service] = badges[service];
      }
    });
    serviceStatusItems.forEach(function (item) {
      if (pendingServiceActionByService[item.service]) return;
      if (badges[item.service] !== undefined) {
        window.jQuery(item.id).html(badges[item.service] || lastServiceStatusResponse[item.service] || "");
      }
    });
    ensureServiceStatusPlaceholders();
  }

  function initializeServiceToggles() {
    ensureServiceStatusPlaceholders();
    window.jQuery(".toggle-en, .toggle-dis").each(function () {
      let $toggle = window.jQuery(this);
      if ($toggle.parent(".toggle-slide").length > 0 || $toggle.parent(".toggle-modern").length > 0) {
        return;
      }
      $toggle.toggles({
        on: $toggle.hasClass("toggle-en"),
        height: 26,
        width: 100,
        click: false,
        drag: false,
        text: {
          on: window.quickboxMessages.enabled,
          off: window.quickboxMessages.disabled
        }
      });
    });
    window.jQuery(".tooltips").tooltip();
  }

  function capturePackageTableState(task) {
    let $ = window.jQuery;
    if (!$ || !$.fn || !$.fn.DataTable || !$.fn.DataTable.isDataTable("#dataTable1")) {
      return;
    }
    let existing = $("#dataTable1").DataTable();
    let state = {
      page: existing.page(),
      search: existing.search(),
      order: existing.order(),
      length: existing.page.len()
    };
    existing.destroy();
    if (task) {
      task._tableState = state;
    }
  }

  function initializePackageTable(task) {
    let $ = window.jQuery;
    if (!$ || !$.fn || !$.fn.DataTable) {
      return;
    }
    let state = (task && task._tableState) || null;
    if ($.fn.DataTable.isDataTable("#dataTable1")) {
      let existing = $("#dataTable1").DataTable();
      state = state || {
        page: existing.page(),
        search: existing.search(),
        order: existing.order(),
        length: existing.page.len()
      };
      existing.destroy();
    }
    if (task) {
      task._tableState = null;
    }
    let table = $("#dataTable1").DataTable();
    $(table.table().container()).find("input[type='search']").attr({
      id: "dataTable1-search",
      name: "dataTable1-search"
    });
    if (!state) {
      $(".tooltips").tooltip({ container: "body" });
      return;
    }
    if (state.length) {
      table.page.len(state.length);
    }
    if (state.search) {
      table.search(state.search);
    }
    if (state.order && state.order.length > 0) {
      table.order(state.order);
    }
    table.draw(false);
    let page = state.page || 0;
    let pageCount = table.page.info().pages;
    if (pageCount > 0 && page > pageCount - 1) {
      page = pageCount - 1;
    }
    if (page > 0) {
      table.page(page).draw("page");
    }
    $(".tooltips").tooltip({ container: "body" });
  }

  function updateNetworkStatus(dataJSON) {
    if (window.ts === undefined || window.net === undefined) {
      window.net = dataJSON.net;
      window.ts = dataJSON.ts;
      return;
    }
    let duration = dataJSON.ts - window.ts;
    if (duration < 1e-5) {
      return;
    }
    let invalidData = false;
    Object.keys(dataJSON.net).forEach(function (networkInterface) {
      let ifaceCells = window.netInterfaceCells && window.netInterfaceCells[networkInterface];
      let previous = window.net[networkInterface];
      let current = dataJSON.net[networkInterface];
      if (!previous || !current) {
        invalidData = true;
        return;
      }
      let outSpeed = (current.tx_bytes - previous.tx_bytes) / duration;
      if (isNaN(outSpeed)) {
        invalidData = true;
        console.warn("[NaN DETECTED] " + networkInterface + "/tx", outSpeed, current, previous, duration);
      } else {
        if (ifaceCells && ifaceCells.tx) {
          ifaceCells.tx.textContent = formatNetworkSpeed(outSpeed);
        }
      }
      let inSpeed = (current.rx_bytes - previous.rx_bytes) / duration;
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

  function renderSshOutput(el, task, nextChunk, replaced) {
    let maxBytes = 1024 * 1024;
    if ((task._rawContent || "").length > maxBytes) {
      task._rawContent = task._rawContent.slice(-maxBytes);
      replaced = true;
    }
    if (!window.AnsiUp) {
      el.text(task._rawContent || "");
      return;
    }
    if (replaced || !task._ansi) {
      task._ansi = new window.AnsiUp();
      el.html(task._ansi.ansi_to_html(task._rawContent || ""));
      return;
    }
    if (nextChunk) {
      el.append(task._ansi.ansi_to_html(nextChunk));
    }
  }

  function updateSshOutput(task, response) {
    let container = document.getElementById("sysPre");
    let followOutput = container && container.scrollHeight - container.scrollTop - container.clientHeight <= 24;
    let el = window.jQuery(task.id);
    if (typeof response === "object" && response !== null && "content" in response) {
      let previousEnd = task._endOffset;
      let nextChunk = "";
      let epochChanged = response.epoch !== undefined && task._epoch !== response.epoch;
      let replaced = epochChanged;
      if (epochChanged || previousEnd < 0 || response.end < previousEnd || response.start > previousEnd) {
        task._rawContent = response.content;
        task._endOffset = response.end;
        replaced = true;
      } else if (response.end > previousEnd && response.content) {
        let overlap = Math.max(0, previousEnd - response.start);
        nextChunk = overlap > 0 ? response.content.slice(overlap) : response.content;
        if (nextChunk) {
          task._rawContent = (task._rawContent || "") + nextChunk;
        }
        task._endOffset = response.end;
      }
      if (response.epoch !== undefined) {
        task._epoch = response.epoch;
      }
      renderSshOutput(el, task, nextChunk, replaced);
    } else {
      task._rawContent = "";
      task._endOffset = -1;
      task._ansi = undefined;
      if (window.AnsiUp) {
        el.html(new window.AnsiUp().ansi_to_html(String(response || "")));
      } else {
        el.text(String(response || ""));
      }
    }
    if (container && followOutput) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // The log panel is a viewer with a session, not a window onto a persistent
  // buffer: every open starts from zero, so the cursor and the rendered DOM are
  // wiped first. startStatusUpdates() replaces this with the live implementation
  // once the SSH_OUTPUT task exists.
  let resetSshOutputCursor = function () {};

  // Force one polling task to run now, without reloading the document. Widgets
  // whose content follows a client-side choice (the bandwidth page) use this so
  // a choice swaps that widget's data and leaves the page exactly where it was.
  // startStatusUpdates() replaces this once the task registry exists.
  let requestTaskRefresh = function () {
    return false;
  };
  window.quickboxRefreshTask = function (key) {
    return requestTaskRefresh(key);
  };

  function resetSysResponseView() {
    resetSshOutputCursor();
    let output = document.getElementById("sshoutput");
    if (output) {
      output.textContent = "";
    }
    let container = document.getElementById("sysPre");
    if (container) {
      container.scrollTop = 0;
    }
  }

  function createStatusTasks() {
    let hasSsrServiceControl = window.jQuery("#service_control_widget [data-inner-id='panel-server-service-control']").length > 0;
    let hasSsrPackageManagement = window.jQuery("#pmc_widget [data-inner-id='panel-server-package-management']").length > 0;
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
        beforeHtml: capturePackageTableState,
        after: initializePackageTable,
        bootstrap: !hasSsrPackageManagement,
        time: 30000
      },
      {
        // Renders nothing while no operation holds the install lock, so the
        // banner appears and disappears on its own.
        key: "RUNNING_TASK",
        url: "/node/task_status",
        id: "#running_task_widget",
        bootstrap: true,
        time: 5000
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
          let page = localStorage.getItem("bw_tables:page");
          if (page && page.length === 1 && "hdmt".indexOf(page) >= 0) {
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
        _epoch: undefined,
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
          if (task._epoch !== undefined) {
            task.url += "&epoch=" + encodeURIComponent(task._epoch);
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
      let key = String(task.time);
      mapping[key] = mapping[key] || [];
      mapping[key].push(task);
      return mapping;
    }, {});
  }

  function startStatusUpdates() {
    let statusList = createStatusTasks();
    let taskMapping = {};
    let pendingRequests = {};
    let pendingRequestByKey = {};
    let firstRequest = true;
    function scheduleServiceStatusRetry(baseDelay) {
      serviceStatusFailureCount += 1;
      let exponentialDelay = Math.min(30000, 5000 * Math.pow(2, serviceStatusFailureCount - 1));
      let delay = Math.max(exponentialDelay, Number(baseDelay) || 0);
      serviceStatusNextAllowedAt = Date.now() + delay + Math.floor(Math.random() * 750);
      if (serviceStatusRetryTimer) clearTimeout(serviceStatusRetryTimer);
      let statusTask = taskMapping.SERVICE_STATUS_ALL;
      if (statusTask) serviceStatusRetryTimer = setTimeout(function () { queueTask(statusTask, 0); }, Math.max(0, serviceStatusNextAllowedAt - Date.now()));
    }
    let errorCountByKey = {};
    let stoppedKeys = {};
    let bootstrapDispatched = false;
    let requestSeq = 0;
    let pendingRequestTimeoutMs = 15000;
    let sshOutputTask;

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

    resetSshOutputCursor = function () {
      if (!sshOutputTask) {
        return;
      }
      sshOutputTask._rawContent = "";
      sshOutputTask._endOffset = -1;
      sshOutputTask._epoch = undefined;
      sshOutputTask._ansi = undefined;
    };

    requestTaskRefresh = function (key) {
      let task = taskMapping[key];
      if (!task) {
        return false;
      }
      if (key === "SERVICE_STATUS_ALL" && Date.now() < serviceStatusNextAllowedAt) return false;
      // Drop a request already in flight for this key: the answer it brings was
      // derived from the previous choice, so waiting for it would repaint the
      // widget with the old data and leave the new one pending a whole interval.
      let pendingRequestId = pendingRequestByKey[task.key];
      if (pendingRequestId) {
        clearPendingRequestById(pendingRequestId);
      }
      task._lastHtml = null;
      queueTask(task, 0);
      return true;
    };

    function clearPendingRequestById(requestId) {
      let pending = pendingRequests[requestId];
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
      let requestIds = Object.keys(pendingRequests);
      requestIds.forEach(clearPendingRequestById);
      if (requestIds.length > 0) {
        console.warn("[ws] cleared " + requestIds.length + " pending request(s): " + reason);
      }
    }

    function queueTask(task, delay) {
      setTimeout(function () {
        if (stoppedKeys[task.key]) {
          return;
        }
        if (!socket.connected) {
          return;
        }
        if (task.key === "SERVICE_STATUS_ALL" && Date.now() < serviceStatusNextAllowedAt) {
          return;
        }
        let request = Object.assign({}, task);
        if (request.before && typeof request.before === "function" && request.before(request) === false) {
          return;
        }
        if (!((request.id && window.jQuery(request.id).length > 0) || request.override)) {
          return;
        }
        let pendingRequestId = pendingRequestByKey[request.key];
        if (pendingRequestId && pendingRequests[pendingRequestId]) {
          return;
        }
        request.requestId = request.key + ":" + (++requestSeq);
        let timeoutId = setTimeout(function () {
          if (pendingRequests[request.requestId]) {
            console.warn("[ws] request timed out: " + request.requestId);
            clearPendingRequestById(request.requestId);
            if (socket.connected) {
              if (task.key === "SERVICE_STATUS_ALL") {
                markServiceStatusesStale();
                scheduleServiceStatusRetry();
              } else queueTask(task, 0);
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
      let bootstrapTasks = statusList.filter(function (task) { return task.bootstrap; });
      bootstrapTasks.forEach(function (task, index) {
        queueTask(task, index * 50);
      });
      if (taskMapping.SERVICE_STATUS_ALL) {
        queueTask(taskMapping.SERVICE_STATUS_ALL, bootstrapTasks.length * 50 + 100);
      }
    }

    socket.on("message", function (response) {
      let pending = response.requestId ? pendingRequests[response.requestId] : undefined;
      if (response.requestId && !pending) {
        return;
      }
      let request = pending ? pending.request : undefined;
      let task = pending ? pending.task : taskMapping[response.key];
      if (response.requestId) {
        clearPendingRequestById(response.requestId);
      }
      if (response.success) {
        if (!task) {
          console.warn("[ws] task config not found,", response);
          return;
        }
        if (errorCountByKey[task.key]) {
          errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
        }
        if (task.override && typeof task.override === "function") {
          task.override.call(task, response.response, response, request);
          if (task.key === "SERVICE_STATUS_ALL") {
            let health = response.response && response.response.health;
            if (health === "unavailable") {
              markServiceStatusesStale();
              scheduleServiceStatusRetry(Math.max(5000, Number(response.response.retryAfterMs) || 0));
            } else {
              serviceStatusFailureCount = 0;
              serviceStatusNextAllowedAt = Date.now() + 5000;
              if (serviceStatusRetryTimer) clearTimeout(serviceStatusRetryTimer);
              serviceStatusRetryTimer = setTimeout(function () { queueTask(task, 0); }, 5000);
            }
          }
          return;
        }
        if (task.id !== undefined) {
          if (!canWriteWidget(task.id, WRITE_SOURCE.WS)) {
            return;
          }
          if (task.key === "SERVICE_CONTROL" && Object.keys(pendingServiceActionByService).length > 0) {
            return;
          }
          if (task._lastHtml === response.response) {
            return;
          }
          task._lastHtml = response.response;
          if (task.beforeHtml && typeof task.beforeHtml === "function") {
            task.beforeHtml(task);
          }
          window.jQuery(task.id).html(response.response);
          markWidgetWritten(task.id, WRITE_SOURCE.WS);
          if (task.after && typeof task.after === "function") {
            task.after(task);
          }
        } else {
          console.warn("[ws] DOM id not found, status won't update,", response);
        }
      } else {
        let failedKey = (task && task.key) || response.key || "unknown";
        errorCountByKey[failedKey] = (errorCountByKey[failedKey] || 0) + 1;
        console.error("[ws] request failed,", response);
        if (failedKey === "SERVICE_STATUS_ALL") {
          markServiceStatusesStale();
          scheduleServiceStatusRetry();
        } else if (errorCountByKey[failedKey] > 32 && !stoppedKeys[failedKey]) {
          stoppedKeys[failedKey] = true;
          console.warn("[ws] stopping updates for " + failedKey);
          if (window.jQuery && window.jQuery.gritter) {
            window.jQuery.gritter.add({
              title: "QuickBox",
              text: "Stopped status updates for " + failedKey
            });
          }
        }
      }
    });

    socket.on("connect", function () {
      clearAllPendingRequests("socket reconnected");
      bootstrapDispatched = false;
      serviceStatusNextAllowedAt = 0;
      serviceStatusFailureCount = 0;
      if (serviceStatusRetryTimer) clearTimeout(serviceStatusRetryTimer);
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

    let taskInfo = groupByTime(statusList);
    Object.keys(taskInfo).forEach(function (timeString) {
      let timeInterval = parseInt(timeString, 10);
      let taskList = taskInfo[timeString];
      let taskEntity = function () {
        let delay = 0;
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
    let $ = window.jQuery;
    if (!$ || typeof $.fn.modal !== "function") {
      window.alert(message);
      return;
    }
    let modalId = "quickbox-alert-modal";
    let $modal = $("#" + modalId);
    let title = (window.quickboxMessages && window.quickboxMessages.systemResponse) || "System Response";
    if ($modal.length === 0) {
      $modal = $(
        "<div class='modal fade' id='" + modalId + "' tabindex='-1' role='dialog' aria-modal='true' aria-labelledby='quickbox-alert-title'>" +
          "<div class='modal-dialog'>" +
            "<div class='modal-content'>" +
              "<div class='modal-header'>" +
                "<h4 class='modal-title' id='quickbox-alert-title'>" + escapeHtml(title) + "</h4>" +
                "<button type='button' class='quickbox-modal-close' data-dismiss='modal' aria-label='Close'>" +
                  "<span aria-hidden='true'>&times;</span>" +
                "</button>" +
              "</div>" +
              "<div class='modal-body'></div>" +
              "<div class='modal-footer'>" +
                "<button type='button' class='btn btn-primary' data-dismiss='modal'>OK</button>" +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>"
      );
      $("body").append($modal);
    }
    $modal.find(".modal-title").text(title);
    $modal.find(".modal-body").html(message);
    $modal.modal("show");
  }

  function serviceActionRow(service) {
    return window.jQuery("#service_control_widget [data-service]")
      .filter(function () { return this.dataset.service === service; })
      .first()
      .closest("tr");
  }

  function setServiceActionPending(service, pending) {
    let $row = serviceActionRow(service);
    if ($row.length === 0) return;
    $row.toggleClass("service-action-pending", pending).attr("aria-busy", pending ? "true" : "false");
    $row.find("button[data-click-handler='serviceUpdate']").prop("disabled", pending);
    $row.find(".toggle-en, .toggle-dis").toggleClass("disabled", pending);
  }

  function updateServiceToggle(service, enabled) {
    let $toggle = serviceActionRow(service).find(".toggle-en, .toggle-dis").first();
    if ($toggle.length === 0) return;
    if (typeof enabled !== "boolean") enabled = $toggle.hasClass("toggle-en");
    $toggle.removeClass("toggle-en toggle-dis").addClass(enabled ? "toggle-en" : "toggle-dis");
    $toggle.attr("data-service-action", enabled ? "disable" : "enable");
    if ($toggle.data("toggles")) {
      $toggle.toggles(enabled);
    }
    $toggle.find(".toggle-on").text(window.quickboxMessages.enabled);
    $toggle.find(".toggle-off").text(window.quickboxMessages.disabled);
  }

  function setServiceTogglePending(service) {
    let $toggle = serviceActionRow(service).find(".toggle-en, .toggle-dis").first();
    if ($toggle.length === 0) return;
    let pendingText = window.quickboxMessages.serviceActionPending || "Working…";
    $toggle.find(".toggle-on, .toggle-off").text(pendingText);
  }

  socket.on("service-action-result", function (response) {
    if (!response || typeof response.requestId !== "string") return;
    let request = serviceActionRequests[response.requestId];
    if (!request || request.service !== response.service) return;
    if (response.phase === "action-complete") {
      request.actionComplete = true;
      markServiceStatusesStale(request.service);
      if (response.success === false) {
        request.failureShown = true;
        let message = escapeHtml(response.message || "Service action failed");
        if (response.failedOperation) message += "<br><code>systemctl " + escapeHtml(response.failedOperation) + "</code>";
        let output = response.stderr || response.stdout || "";
        if (output) {
          output = window.AnsiUp ? new window.AnsiUp().ansi_to_html(output) : escapeHtml(output);
          message += "<hr><div class='exec-output' style='display: inline-grid'>" + output + "</div>";
        }
        showAlert(message);
      }
      return;
    }
    delete serviceActionRequests[response.requestId];
    if (pendingServiceActionByService[request.service] === response.requestId) {
      delete pendingServiceActionByService[request.service];
      setServiceActionPending(request.service, false);
    }
    if (response.status) updateServiceStatus(response.status);
    updateServiceToggle(request.service, response.enabled);
    if (response.success === false && !request.failureShown) {
      let message = escapeHtml(response.message || "Service action failed");
      if (response.failedOperation) message += "<br><code>systemctl " + escapeHtml(response.failedOperation) + "</code>";
      let output = response.stderr || response.stdout || "";
      if (output) {
        output = window.AnsiUp ? new window.AnsiUp().ansi_to_html(output) : escapeHtml(output);
        message += "<hr><div class='exec-output' style='display: inline-grid'>" + output + "</div>";
      }
      showAlert(message);
    }
    if (response.statusError) {
      showAlert("The service action finished, but its current status could not be confirmed.");
    }
    requestTaskRefresh("SERVICE_CONTROL");
  });

  socket.on("disconnect", function () {
    let pendingServices = Object.keys(pendingServiceActionByService);
    if (pendingServices.length > 0) reconcileServiceControlOnReconnect = true;
    pendingServices.forEach(function (service) {
      let requestId = pendingServiceActionByService[service];
      delete pendingServiceActionByService[service];
      if (requestId) delete serviceActionRequests[requestId];
      setServiceActionPending(service, false);
      updateServiceToggle(service);
    });
  });

  socket.on("connect", function () {
    if (!reconcileServiceControlOnReconnect) return;
    reconcileServiceControlOnReconnect = false;
    requestTaskRefresh("SERVICE_CONTROL");
  });

  socket.on("exec", function (response) {
    if (response && response.success === false) {
      let message = escapeHtml(response.message || "");
      let output = response.stdout || response.stderr || "";
      if (window.AnsiUp) {
        output = new window.AnsiUp().ansi_to_html(output);
      } else {
        output = escapeHtml(output);
      }
      message = message + "<br><code>" + escapeHtml(response.cmd || "") + "</code>";
      if (output) {
        message += "<hr><div class='exec-output' style='display: inline-grid'>" + output + "</div>";
      }
      showAlert(message);
      return;
    }
    if (response && response.cmd && response.cmd.indexOf("box:lang") === 0) {
      location.reload();
    }
  });

  function exec(command) {
    if (typeof command !== "string") {
      showAlert("Invalid service parameter: '" + command + "'");
      return;
    }
    socket.emit("exec", command);
  }

  function closestDatasetTarget(initialTarget, datasetKey) {
    let target = initialTarget;
    while (target && target.dataset && target.dataset[datasetKey] === undefined) {
      target = target.parentElement;
    }
    return target;
  }

  function packageHandler(template) {
    return function (event) {
      let target = closestDatasetTarget(event.target, "package");
      if (!target || !target.dataset) {
        return;
      }
      exec(template + "::" + target.dataset.package);
    };
  }

  function serviceUpdateHandler(event) {
    let target = closestDatasetTarget(event.target, "service");
    if (!target || !target.dataset) {
      return;
    }
    let service = target.dataset.service;
    let action = target.dataset.serviceAction;
    if (!service || !action || pendingServiceActionByService[service]) return;
    let requestId = "SERVICE_ACTION:" + (++serviceActionRequestSeq);
    serviceActionRequests[requestId] = { service, action };
    pendingServiceActionByService[service] = requestId;
    setServiceActionPending(service, true);
    setServiceTogglePending(service);
    markServiceStatusesStale(service);
    socket.emit("service-action", {
      requestId,
      service,
      action,
      locale: window.quickboxLocale || "en"
    });
  }

  function boxHandler(event) {
    let target = closestDatasetTarget(event.target, "package");
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
    let wrapper = document.createElement("small");
    wrapper.appendChild(element);
    container.appendChild(wrapper);
  }

  function renderDashboardConfig(payload) {
    let langContainer = document.getElementById("node-language-options");
    let themeContainer = document.getElementById("node-theme-options");
    let bwContainer = document.getElementById("node-bw-page-options");

    if (langContainer && Array.isArray(payload.languages)) {
      langContainer.innerHTML = "";
      payload.languages.forEach(function (lang) {
        let option = document.createElement("div");
        option.style.cursor = "pointer";
        option.dataset.locale = lang.key;
        option.onclick = function () {
          window.quickboxSetLocale(lang.key);
          location.reload();
        };
        let img = document.createElement("img");
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
        let option = document.createElement("div");
        option.style.cursor = "pointer";
        option.setAttribute("data-toggle", "modal");
        option.setAttribute("data-target", "#themeSelect" + theme.file + "Confirm");
        let img = document.createElement("img");
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
        let option = document.createElement("div");
        option.style.cursor = "pointer";
        // Picking a bandwidth page changes one widget's data, nothing else:
        // re-request that widget instead of reloading the document, so the page
        // keeps its scroll position and the rest of the dashboard stays live.
        option.onclick = function () {
          localStorage.setItem("bw_tables:page", page.key);
          window.quickboxRefreshTask("BANDWIDTH");
        };
        option.textContent = page.title;
        appendSmallOption(bwContainer, option);
      });
    }
  }

  function renderNetworkInterfaces(interfaces) {
    let tbody = document.getElementById("node-network-interface-rows");
    if (!tbody) { return; }
    tbody.innerHTML = "";
    window.netInterfaceCells = {};
    if (!Array.isArray(interfaces) || !interfaces.length) {
      let emptyRow = document.createElement("tr");
      let emptyCell = document.createElement("td");
      emptyCell.colSpan = 3;
      emptyCell.style.fontSize = "11px";
      emptyCell.style.padding = "4px 4px 4px 12px";
      emptyCell.textContent = "N/A";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }
    interfaces.forEach(function (iface) {
      let row = document.createElement("tr");

      let ifaceCell = document.createElement("td");
      ifaceCell.style.fontSize = "14px";
      ifaceCell.style.fontWeight = "bold";
      ifaceCell.style.padding = "2px 2px 2px 12px";
      ifaceCell.textContent = String(iface);

      let txCell = document.createElement("td");
      txCell.style.fontSize = "11px";
      txCell.style.padding = "2px 2px 2px 12px";
      let txWrap = document.createElement("span");
      txWrap.className = "text-success";
      let txValue = document.createElement("span");
      txValue.textContent = "0B/s";
      txWrap.appendChild(txValue);
      txCell.appendChild(txWrap);

      let rxCell = document.createElement("td");
      rxCell.style.fontSize = "11px";
      rxCell.style.padding = "2px 2px 2px 12px";
      let rxWrap = document.createElement("span");
      rxWrap.className = "text-primary";
      let rxValue = document.createElement("span");
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
    let cpu = document.getElementById("node-cpu-static");
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

    // Pre-fetch widget data via HTTP for immediate display (before WebSocket is ready).
    function applyPrefetchHtml(selector, html) {
      if (!canWriteWidget(selector, WRITE_SOURCE.PREFETCH)) {
        return;
      }
      let $el = window.jQuery(selector);
      if (!$el.length) {
        return;
      }
      $el.html(html);
      markWidgetWritten(selector, WRITE_SOURCE.PREFETCH);
    }

    fetch(window.quickboxWidgetUrl("/node/load"), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r); })
      .then(function (html) { applyPrefetchHtml("#cpuload", html); })
      .catch(function () { /* WebSocket will fill in later */ });

    fetch(window.quickboxWidgetUrl("/node/disk_data"), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r); })
      .then(function (html) { applyPrefetchHtml("#disk_data", html); })
      .catch(function () { /* WebSocket will fill in later */ });

    fetch(window.quickboxWidgetUrl("/node/ram_stats"), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r); })
      .then(function (html) { applyPrefetchHtml("#meterram", html); })
      .catch(function () { /* WebSocket will fill in later */ });
  }

  // Two close affordances, one decision each, both taken on the spot: the footer
  // button hides the panel and reloads the page; the header X (and Escape) only
  // hides it. Nothing is remembered for later — there is no mode and no pending
  // reload, so a command finishing in the background can never move the page.
  let sysResponseClosing = false;

  function isSysResponseVisible() {
    return !!window.jQuery && window.jQuery("#sysResponse").is(":visible");
  }

  function closeSysResponsePanel(options) {
    let reload = !!(options && options.reload);
    if (sysResponseClosing) {
      return;
    }
    sysResponseClosing = true;
    if (window.jQuery) {
      window.jQuery("#sysResponse").modal("hide");
    }
    resetSysResponseView();
    if (reload) {
      location.reload();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    let psElements = document.querySelectorAll(".ps");
    if (typeof window.PerfectScrollbar === "function") {
      psElements.forEach(function (element) {
        new window.PerfectScrollbar(element);
      });
    } else {
      // Fallback: keep scrollable containers usable even if Perfect Scrollbar fails to load.
      psElements.forEach(function (element) {
        element.style.setProperty("overflow", "auto", "important");
      });
    }

    let reset = document.getElementById("node-panel-reset");
    if (reset) { reset.addEventListener("click", resetPanel); }

    // Every trigger opens the dialog through Bootstrap's data-toggle, so the
    // session reset hangs off the dialog's own event instead of each entry.
    if (window.jQuery) {
      let $sysResponse = window.jQuery("#sysResponse");
      if ($sysResponse.length) {
        $sysResponse.on("show.bs.modal", function () {
          sysResponseClosing = false;
          resetSysResponseView();
        });
        $sysResponse.on("hidden.bs.modal", function () {
          resetSysResponseView();
        });
      }
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" && event.key !== "Esc") { return; }
      if (!isSysResponseVisible()) { return; }
      event.preventDefault();
      closeSysResponsePanel({ reload: false });
    });

    document.addEventListener("click", function (event) {
      let target = event.target;
      if (!(target instanceof Element)) { return; }
      let themeButton = target.closest("[data-click-handler='themeSelect']");
      if (themeButton && themeButton instanceof HTMLElement && themeButton.dataset.theme) {
        applyDashboardTheme(themeButton.dataset.theme);
      }
      let packageInstallButton = target.closest("[data-click-handler='packageInstall']");
      if (packageInstallButton) {
        window.packageInstallHandler(event);
        return;
      }
      let packageRemoveButton = target.closest("[data-click-handler='packageRemove']");
      if (packageRemoveButton) {
        window.packageRemoveHandler(event);
        return;
      }
      let serviceUpdateButton = target.closest("[data-click-handler='serviceUpdate']");
      if (serviceUpdateButton) {
        window.serviceUpdateHandler(event);
        return;
      }
      let boxHandlerButton = target.closest("[data-click-handler='boxHandler']");
      if (boxHandlerButton) {
        window.boxHandler(event);
      }
      // The two closing affordances differ in exactly one bit: reload or not.
      if (target.closest("#sysResponseCloseAction")) {
        closeSysResponsePanel({ reload: true });
        return;
      }
      if (target.closest("#sysResponseDismiss")) {
        closeSysResponsePanel({ reload: false });
        return;
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


