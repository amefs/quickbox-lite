// Run against the production bundle and nginx, with only the root update command
// replaced by the harmless critical-section fixture installed by run.py.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');
const { io } = require('../../setup/dashboard/ws/node_modules/socket.io-client');
const systemd = process.argv.includes('--systemd');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const marker = '/run/quickbox-test/update-entered.log';

async function connect() {
  const socket = io('http://127.0.0.1:18080', {
    transports: ['websocket'], reconnection: false,
    extraHeaders: { Authorization: `Basic ${Buffer.from('fixture:fixture-password').toString('base64')}` },
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}
function launch(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no update launch response')), 10000);
    socket.once('exec', (result) => { clearTimeout(timer); resolve(result); });
    socket.emit('exec', 'box:update:quickbox --only-core');
  });
}
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error('update fixture deadline exceeded');
}
(async () => {
  const sockets = await Promise.all([connect(), connect()]);
  try {
    fs.rmSync(marker, { force: true });
    const first = await launch(sockets[0]);
    assert.equal(first.success, true, JSON.stringify(first));
    await waitFor(() => fs.existsSync(marker));
    assert.match(fs.readFileSync('/srv/dashboard/db/output.log', 'utf8'), /QuickBox update started/);
    assert.ok(fs.existsSync('/srv/dashboard/db/output.log.epoch'));
    const second = await launch(sockets[1]);
    assert.equal(second.success, false, JSON.stringify(second));
    const cli = spawn('/usr/local/bin/quickbox/system/box', ['update', 'quickbox', '--only-core']);
    const status = await new Promise((resolve) => cli.once('exit', resolve));
    assert.equal(status, 75, 'CLI must be rejected while the WS updater owns the core lock');
    if (systemd) execFileSync('systemctl', ['restart', 'quickbox-ws.service']);
    await waitFor(() => fs.existsSync('/run/quickbox-test/update-finished'));
    assert.equal(fs.readFileSync(marker, 'utf8').trim().split('\n').length, 1);
    await waitFor(() => !fs.existsSync('/srv/dashboard/db/update.pid'));
    assert.equal(fs.existsSync('/install/.install.lock'), false);

    // The reverse direction: a CLI update only holds the inner core lock, so
    // the Web launcher must wait for the epoch acknowledgement and report busy
    // instead of claiming that it started.
    fs.rmSync(marker, { force: true });
    fs.rmSync('/run/quickbox-test/update-finished', { force: true });
    const cli2 = spawn('/usr/local/bin/quickbox/system/box', ['update', 'quickbox', '--only-core']);
    const cli2Status = new Promise((resolve) => cli2.once('exit', resolve));
    await waitFor(() => fs.existsSync(marker));
    const third = await launch(sockets[0]);
    assert.equal(third.success, false, JSON.stringify(third));
    assert.match(third.message, /in progress/i, JSON.stringify(third));
    await waitFor(() => fs.existsSync('/run/quickbox-test/update-finished'));
    assert.equal(await cli2Status, 0);
    console.log(`Real WS/CLI mutex and update completion${systemd ? ' across systemd restart' : ''}: passed`);
  } finally {
    sockets.forEach((socket) => socket.close());
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
