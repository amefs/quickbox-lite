(function($) {
    function showAlert(message) {
        bootbox.alert({
            message: message,
            backdrop: true
        });
    }

    const socket = io(location.origin, { path: "/ws/socket.io" });
    socket.on("exec", function(response) {
        if (response.success === false) {
            let message = response.message || "";
            let stdout = response.stdout || "";
            stdout = stdout.replace(/\r?\n/g, "<br/>");
            message = `${message}<br/><code>${response.cmd}</code><br/>${stdout}`;
            showAlert(message);
        } else {
            // page should refresh manually
            // location.reload();
        }
    });
    function exec(command) {
        if (typeof command !== "string") {
            showAlert(`Invalid service parameter: '${command}'`);
            return;
        }
        socket.emit("exec", command);
    }

    function checkParameters(params) {
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
    function packageHandler(template) {
        return function(event) {
            if (!checkParameters({event})) {
                return;
            }
            const target = event.target;
            if (!target) {
                return;
            }
            const package = target.dataset["package"];
            exec(`${template}::${package}`);
        }
    }
    function serviceUpdateHandler(event) {
        if (!checkParameters({event})) {
            return;
        }
        let target = event.target;
        if (!target) {
            return;
        }
        if (!target.dataset["service"]) {
            do {
                target = target.parentElement;
            } while (target && target.nodeName === "DIV" && !target.dataset["service"])
        }
        if (!target) {
            return;
        }
        const operations = target.dataset["operation"] || "";
        const service = target.dataset["service"];
        for (const operation of operations.split(",")) {
            exec(`systemctl:${operation}:${service}`);
        }
    }
    function boxHandler(event) {
        if (!checkParameters({event})) {
            return;
        }
        if (!event.target) {
            return;
        }
        const operation = event.target.dataset["operation"];
        const package = event.target.dataset["package"];
        exec(`box:${operation}:${package}`);
    }
    window.packageInstallHandler = packageHandler("installpackage");
    window.packageRemoveHandler = packageHandler("removepackage");
    window.serviceUpdateHandler = serviceUpdateHandler;
    window.boxHandler = boxHandler;
})(window.jQuery);
