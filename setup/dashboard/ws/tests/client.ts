import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:8575", { path: "/socket.io" });
let connectionError = false;
let idx = 0;
socket.on("open", () => {
    console.log(`[ws] connected with id: '${socket.id}'.`);
});

socket.on("pong", () => {
    console.log(`[ws${++idx}] pong`);
});
socket.on("message", (data) => {
    console.log(`[ws${++idx}] message:`, data);
});
socket.on("exec", (data) => {
    console.log(`[ws${++idx}] exec:`, data);
});
socket.on("error", (err) => {
    console.log(`[ws${++idx}] err:`, err);
    connectionError = true;
});

(function wait() {
    if (!connectionError) {
        setTimeout(wait, 1000);
    }
    socket.emit("exec", "ping::");
})();
console.log("client is running");
