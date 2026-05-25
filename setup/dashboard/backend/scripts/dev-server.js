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
  TEST_WS_HOST         Node dashboard server host (default: ${DEFAULTS.WS_HOST})
  TEST_WS_PORT         Node dashboard server port (default: ${DEFAULTS.WS_PORT})
  TEST_SERVER_HOST     Proxy listen host (default: ${DEFAULTS.PROXY_HOST})
  TEST_SERVER_PORT     Proxy listen port (default: ${DEFAULTS.PROXY_PORT})

Legacy aliases:
  TEST_PROXY_HOST/PORT mirror TEST_SERVER_HOST/PORT
`.trim();

function buildServerConfig(env = process.env) {
    const wsHost = env.TEST_WS_HOST || DEFAULTS.WS_HOST;
    const wsPort = parsePort(env.TEST_WS_PORT, DEFAULTS.WS_PORT);
    const listenPort = parsePort(env.TEST_SERVER_PORT ?? env.TEST_PROXY_PORT, DEFAULTS.PROXY_PORT);
    const listenHost = env.TEST_SERVER_HOST || env.TEST_PROXY_HOST || DEFAULTS.PROXY_HOST;

    return {
        wsHost,
        wsPort,
        listenHost,
        listenPort,
        target: `http://${wsHost}:${wsPort}`,
    };
}

function startDashboardServer(config = buildServerConfig()) {
    let server;
    let cleaningUp = false;
    let nodeProcess;

    const finishCleanup = (err, nodeResult) => {
        console.log('Express', err, 'Node:', nodeResult);
        process.exit(0);
    };

    const cleanup = () => {
        if (cleaningUp) {
            return;
        }
        cleaningUp = true;
        const nodeResult = nodeProcess ? nodeProcess.kill() : false;
        if (server && server.listening) {
            server.close((err) => finishCleanup(err, nodeResult));
        } else {
            finishCleanup(new Error('server not started'), nodeResult);
        }
    };

    console.log(`Starting Node dashboard server on http://${config.wsHost}:${config.wsPort}`);
    nodeProcess = spawn('bun', [path.join(__dirname, '..', 'src', 'server.tsx')], {
        env: {
            ...process.env,
            WS_HOST: config.wsHost,
            WS_PORT: String(config.wsPort),
        },
    });
    nodeProcess.stdout.on('data', (data) => process.stdout.write(`[NODE::OUT::STD] ${data}`));
    nodeProcess.stderr.on('data', (data) => process.stderr.write(`[NODE::OUT::ERR] ${data}`));
    nodeProcess.on('exit', (code, signal) => {
        console.log(`node exited with code ${code} signal ${signal || 'null'}`);
        if (!cleaningUp) {
            cleanup();
        }
    });
    nodeProcess.on('error', (err) => {
        console.error('Node process error:', err);
        cleanup();
    });

    const nodeProxy = createProxyMiddleware({
        target: config.target,
        changeOrigin: true,
        ws: true,
    });

    const app = express();
    app.use(nodeProxy);
    server = app.listen(config.listenPort, config.listenHost, () => {
        console.log(`Node dashboard proxy listening on http://${config.listenHost}:${config.listenPort}`);
    });
    server.on('error', (err) => {
        console.error('Express server error:', err);
        cleanup();
    });

    server.on('upgrade', (req, socket, head) => {
        nodeProxy.upgrade(req, socket, head);
    });

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
        cleanup();
    });

    return { server, nodeProcess };
}

function main() {
    const args = new Set(process.argv.slice(2));
    if (args.has('-h') || args.has('--help')) {
        console.log(`${HELP_TEXT}\n`);
        return;
    }
    startDashboardServer();
}

if (require.main === module) {
    main();
}

module.exports = {
    DEFAULTS,
    HELP_TEXT,
    buildServerConfig,
    parsePort,
    startDashboardServer,
};
