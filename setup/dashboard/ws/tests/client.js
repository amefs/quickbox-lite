const io = require("socket.io-client");

const socket = io("http://127.0.0.1:8575", { path: "/socket.io" });
let closed = false;
socket.on("open", () => {
    console.log(`[ws] connected with id: '${socket.id}'.`);
});
socket.on("pong", () => {
    console.log(`[ws] pong`);
});
socket.on("message", (data) => {
    console.log(`[ws] message:`, data);
});
socket.on("exec", (data) => {
    console.log(`[ws] exec:`, data);
});
socket.on("error", (err) => {
    console.log(err);
    closed = true;
});

(function wait() {
    if (!closed) setTimeout(wait, 1000);
    socket.emit("message", "message");
    socket.emit("exec", "exec");
})();
