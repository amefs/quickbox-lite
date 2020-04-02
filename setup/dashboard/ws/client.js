const io = require('socket.io-client');
var iconv = require('iconv-lite');

const socket = io("http://127.0.0.1:8575");

socket.on('connect', () => {
    setInterval(() => {
        socket.emit("exec", "test::.");
        console.log("sent");
    }, 5000);
});

socket.on("exec", (msg) => {
    console.log(msg);
});
