// SPDX-License-Identifier: GPL-3.0-or-later

const path = require('path');
const { spawn } = require('child_process');
const express  = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const parsePort = (value, fallback) => {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const DEFAULTS = {
    PHP_HOST: '127.0.0.1',
    PHP_PORT: 8000,
    PHP_DOCROOT: path.join(__dirname, '..', '..'),
    WS_HOST: '127.0.0.1',
    WS_PORT: 8575,
    PROXY_HOST: '0.0.0.0',
    PROXY_PORT: 80,
};

const HELP_TEXT = `
Usage: node scripts/dev-server.js [options]

Options:
  -h, --help           Show this message

Environment overrides:
  TEST_PHP_HOST        PHP built-in server host (default: ${DEFAULTS.PHP_HOST})
  TEST_PHP_PORT        PHP built-in server port (default: ${DEFAULTS.PHP_PORT})
  TEST_PHP_DOCROOT     PHP document root (default: ${DEFAULTS.PHP_DOCROOT})
  TEST_WS_HOST         Websocket server host (default: ${DEFAULTS.WS_HOST})
  TEST_WS_PORT         Websocket server port (default: ${DEFAULTS.WS_PORT})
  TEST_SERVER_HOST     Proxy listen host (default: ${DEFAULTS.PROXY_HOST})
  TEST_SERVER_PORT     Proxy listen port (default: ${DEFAULTS.PROXY_PORT})

Legacy aliases:
  TEST_PROXY_HOST/PORT mirror TEST_SERVER_HOST/PORT
`.trim();

const args = new Set(process.argv.slice(2));
if (args.has('-h') || args.has('--help')) {
    console.log(`${HELP_TEXT}\n`);
    process.exit(0);
}

const PHP_HOST = process.env.TEST_PHP_HOST || DEFAULTS.PHP_HOST;
const PHP_PORT = parsePort(process.env.TEST_PHP_PORT, DEFAULTS.PHP_PORT);
const PHP_DOCROOT = process.env.TEST_PHP_DOCROOT || DEFAULTS.PHP_DOCROOT;

const WS_HOST = process.env.TEST_WS_HOST || DEFAULTS.WS_HOST;
const WS_PORT = parsePort(process.env.TEST_WS_PORT, DEFAULTS.WS_PORT);

const LISTEN_PORT = parsePort(process.env.TEST_SERVER_PORT ?? process.env.TEST_PROXY_PORT, DEFAULTS.PROXY_PORT);
const LISTEN_HOST = process.env.TEST_SERVER_HOST || process.env.TEST_PROXY_HOST || DEFAULTS.PROXY_HOST;

let server;
let cleaningUp = false;
let php;
let ws;
const finishCleanup = (err, phpResult, wsResult) => {
    console.log('Express', err, 'PHP:', phpResult, 'WS:', wsResult);
    process.exit(0);
};
const cleanup = () => {
    if (cleaningUp) {
        return;
    }
    cleaningUp = true;
    const phpResult = php ? php.kill() : false;
    const wsResult = ws ? ws.kill() : false;
    if (server && server.listening) {
        server.close((err) => finishCleanup(err, phpResult, wsResult));
    } else {
        finishCleanup(new Error('server not started'), phpResult, wsResult);
    }
};

console.log(`Starting PHP server on http://${PHP_HOST}:${PHP_PORT} with docroot ${PHP_DOCROOT}`);
php = spawn('php', ['-S', `${PHP_HOST}:${PHP_PORT}`, '-t', PHP_DOCROOT]);
php.stdout.on('data', (data) => process.stdout.write(`[PHP::OUT::STD] ${data}`));
php.stderr.on('data', (data) => process.stderr.write(`[PHP::OUT::ERR] ${data}`));
php.on('exit', (code, signal) => {
    console.log(`php exited with code ${code} signal ${signal || 'null'}`);
    if (!cleaningUp) {
        cleanup();
    }
});
php.on('error', (err) => {
    console.error('PHP process error:', err);
    cleanup();
});

console.log(`Starting websocket server on http://${WS_HOST}:${WS_PORT}`);
ws = spawn('bun', [path.join(__dirname, '..', 'src', 'server.tsx')]);
ws.stdout.on('data', (data) => process.stdout.write(`[NODE::OUT::STD] ${data}`));
ws.stderr.on('data', (data) => process.stderr.write(`[NODE::OUT::ERR] ${data}`));
ws.on('exit', (code, signal) => {
    console.log(`node exited with code ${code} signal ${signal || 'null'}`);
    if (!cleaningUp) {
        cleanup();
    }
});
ws.on('error', (err) => {
    console.error('WS process error:', err);
    cleanup();
});

const wsServer = {
    target: `http://${WS_HOST}:${WS_PORT}`,
    pathRewrite: {'^/ws' : ''},
    changeOrigin: true,
    ws: true,
};
const phpServer = {
    target: `http://${PHP_HOST}:${PHP_PORT}`,
    changeOrigin: true,
};

const wsProxy = createProxyMiddleware(wsServer);
const phpProxy = createProxyMiddleware(phpServer);

const app = express();
app.use('/ws', wsProxy);
app.use(phpProxy);
server = app.listen(LISTEN_PORT, LISTEN_HOST, () => {
    console.log(`Test proxy listening on http://${LISTEN_HOST}:${LISTEN_PORT}`);
});
server.on('error', (err) => {
    console.error('Express server error:', err);
    cleanup();
});

server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/ws')) {
        wsProxy.upgrade(req, socket, head);
        return;
    }
    socket.destroy();
});

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
});
