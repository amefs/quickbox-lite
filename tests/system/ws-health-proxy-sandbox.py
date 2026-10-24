#!/usr/bin/env python3
"""Check fast WebSocket health verdicts, authentication and bounded failures."""
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest

REPO = Path(__file__).resolve().parents[2]
HELPER = REPO / 'packages/system/auxiliary/qbWsHealthCheck'
SECRET = 'health-proxy-fixture'
BASIC = 'Basic ' + base64.b64encode(b'fixture:probe-password').decode()


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.server.backend:
            authenticated = self.headers.get('X-Quickbox-Gateway') == SECRET
        else:
            authenticated = self.headers.get('Authorization') == BASIC or self.headers.get('Cookie') == 'health_session=valid'
        if self.path == '/qb-healthz':
            status = 200
        else:
            status = 200 if authenticated else 401
        upgrade = self.headers.get('Upgrade', '').lower() == 'websocket'
        if upgrade and not self.server.backend:
            if self.server.pending_reload:
                self.server.pending_reload -= 1
                self.send_response(400)
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            host = f'dashboard.test:{self.server.server_port}'
            if self.headers.get('Host') != host or self.headers.get('Origin') != f'http://{host}':
                status = 403
            if authenticated and status != 403:
                status = 101
                if self.path.startswith('/socket.io/'):
                    time.sleep(self.server.delay)
                key = self.headers.get('Sec-WebSocket-Key', '')
                accept = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
                self.send_response(status)
                self.send_header('Upgrade', 'invalid' if self.server.failure == 'upgrade' else 'websocket')
                self.send_header('Connection', 'keep-alive' if self.server.failure == 'connection' else 'Upgrade')
                self.send_header('Sec-WebSocket-Accept', 'invalid' if self.server.failure == 'accept' else accept)
                self.end_headers()
                self.connection.settimeout(10)
                try:
                    self.connection.recv(1)
                except (TimeoutError, ConnectionError):
                    pass
                return
        self.send_response(status)
        self.send_header('Content-Length', '0')
        self.end_headers()


class ProxyHealthTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='quickbox-proxy-health-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.servers = []
        for backend in (True, False):
            server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
            server.backend = backend
            server.failure = ''
            server.delay = 0
            server.pending_reload = 0
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.servers.append(server)
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
        self.backend, self.proxy = self.servers
        (self.root / 'secret').write_text(SECRET)
        (self.root / 'passphrase').write_text('fixture-passphrase')
        encoded = subprocess.check_output(['openssl', 'enc', '-aes-128-ecb', '-pbkdf2', '-a', '-e',
                                          '-pass', f'file:{self.root / "passphrase"}', '-nosalt'], input=b'probe-password')
        (self.root / 'admin').write_bytes(b'fixture:' + encoded)
        self.env = dict(os.environ, QUICKBOX_WS_SECRET_FILE=str(self.root / 'secret'),
                        QUICKBOX_WS_PORT=str(self.backend.server_port), QUICKBOX_NGINX_SCHEME='http',
                        QUICKBOX_WS_HEALTH_PORT=str(self.proxy.server_port), QUICKBOX_WS_HEALTH_HOST='dashboard.test',
                        QUICKBOX_ADMIN_INFO_FILE=str(self.root / 'admin'),
                        QUICKBOX_ADMIN_PASSPHRASE_FILE=str(self.root / 'passphrase'))
        self.env.pop('QUICKBOX_WS_HEALTH_COOKIE_JAR', None)

    def health(self):
        started = time.monotonic()
        result = subprocess.run(['bash', str(HELPER), '--expect-proxy'], env=self.env,
                                text=True, capture_output=True, timeout=8)
        return result, time.monotonic() - started

    def websocket(self, cookie_file='', host=None):
        function = HELPER.read_text().split('_websocket_code() {', 1)[1].split('\n}\n', 1)[0]
        script = '_websocket_code() {' + function + '\n}\n_websocket_code "$URL"\n'
        env = dict(os.environ, URL=f'http://127.0.0.1:{self.proxy.server_port}/socket.io/?EIO=4&transport=websocket',
                   HOST_HEADER=host or f'dashboard.test:{self.proxy.server_port}', COOKIE_JAR=str(cookie_file),
                   ADMIN_USER='fixture', ADMIN_PASSWORD='probe-password')
        started = time.monotonic()
        result = subprocess.run(['bash', '-c', script], env=env, text=True, capture_output=True, timeout=7)
        return result, time.monotonic() - started

    def test_success_finishes_without_waiting_for_connection_close(self):
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('11 checks', result.stderr)
        self.assertLess(elapsed, 3, result.stderr)

    def test_delayed_handshake_is_accepted(self):
        self.proxy.delay = 0.25
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreater(elapsed, 0.25)
        self.assertLess(elapsed, 3)

    def test_invalid_upgrade_headers_are_rejected(self):
        for failure in ('accept', 'connection', 'upgrade'):
            with self.subTest(failure=failure):
                self.proxy.failure = failure
                result, elapsed = self.health()
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn('WebSocket Upgrade', result.stderr)
                self.assertLess(elapsed, 3)

    def test_nginx_reload_waits_until_the_new_proxy_is_ready(self):
        self.proxy.pending_reload = 3
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.proxy.pending_reload, 0)
        self.assertLess(elapsed, 3)

    def test_handshake_deadline_is_bounded(self):
        self.proxy.delay = 6
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('WebSocket Upgrade /socket.io failed', result.stderr)
        self.assertGreater(elapsed, 4.5)
        self.assertLess(elapsed, 7)

    def test_permanent_bad_request_obeys_the_same_deadline(self):
        self.proxy.pending_reload = 1000000
        result, elapsed = self.websocket()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '400')
        self.assertGreater(elapsed, 4.5)
        self.assertLess(elapsed, 7)

    def test_wrong_origin_is_rejected_without_retry(self):
        result, elapsed = self.websocket(host='wrong.test')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '403')
        self.assertLess(elapsed, 3)

    def test_wrong_credentials_are_rejected(self):
        encoded = subprocess.check_output(['openssl', 'enc', '-aes-128-ecb', '-pbkdf2', '-a', '-e',
                                          '-pass', f'file:{self.root / "passphrase"}', '-nosalt'], input=b'wrong-password')
        (self.root / 'admin').write_bytes(b'fixture:' + encoded)
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('401', result.stderr)
        self.assertLess(elapsed, 3)

    def test_cookie_selection_preserves_session_cookies_and_rejects_expired_ones(self):
        cookie_file = self.root / 'cookies'
        for expiry, accepted in ((0, True), (1, False)):
            with self.subTest(expiry=expiry):
                cookie_file.write_text('# Netscape HTTP Cookie File\n'
                                       f'dashboard.test\tFALSE\t/\tFALSE\t{expiry}\thealth_session\tvalid\n')
                result, _ = self.websocket(cookie_file=cookie_file)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), '101' if accepted else '401')


if __name__ == '__main__':
    unittest.main()
