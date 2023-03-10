// SPDX-License-Identifier: GPL-3.0-or-later

const path = require('path');
const { spawn } = require('child_process');
const express  = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const php = spawn('php', ['-S', '127.0.0.1:8000', '-t', path.join(__dirname, '..', '..')]);
php.stdout.on('data', (data) => process.stdout.write(`[PHP::OUT::STD] ${data}`));
php.stderr.on('data', (data) => process.stderr.write(`[PHP::OUT::ERR] ${data}`));
php.on('exit', (code) => console.log(`php exited with code ${code}`));

const ws = spawn('node', [path.join(__dirname, '..', 'dist', 'server.js')]);
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
app.listen(80);
