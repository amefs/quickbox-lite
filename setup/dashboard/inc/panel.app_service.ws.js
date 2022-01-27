/* global bootbox, AnsiUp, socket */
"use strict";

// eslint-disable-next-line no-unused-vars
(function ($) {
  function showAlert (message) {
    bootbox.alert({
      message: message,
      backdrop: true,
      size: "large"
    });
  }

  const ansi_up = new AnsiUp();

  socket.on("exec", function (response) {
    if (response.success === false) {
      let message = response.message || "";
      let output = response.stdout || response.stderr || "";
      // eslint-disable-next-line no-control-regex
      output = output.replace(/\u001b[()][B0UK]/g, ""); // replace some none CSI-sequences
      const output_html = ansi_up.ansi_to_html(output);
      message = `${message}<br><code>${response.cmd}</code>`;
      if (output) {
        message += `<hr><div class="exec-output" style="display: inline-grid">${output_html}</div>`;
      }
      showAlert(message);
    } else {
      if (response.cmd && (response.cmd.startsWith("systemctl") || response.cmd.startsWith("box:lang"))) {
        setTimeout(function () {
          // service status is rendered by php, a force refresh is required
          location.reload();
        }, 100);
      }
    }
  });
  function exec (command) {
    if (typeof command !== "string") {
      showAlert(`Invalid service parameter: '${command}'`);
      return;
    }
    socket.emit("exec", command);
  }

  function checkParameters (params) {
    if (!params || typeof params !== "object") {
      return true;
    }
    let message = "";
    for (const key of Object.keys(params)) {
      if (!params[key]) {
        message += `'${key}', `;
      }
    }
    message = message.replace(/, $/, "");
    if (message) {
      showAlert(`Parameter: ${message} required but not found`);
      return false;
    }
    return true;
  }
  function packageHandler (template) {
    return function (event) {
      if (!checkParameters({ event })) {
        return;
      }
      const target = event.target;
      if (!target) {
        return;
      }
      const pkg = target.dataset.package;
      exec(`${template}::${pkg}`);
    };
  }
  function serviceUpdateHandler (event) {
    if (!checkParameters({ event })) {
      return;
    }
    let target = event.target;
    if (!target) {
      return;
    }
    if (!target.dataset.service) {
      do {
        target = target.parentElement;
      } while (target && target.nodeName === "DIV" && !target.dataset.service);
    }
    if (!target) {
      return;
    }
    const operations = target.dataset.operation || "";
    const service = target.dataset.service;
    for (const operation of operations.split(",")) {
      exec(`systemctl:${operation}:${service}`);
    }
  }
  function boxHandler (event) {
    if (!checkParameters({ event })) {
      return;
    }
    let target = event.target;
    if (!target) {
      return;
    }
    if (target.dataset.package === undefined) {
      do {
        target = target.parentElement;
      } while (target && (target.nodeName === "DIV") && !target.dataset.package);
    }
    if (!target) {
      return;
    }
    const operation = target.dataset.operation;
    const pkg = target.dataset.package;
    exec(`box:${operation}:${pkg}`);
  }
  window.packageInstallHandler = packageHandler("installpackage");
  window.packageRemoveHandler = packageHandler("removepackage");
  window.serviceUpdateHandler = serviceUpdateHandler;
  window.boxHandler = boxHandler;
})(window.jQuery);
