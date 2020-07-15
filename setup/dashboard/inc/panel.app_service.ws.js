(function($) {
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
            bootbox.alert({
                message: message,
                backdrop: true
            });
        } else {
            // page should refresh manually
            // location.reload();
        }
    });
    function exec(command) {
        if (typeof command !== "string") {
            console.warn(`Invalid service parameter: '${command}'`);
            return;
        }
        socket.emit("exec", command);
    }

    function packageInstallHandler(event) {
        if (!event) {
            console.warn("Event parameter is required");
            return;
        }
        const target = event.target;
        if (!target || !target.id) {
            return;
        }
        const application = target.id.replace(/(.+)Install/, '$1');
        const command = `installpackage::${application}`;
        exec(command);
    }
    function packageRemoveHandler(event) {
        if (!event) {
            console.warn("Event parameter is required");
            return;
        }
        const target = event.target;
        if (!target || !target.id) {
            return;
        }
        const application = target.id.replace(/(.+)Remove/, '$1');
        const command = `removepackage::${application}`;
        exec(command);
    }
    window.packageInstallHandler = packageInstallHandler;
    window.packageRemoveHandler = packageRemoveHandler;
})(window.jQuery);
