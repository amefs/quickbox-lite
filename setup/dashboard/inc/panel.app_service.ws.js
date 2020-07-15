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
            stdout = stdout.replace(/\r?\n/g, "<br/>")
            if (message !== "") {
                message = `${message}<br/>${stdout}`;
            } else {
                message = stdout;
            }
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
    function packageInstallHandler(event) {
        if (!checkParameters({event})) {
            return;
        }
        const target = event.target;
        if (!target) {
            return;
        }
        const service = target.dataset["service"];
        const command = `installpackage::${service}`;
        exec(command);
    }
    function packageRemoveHandler(event) {
        if (!checkParameters({event})) {
            return;
        }
        const target = event.target;
        if (!target) {
            return;
        }
        const service = target.dataset["service"];
        exec(`removepackage::${service}`);
    }
    function serviceUpdateHandler(event) {
        if (!checkParameters({event})) {
            return;
        }
        const target = event.target;
        if (!target) {
            return;
        }
        const operations = target.dataset["operation"] || "";
        const service = target.dataset["service"];
        for (const operation of operations.split(",")) {
            exec(`systemctl:${operation}:${service}`);
        }
    }
    window.packageInstallHandler = packageInstallHandler;
    window.packageRemoveHandler = packageRemoveHandler;
    window.serviceUpdateHandler = serviceUpdateHandler;
})(window.jQuery);
