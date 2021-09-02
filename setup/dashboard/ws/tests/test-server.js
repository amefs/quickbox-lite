const { spawn } = require('child_process');
const express  = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const php = spawn('php', ['-S', 'localhost:8000', '-t', __dirname + "/../.."]);
php.stdout.on('data', (data) => process.stdout.write(`[PHP::OUT] ${data}`));
php.stderr.on('data', (data) => process.stderr.write(`[PHP::OUT] ${data}`));
php.on('close', (code) => console.log(`child process exited with code ${code}`));

const wsServer = {
    target: 'http://localhost:8575',
    pathRewrite: {'^/ws' : ''},
    changeOrigin: true,
    ws: true,
};
const phpServer = {
    target: 'http://localhost:8000',
    changeOrigin: true,
};

app.use("/ws/*", createProxyMiddleware(wsServer));
app.all("/*", createProxyMiddleware(phpServer));

app.listen(80);
