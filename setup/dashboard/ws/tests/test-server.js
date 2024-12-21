// SPDX-License-Identifier: GPL-3.0-or-later

const path = require('path');
const { spawn } = require('child_process');
const express  = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const php = spawn('php', ['-S', '127.0.0.1:8000', '-t', path.join(__dirname, '..', '..')]);
php.stdout.on('data', (data) => process.stdout.write(`[PHP::OUT::STD] ${data}`));
php.stderr.on('data', (data) => process.stderr.write(`[PHP::OUT::ERR] ${data}`));
php.on('exit', (code) => console.log(`php exited with code ${code}`));

const ws = spawn('bun', [path.join(__dirname, '..', 'src', 'server.tsx')]);
ws.stdout.on('data', (data) => process.stdout.write(`[NODE::OUT::STD] ${data}`));
ws.stderr.on('data', (data) => process.stderr.write(`[NODE::OUT::ERR] ${data}`));
ws.on('exit', (code) => console.log(`node exited with code ${code}`));

const wsServer = {
    target: 'http://127.0.0.1:8575',
    pathRewrite: {'^/ws' : ''},
    changeOrigin: true,
    ws: true,
};
const phpServer = {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
};

const app = express();
app.use('/ws/*', createProxyMiddleware(wsServer));
app.all('/*', createProxyMiddleware(phpServer));
const server = app.listen(80);

const cleanup = () => {
    const phpResult = php.kill();
    const wsResult = ws.kill();
    server.close((err) => {
        console.log('Express', err, 'PHP:', phpResult, 'WS:', wsResult);
        process.exit(0);
    });
};

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
});
