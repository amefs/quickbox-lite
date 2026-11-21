const { chromium, webkit, devices, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const directory = process.env.QUICKBOX_AUTH_FIXTURES;
const base = 'https://dashboard.example.com:18443';
const browserName = process.env.QUICKBOX_AUTH_BROWSER || 'chromium';
assert(['chromium', 'webkit'].includes(browserName));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await sleep(200); }
  throw new Error('authentication acceptance deadline exceeded');
}
async function verifyHealth() {
  const id = `${Date.now()}`;
  const request = path.join(directory, 'health-request.json');
  fs.writeFileSync(`${request}.tmp`, JSON.stringify({ id }));
  fs.renameSync(`${request}.tmp`, request);
  let result;
  await until(() => {
    try { result = JSON.parse(fs.readFileSync(path.join(directory, 'health-result.json'))); return result.id === id; }
    catch { return false; }
  });
  assert.equal(result.status, 0, result.diagnostics);
}
async function request(page, target, headers = {}) {
  try {
    return await page.evaluate(async ({ url, headers }) => (await fetch(url, {
      headers, credentials: 'include', redirect: 'manual',
    })).status, { url: `${base}${target}`, headers });
  } catch (error) {
    if (/Execution context was destroyed|Cannot find context/.test(error.message)) return 0;
    throw error;
  }
}
async function websocket(page, socketPath, accepted) {
  const opened = await page.evaluate(({ url }) => new Promise((resolve) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => { socket.close(); resolve(false); }, 5000);
    socket.onopen = () => { clearTimeout(timer); socket.close(); resolve(true); };
    socket.onerror = () => { clearTimeout(timer); resolve(false); };
  }), { url: `${base.replace('https:', 'wss:')}${socketPath}/?EIO=4&transport=websocket` });
  assert.equal(opened, accepted, socketPath);
}
async function verifySingleBasicLogin(browser, entryPath) {
  const marker = `QuickBoxBasicLogin-${process.pid}-${Date.now()}`;
  const context = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true,
    userAgent: devices['iPhone 13'].userAgent + ' ' + marker,
    httpCredentials: { username: 'fixture', password: 'fixture-password' },
  });
  const page = await context.newPage();
  async function connected() {
    await page.waitForFunction(() => {
      const socket = window.socket;
      return socket?.connected && (socket.io.engine.opts.upgrade === false || socket.io.engine.transport.name === 'websocket');
    }, undefined, { timeout: 20000 });
  }
  try {
    await page.goto(base + entryPath);
    assert.equal(new URL(page.url()).pathname, '/');
    assert.equal(new URL(page.url()).search, new URL(base + entryPath).search);
    await connected();
    await expect(page.locator('#uptime')).not.toBeEmpty();
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate(() => { window.socket.disconnect(); window.socket.connect(); });
      await connected();
    }
    await page.reload();
    await connected();
    const results = await Promise.all(['/node/dashboard_config', '/node/system_static', '/node/ram_stats']
      .map((target) => request(page, target)));
    assert.deepEqual(results, [200, 200, 200]);
    const challenges = fs.readFileSync(path.join(directory, 'browser-access.log'), 'utf8').split('\n')
      .filter((line) => line.includes(marker) && /" 401 /.test(line));
    assert.equal(challenges.length, 1, `Expected one Basic login for ${entryPath}:\n${challenges.join('\n')}`);
    assert.equal(await page.evaluate(() => window.socket.io.engine.transport.name), 'polling');
    console.log(`WebKit Basic Auth ${entryPath}: one login across API calls, refresh and three reconnects`);
  } catch (error) {
    await page.screenshot({ path: path.join(directory, `basic-webkit-${entryPath === '/' ? 'root' : 'legacy'}-failure.png`) });
    throw error;
  } finally { await context.close(); }
}
(async () => {
  // Preserve the real HTTPS origin and cookie domain without editing /etc/hosts.
  // This local CONNECT proxy forwards only the disposable fixture authority.
  const connections = new Set();
  const proxy = http.createServer((req, response) => response.writeHead(403).end());
  proxy.on('connect', (request, client, head) => {
    if (request.url !== 'dashboard.example.com:18443') { client.destroy(); return; }
    const upstream = net.connect(18443, '127.0.0.1', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream); upstream.pipe(client);
    });
    for (const connection of [client, upstream]) {
      connections.add(connection);
      connection.on('close', () => { connections.delete(connection); client.destroy(); upstream.destroy(); });
      connection.on('error', () => { client.destroy(); upstream.destroy(); });
    }
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const browser = await ({ chromium, webkit })[browserName].launch({ proxy: { server: `http://127.0.0.1:${proxy.address().port}` } });
  try {
    await until(() => fs.existsSync(path.join(directory, 'ready')), 120000);
    for (const provider of (process.env.QUICKBOX_AUTH_PROVIDER ? [process.env.QUICKBOX_AUTH_PROVIDER] : ['basic', 'authelia', 'vouch'])) {
      assert(['basic', 'authelia', 'vouch'].includes(provider));
      fs.writeFileSync(path.join(directory, 'provider.tmp'), provider);
      fs.renameSync(path.join(directory, 'provider.tmp'), path.join(directory, 'provider'));
      await until(() => {
        try { return fs.readFileSync(path.join(directory, 'active'), 'utf8') === provider; }
        catch { return false; }
      });
      if (browserName === 'webkit') {
        assert.equal(provider, 'basic');
        for (const entryPath of ['/', '/ws', '/ws/', '/ws/?locale=zh']) await verifySingleBasicLogin(browser, entryPath);
        continue;
      }
      const context = await browser.newContext({ ignoreHTTPSErrors: true,
        ...(provider === 'basic' ? { httpCredentials: { username: 'fixture', password: 'fixture-password' } } : {}),
      });
      context.setDefaultTimeout(20000);
      context.setDefaultNavigationTimeout(20000);
      const page = await context.newPage();
      try {
        const guest = await browser.newContext({ ignoreHTTPSErrors: true });
        const guestPage = await guest.newPage();
        await guestPage.goto(`${base}/qb-healthz`);
        assert.notEqual(await request(guestPage, '/node/dashboard_config'), 200);
        await websocket(guestPage, '/socket.io', false);
        await guest.close();
        await verifyHealth();
        if (provider !== 'basic') {
          await page.goto(provider === 'authelia' ? `${base}/authelia/` : `${base}/login?url=${encodeURIComponent(`${base}/`)}`);
          await page.locator('input:not([type="hidden"]):not([type="password"]):not([type="checkbox"])').first().fill('fixture');
          await page.locator('input[type="password"]').fill('fixture-password');
          await page.getByRole('button', { name: /sign in/i }).click();
          await sleep(1000);
        }
        if (provider === 'basic') await page.goto(base);
        await until(async () => (await request(page, '/node/dashboard_config')) === 200);
        await page.goto(base);
        await expect(page.locator('body')).not.toBeEmpty();
        for (const socketPath of ['/socket.io', '/ws/socket.io']) {
          assert.equal(await request(page, `${socketPath}/?EIO=4&transport=polling`), 200);
          await websocket(page, socketPath, true);
        }
        if (provider !== 'basic') {
          const cookies = await context.cookies();
          assert(cookies.length > 0);
          await verifyHealth();
          await context.addCookies(cookies.map((cookie) => ({ ...cookie, value: 'tampered-fixture-session' })));
          assert.notEqual(await request(page, '/node/dashboard_config'), 200);
          await websocket(page, '/socket.io', false);
          await verifyHealth();
          await context.addCookies(cookies.map((cookie) => ({ ...cookie, expires: Math.floor(Date.now() / 1000) - 60 })));
          assert.notEqual(await request(page, '/node/dashboard_config'), 200);
        }
        console.log(`${provider}: login, HTTP, polling, WebSocket and unauthenticated checks passed${provider === "basic" ? "" : "; tampered/expired sessions rejected"}`);
      } catch (error) {
        await page.screenshot({ path: path.join(directory, `${provider}-${browserName}-failure.png`) });
        console.error(`Provider ${provider}; page URL ${page.url()}; body: ${(await page.locator('body').innerText()).slice(0, 1800)}`);
        throw error;
      } finally { await context.close(); }
    }
  } finally {
    await browser.close();
    connections.forEach((connection) => connection.destroy());
    await new Promise((resolve) => proxy.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
