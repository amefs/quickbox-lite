// SPDX-License-Identifier: GPL-3.0-or-later
// Dashboard homepage runtime logic extracted from dashboard-page.tsx.
/* global io */

(function () {
  let runtime = window.quickboxRuntime;
  let supported = runtime.locales.slice();
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

  let messages = runtime.messages;
  window.quickboxApiBase = runtime.basePath;
  window.quickboxLocale = normalizeLocale(runtime.locale);
  window.quickboxMessages = Object.assign({ enabled: "Enabled", disabled: "Disabled", refresh: "Refresh", systemResponse: "System Response" }, messages);
  persistLocale(window.quickboxLocale);

  window.quickboxSetLocale = function (locale) {
    window.quickboxLocale = normalizeLocale(locale);
    window.quickboxServiceIsland.onLocaleChanged(window.quickboxLocale);
    persistLocale(window.quickboxLocale);
    window.quickboxResetWidgetState();
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
    path: window.quickboxApiBase + "/socket.io",
    upgrade: window.quickboxRuntime.socketUpgrade !== false
  });
  window.socket = socket;
  window.quickboxServiceIsland.bindTransport({
    isConnected: function () { return socket.connected; },
    sendMessage: function (request) { socket.send(request); },
    executeServiceAction: function (request) { socket.emit("service-action", request); },
    notifyStopped: function (key) {
      console.warn("[ws] stopping updates for " + key);
      if (window.jQuery && window.jQuery.gritter) {
        window.jQuery.gritter.add({ title: "QuickBox", text: "Stopped status updates for " + key });
      }
    }
  });
  socket.on("connect", function () {
    socket.emit("i18n", window.quickboxLocale || "en");
  });
  socket.on("service-action-result", function (response) {
    window.quickboxServiceIsland.onActionResult(response);
  });

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

  // Component write ordering. A widget can be filled by the HTTP pre-fetch or by
  // the WebSocket stream; the newest WebSocket payload must always win, so every
  // write records its source instead of inferring readiness from the DOM.
  var widgetWriteSource = {};

  function markWidgetWritten(selector, source) {
    if (!selector) { return; }
    widgetWriteSource[selector] = source;
    var element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      element.dataset.qbWriteSource = source;
    }
  }

  function widgetWriteSourceOf(selector) {
    if (Object.prototype.hasOwnProperty.call(widgetWriteSource, selector)) {
      return widgetWriteSource[selector];
    }
    var element = document.querySelector(selector);
    if (element instanceof HTMLElement && element.dataset.qbWriteSource) {
      return element.dataset.qbWriteSource;
    }
    return "";
  }

  function resetWidgetWriteState() {
    widgetWriteSource = {};
    Array.prototype.forEach.call(document.querySelectorAll("[data-qb-write-source]"), function (element) {
      delete element.dataset.qbWriteSource;
    });
  }

  window.quickboxResetWidgetState = resetWidgetWriteState;

  function createStatusTasks() {
    let tasks = [
      {
        key: "NETWORK",
        url: "/node/net_status",
        bootstrap: true,
        time: 1000
      },
      { key: "UPTIME", url: "/node/migration/system_uptime", id: "#uptime", bootstrap: true, time: 60000 },
      { key: "TOP", url: "/node/migration/system_load", id: "#cpuload", bootstrap: true, time: 60000 },
      {
        key: "BANDWIDTH",
        url: "/node/migration/bandwidth",
        urlTemplate: "/node/migration/bandwidth?page={0}",
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
      { key: "DISK_USAGE", url: "/node/migration/disk_data", id: "#disk_data", bootstrap: true, time: 15000 },
      { key: "RAM_USAGE", url: "/node/migration/ram_stats", id: "#meterram", bootstrap: true, time: 10000 },
      { key: "TASK_STATUS", url: "/node/task_status", id: "#running_task_widget", bootstrap: true, time: 5000 },
      {
        key: "SSH_OUTPUT",
        url: "/db/output.log",
        id: "#sshoutput",
        time: 2000,
        before: function (task) {
          if (!window.quickboxSystemResponseIsland.isOpen()) {
            return false;
          }
          let cursor = window.quickboxSystemResponseIsland.getOutputCursor();
          let endOffset = cursor.end;
          let epoch = cursor.epoch;
          let requestLength = 65536;
          if (endOffset >= 0) {
            task.url = "/db/output.log?offset=" + endOffset + "&length=" + requestLength;
          } else {
            task.url = "/db/output.log?length=" + requestLength;
          }
          if (epoch !== undefined) {
            task.url += "&epoch=" + encodeURIComponent(epoch);
          }
          return true;
        },
        override: function (response) {
          window.quickboxSystemResponseIsland.onMessage(response);
        }
      }
    ];
    let packageManagementTask = {
        key: "PMC",
        url: "/node/migration/pmc",
        id: "#pmc_widget",
        bootstrap: false,
        time: 30000,
        override: function (data, response, request) {
          let matchesPending = request && response.key === packageManagementTask.key &&
            response.url === request.url && response.requestId === request.requestId;
          if (matchesPending && window.quickboxPackageManagementIsland.onMessage(data)) {
            markWidgetWritten("#pmc_widget", "ws");
          } else {
            console.warn("[ws] ignored uncorrelated or invalid package-management response,", response);
          }
        }
    };
    tasks.unshift(packageManagementTask);
    return tasks;
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
        let request = Object.assign({}, task);
        if (request.before && typeof request.before === "function" && request.before(request) === false) {
          return;
        }
        if (request.id && !document.querySelector(request.id)) {
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

    window.addEventListener("quickbox:bandwidth-page-change", function () {
      let task = taskMapping.BANDWIDTH;
      if (!task) { return; }
      let pendingRequestId = pendingRequestByKey.BANDWIDTH;
      if (pendingRequestId) {
        clearPendingRequestById(pendingRequestId);
      }
      queueTask(task, 0);
    });

    function dispatchBootstrapTasks() {
      if (bootstrapDispatched) {
        return;
      }
      bootstrapDispatched = true;
      let bootstrapTasks = statusList.filter(function (task) { return task.bootstrap; });
      bootstrapTasks.forEach(function (task, index) {
        queueTask(task, index * 50);
      });
      let serviceStatusDelay = bootstrapTasks.length * 50 + 100;
      window.quickboxServiceIsland.onConnected(serviceStatusDelay);
    }

    socket.on("message", function (response) {
      if (response && response.meta && response.meta.protocolVersion === 2) {
        window.quickboxServiceIsland.onMessage(response);
        return;
      }
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
        if (task.key === "TOP" || task.key === "UPTIME") {
          let matchesPending = request && response.key === task.key && response.url === request.url && response.requestId === request.requestId;
          if (matchesPending && window.quickboxSystemSummaryIsland.onMessage(task.key, response.response)) {
            if (errorCountByKey[task.key]) {
              errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
            }
            markWidgetWritten(task.id, "ws");
          } else {
            console.warn("[ws] ignored uncorrelated or invalid system summary response,", response);
          }
          return;
        }
        if (task.key === "NETWORK") {
          let matchesPending = request && response.key === task.key && response.url === request.url && response.requestId === request.requestId;
          if (matchesPending && window.quickboxNetworkIsland.onMessage(response.response)) {
            if (errorCountByKey[task.key]) {
              errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
            }
          } else {
            console.warn("[ws] ignored uncorrelated or invalid network response,", response);
          }
          return;
        }
        if (task.key === "BANDWIDTH") {
          let matchesPending = request && response.key === task.key && response.url === request.url && response.requestId === request.requestId;
          if (matchesPending && window.quickboxBandwidthIsland.onMessage(response.response)) {
            if (errorCountByKey[task.key]) {
              errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
            }
          } else {
            console.warn("[ws] ignored uncorrelated or invalid bandwidth response,", response);
          }
          return;
        }
        if (task.key === "RAM_USAGE") {
          let matchesPending = request && response.key === task.key && response.url === request.url && response.requestId === request.requestId;
          if (matchesPending && window.quickboxMemoryStatsIsland.onMessage(response.response)) {
            if (errorCountByKey[task.key]) {
              errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
            }
            markWidgetWritten(task.id, "ws");
          } else {
            console.warn("[ws] ignored uncorrelated or invalid memory response,", response);
          }
          return;
        }
        if (task.key === "DISK_USAGE") {
          let matchesPending = request && response.key === task.key && response.url === request.url && response.requestId === request.requestId;
          if (matchesPending && window.quickboxDiskDataIsland.onMessage(response.response)) {
            if (errorCountByKey[task.key]) {
              errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
            }
            markWidgetWritten(task.id, "ws");
          } else {
            console.warn("[ws] ignored uncorrelated or invalid disk response,", response);
          }
          return;
        }
        if (errorCountByKey[task.key]) {
          errorCountByKey[task.key] = Math.max(0, errorCountByKey[task.key] - 1);
        }
        if (task.override && typeof task.override === "function") {
          task.override.call(task, response.response, response, request);
          return;
        }
        if (task.key === "TASK_STATUS") {
          if (task._lastHtml === response.response) {
            return;
          }
          task._lastHtml = response.response;
          let element = document.querySelector(task.id);
          if (element instanceof HTMLElement) {
            element.innerHTML = response.response;
            markWidgetWritten(task.id, "ws");
          }
          return;
        }
        console.warn("[ws] response has no dashboard handler,", response);
      } else {
        let failedKey = (task && task.key) || response.key || "unknown";
        errorCountByKey[failedKey] = (errorCountByKey[failedKey] || 0) + 1;
        console.error("[ws] request failed,", response);
        if (errorCountByKey[failedKey] > 32 && !stoppedKeys[failedKey]) {
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
      errorCountByKey = {};
      stoppedKeys = {};
      bootstrapDispatched = false;
      dispatchBootstrapTasks();
      if (sshOutputTask && window.quickboxSystemResponseIsland.isOpen()) {
        queueTask(sshOutputTask, 0);
      }
    });
    socket.on("disconnect", function () {
      clearAllPendingRequests("socket disconnected");
      window.quickboxServiceIsland.onDisconnected();
    });
    socket.on("connect_error", function () {
      clearAllPendingRequests("socket connect error");
      window.quickboxServiceIsland.onDisconnected();
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
          if (firstRequest === true && task.bootstrap) {
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
    window.quickboxSystemResponseIsland.showAlert(message);
  }

  let inflightExecCount = 0;
  let reloadAfterExec = false;

  function maybeReloadAfterExec() {
    if (reloadAfterExec && inflightExecCount <= 0) {
      location.reload();
    }
  }

  socket.on("exec", function (response) {
    inflightExecCount = Math.max(0, inflightExecCount - 1);
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
      maybeReloadAfterExec();
      return;
    }
    if (response && response.cmd && (response.cmd.indexOf("systemctl") === 0 || response.cmd.indexOf("box:lang") === 0)) {
      reloadAfterExec = true;
    }
    maybeReloadAfterExec();
  });

  function exec(command) {
    if (typeof command !== "string") {
      showAlert("Invalid service parameter: '" + command + "'");
      return;
    }
    inflightExecCount += 1;
    socket.emit("exec", command);
  }

  window.addEventListener("quickbox:branch-switch", function (event) {
    let detail = event && event.detail;
    let branch = detail && detail.branch;
    if (typeof branch !== "string" || !branch || branch.charAt(0) === "-" || branch.indexOf(":") >= 0) {
      return;
    }
    for (let index = 0; index < branch.length; index += 1) {
      let code = branch.charCodeAt(index);
      if (code <= 32 || code === 127) { return; }
    }
    exec("box:switch-branch:" + branch);
  });

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
    let operations = target.dataset.operation || "";
    operations.split(",").forEach(function (operation) {
      exec("systemctl:" + operation + ":" + service);
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

  function renderNetworkInterfaces(interfaces) {
    if (!window.quickboxNetworkIsland.onInterfaces(interfaces)) {
      console.warn("[ws] ignored invalid network interface list", interfaces);
    }
  }

  function renderSystemStatic(payload) {
    if (payload && payload.cpu && !window.quickboxCpuStatusIsland.onMessage(payload.cpu)) {
      console.warn("[ws] ignored invalid CPU status response", payload.cpu);
    }
    renderNetworkInterfaces(payload ? payload.interfaces : []);
  }

  function loadNodeFragments() {
    fetchJson("/node/migration/system_static").then(renderSystemStatic).catch(function (error) {
      console.warn("[ws] failed to load static system info", error);
    });

    // Pre-fetch widget data via HTTP for immediate display (before WebSocket is ready).
    // A pre-fetch never overwrites a payload the WebSocket already delivered, and
    // no longer infers readiness from the presence of child nodes (the CPU load
    // widget is text only).
    fetchJson("/node/migration/system_load").then(function (data) {
      if (widgetWriteSourceOf("#cpuload") !== "") {
        return;
      }
      if (window.quickboxSystemSummaryIsland.onPrefetch(data)) {
        markWidgetWritten("#cpuload", "prefetch");
      }
    }).catch(function () { /* WebSocket will fill in later */ });

    fetchJson("/node/migration/disk_data").then(function (data) {
      if (widgetWriteSourceOf("#disk_data") !== "") {
        return;
      }
      if (window.quickboxDiskDataIsland.onPrefetch(data)) {
        markWidgetWritten("#disk_data", "prefetch");
      }
    }).catch(function () { /* WebSocket will fill in later */ });

    fetchJson("/node/migration/ram_stats").then(function (data) {
      if (widgetWriteSourceOf("#meterram") !== "") {
        return;
      }
      if (window.quickboxMemoryStatsIsland.onPrefetch(data)) {
        markWidgetWritten("#meterram", "prefetch");
      }
    }).catch(function () { /* WebSocket will fill in later */ });
  }

  window.quickboxPackageManagementActions = {
    run: function (action, packageName) {
      if ((action !== "install" && action !== "remove") || typeof packageName !== "string") {
        return;
      }
      window.quickboxSystemResponseIsland.open();
      exec((action === "install" ? "installpackage::" : "removepackage::") + packageName);
    }
  };
  document.addEventListener("DOMContentLoaded", function () {
    document.addEventListener("click", function (event) {
      let target = event.target;
      if (!(target instanceof Element)) { return; }
      let sysResponseTrigger = target.closest("[data-target='#sysResponse'], [data-qb-system-response]");
      if (sysResponseTrigger instanceof HTMLElement) {
        window.quickboxSystemResponseIsland.open();
      }
      let taskAbortButton = target.closest("[data-task-abort]");
      if (taskAbortButton instanceof HTMLElement) {
        event.preventDefault();
        if (window.confirm(taskAbortButton.dataset.confirm || "Terminate the running task?")) {
          exec("box:abort:");
        }
        return;
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
    });
    loadNodeFragments();
    if (window.Visibility) {
      window.Visibility.afterPrerendering(startStatusUpdates);
    } else {
      startStatusUpdates();
    }
  });
})();


