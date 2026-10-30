#!/usr/bin/env python3
"""Check backend transports, nginx readiness and independence from user auth."""

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
HELPER = REPO / "packages/system/auxiliary/qbWsHealthCheck"
SECRET = "health-backend-fixture"


class FixtureServer(ThreadingHTTPServer):
    requests: list[tuple[str, dict[str, str]]]
    backend = False
    failure = ""
    delay = 0
    health_status = 200
    login_status = 500


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server: FixtureServer

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.server.requests.append((self.path, dict(self.headers)))
        if not self.server.backend:
            status = self.server.health_status if self.path == "/qb-healthz" else self.server.login_status
        elif self.headers.get("X-Quickbox-Gateway") != SECRET:
            status = 401
        else:
            status = 200
            if self.server.failure == "http" and self.path == "/node/dashboard_config":
                status = 503
            if self.server.failure == "polling" and self.path.startswith("/ws/socket.io/"):
                status = 503
        if self.headers.get("Upgrade", "").lower() == "websocket" and status == 200:
            if self.path.startswith("/socket.io/"):
                time.sleep(self.server.delay)
            if self.server.failure == "websocket":
                status = 400
            else:
                key = self.headers.get("Sec-WebSocket-Key", "")
                full_key = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
                accept = base64.b64encode(hashlib.sha1(full_key.encode()).digest()).decode()
                self.send_response(101)
                self.send_header("Upgrade", "invalid" if self.server.failure == "upgrade" else "websocket")
                self.send_header("Connection", "keep-alive" if self.server.failure == "connection" else "Upgrade")
                self.send_header("Sec-WebSocket-Accept", "invalid" if self.server.failure == "accept" else accept)
                self.end_headers()
                self.connection.settimeout(10)
                try:
                    self.connection.recv(1)
                except (TimeoutError, ConnectionError):
                    pass
                return
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()


class BackendHealthTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="quickbox-backend-health-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.servers = []
        for backend in (True, False):
            server = FixtureServer(("127.0.0.1", 0), Handler)
            server.backend = backend
            server.requests = []
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.servers.append(server)
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
        self.backend, self.proxy = self.servers
        (self.root / "secret").write_text(SECRET)
        site = self.root / "nginx-site"
        site.write_text("server {\n    server_name _ *.invalid dashboard.test;\n}\n")
        self.env = dict(
            os.environ,
            QUICKBOX_WS_SECRET_FILE=str(self.root / "secret"),
            QUICKBOX_WS_PORT=str(self.backend.server_port),
            QUICKBOX_NGINX_SCHEME="http",
            QUICKBOX_WS_HEALTH_PORT=str(self.proxy.server_port),
            QUICKBOX_WS_HEALTH_HOST="dashboard.test",
            QUICKBOX_WS_HEALTH_NGINX_SITE=str(site),
        )

    def health(self, proxy=True):
        started = time.monotonic()
        args = ["bash", str(HELPER)] + (["--expect-proxy"] if proxy else [])
        result = subprocess.run(args, env=self.env, text=True, capture_output=True, timeout=8)
        return result, time.monotonic() - started

    def test_success_checks_backend_transports_and_static_nginx_readiness(self):
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("6 checks", result.stderr)
        self.assertLess(elapsed, 3)
        self.assertEqual([path for path, _ in self.proxy.requests], ["/qb-healthz"])
        self.assertEqual(len(self.backend.requests), 5)
        for _, headers in self.backend.requests:
            self.assertEqual(headers["X-Quickbox-Gateway"], SECRET)
            self.assertNotIn("Authorization", headers)
            self.assertNotIn("Cookie", headers)

    def test_backend_only_mode_does_not_contact_nginx(self):
        result, _ = self.health(proxy=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("5 checks", result.stderr)
        self.assertEqual(self.proxy.requests, [])

    def test_user_auth_settings_and_login_responses_do_not_affect_service_health(self):
        for provider in ("basic", "authelia", "vouch"):
            self.env.update(
                QB_AUTH_PROVIDER=provider,
                QUICKBOX_ADMIN_INFO_FILE=str(self.root / "missing-admin"),
                QUICKBOX_ADMIN_PASSPHRASE_FILE=str(self.root / "missing-passphrase"),
                QUICKBOX_WS_HEALTH_COOKIE_JAR=str(self.root / "missing-cookies"),
            )
            for status in (200, 302, 401, 403, 500):
                with self.subTest(provider=provider, login_status=status):
                    self.proxy.login_status = status
                    result, _ = self.health()
                    self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(all(path == "/qb-healthz" for path, _ in self.proxy.requests))

    def test_nginx_readiness_failure_is_reported(self):
        self.proxy.health_status = 503
        result, _ = self.health()
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("nginx health endpoint failed: 503", result.stderr)
        self.assertIn(f"Nginx probe: http://127.0.0.1:{self.proxy.server_port}/qb-healthz "
                      f"(Host: dashboard.test:{self.proxy.server_port})", result.stderr)

    def test_backend_failures_are_reported_for_each_transport(self):
        for failure, diagnostic in (
            ("http", "backend HTTP request failed: 503"),
            ("polling", "backend polling /ws/socket.io failed: 503"),
            ("websocket", "backend WebSocket Upgrade /socket.io failed: 400"),
        ):
            with self.subTest(failure=failure):
                self.backend.failure = failure
                result, _ = self.health()
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn(diagnostic, result.stderr)

    def test_invalid_upgrade_headers_are_rejected(self):
        for failure in ("accept", "connection", "upgrade"):
            with self.subTest(failure=failure):
                self.backend.failure = failure
                result, _ = self.health()
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn("backend WebSocket Upgrade", result.stderr)

    def test_delayed_handshake_is_accepted(self):
        self.backend.delay = 0.25
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreater(elapsed, 0.25)
        self.assertLess(elapsed, 3)

    def test_handshake_deadline_is_bounded(self):
        self.backend.delay = 6
        result, elapsed = self.health()
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("backend WebSocket Upgrade /socket.io failed: 000", result.stderr)
        self.assertGreater(elapsed, 4.5)
        self.assertLess(elapsed, 7)

    def test_nginx_host_defaults_to_configured_domain_and_allows_override(self):
        self.env.pop("QUICKBOX_WS_HEALTH_HOST", None)
        result, _ = self.health()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.proxy.requests[-1][1]["Host"], f"dashboard.test:{self.proxy.server_port}")
        self.env["QUICKBOX_WS_HEALTH_HOST"] = "override.test"
        result, _ = self.health()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.proxy.requests[-1][1]["Host"], f"override.test:{self.proxy.server_port}")
