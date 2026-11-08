#!/usr/bin/env python3
# Author: TautCony
"""Exercise backend health checks during startup and unavailable responses."""

import base64
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time

REPO = Path(__file__).resolve().parents[2]
HELPER = REPO / "packages/system/auxiliary/qbWsHealthCheck"
SECRET = "disposable-health-startup-secret"


class FixtureServer(ThreadingHTTPServer):
    """Server carrying the per-test switches that Handler reads off ``self.server``."""

    reject_gateway = False


class Handler(BaseHTTPRequestHandler):
    server: FixtureServer

    def do_GET(self):
        authenticated = self.headers.get("X-Quickbox-Gateway") == SECRET
        status = 200 if authenticated else 401
        if self.server.reject_gateway and authenticated:
            status = 401
        if status == 200 and self.headers.get("Upgrade", "").lower() == "websocket":
            key = self.headers.get("Sec-WebSocket-Key", "")
            full_key = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
            accept = base64.b64encode(hashlib.sha1(full_key.encode()).digest()).decode()
            self.send_response(101)
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()
            return
        self.send_response(status)
        self.end_headers()

    def log_message(self, *args):
        pass


def check_listener(environment, delay=False, reject_gateway=False):
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    environment = dict(environment, QUICKBOX_WS_PORT=str(port))
    health = None
    server = None
    thread = None
    try:
        if delay:
            health = subprocess.Popen(
                ["bash", str(HELPER)], env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
            time.sleep(0.5)
            assert health.poll() is None, "health check failed before the listener became ready"
        server = FixtureServer(("127.0.0.1", port), Handler)
        server.reject_gateway = reject_gateway
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        if health is None:
            health = subprocess.Popen(
                ["bash", str(HELPER)], env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
        stdout, stderr = health.communicate(timeout=5)
        expected = 1 if reject_gateway else 0
        assert health.returncode == expected, (health.returncode, stdout, stderr)
        return stderr
    finally:
        if health is not None and health.poll() is None:
            health.kill()
            health.communicate()
        if server is not None:
            if thread is not None:
                server.shutdown()
                thread.join()
            server.server_close()


def test_health_startup_retries():
    with tempfile.TemporaryDirectory(prefix="quickbox-health-") as temporary:
        root = Path(temporary)
        secret = root / "secret"
        secret.write_text(SECRET)
        environment = dict(os.environ, QUICKBOX_WS_SECRET_FILE=str(secret))
        check_listener(environment, delay=True)
        print("delayed listener startup: passed")

        # A passing run reports one verdict line: the individual probes are detail
        # that would otherwise bury the update output.
        quiet = check_listener(environment, delay=True)
        assert len(quiet.strip().splitlines()) == 1, quiet
        assert "dashboard health check passed" in quiet and "checks)" in quiet, quiet
        print("a passing run reports a single verdict line: passed")

        rejected = check_listener(environment, reject_gateway=True)
        assert "dashboard health check failed" in rejected and "of" in rejected, rejected
        assert rejected.strip().count("✗") > 1, "a failing run must replay the probes"
        print("rejected gateway credentials remain a failure: passed")

        # A permanently unavailable service must exhaust its bounded wait and fail.
        # Remove only the pauses so this failure check does not take 20 seconds.
        binary = root / "bin"
        binary.mkdir()
        sleep = binary / "sleep"
        sleep.write_text("#!/bin/sh\nexit 0\n")
        sleep.chmod(0o755)
        curl = binary / "curl"
        curl.write_text('#!/bin/sh\nprintf "probe\\n" >>"$PROBE_LOG"\nprintf 000\nexit 7\n')
        curl.chmod(0o755)
        log = root / "probes"
        environment.update(PATH=str(binary) + os.pathsep + os.environ["PATH"], PROBE_LOG=str(log))
        result = subprocess.run(["bash", str(HELPER)], env=environment, text=True, capture_output=True, timeout=5)
        assert result.returncode == 1, (result.stdout, result.stderr)
        assert 1 < len(log.read_text().splitlines()) < 30, "startup retries must be bounded"
        print("permanently unavailable listener fails after bounded retries: passed")
