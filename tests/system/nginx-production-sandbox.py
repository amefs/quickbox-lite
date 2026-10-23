#!/usr/bin/env python3
"""Test production templates, bundle and health helper through a real nginx.

Requires installed dashboard Node dependencies and nginx with rewrite support.
Run: python3 tests/system/nginx-production-sandbox.py --nginx /path/to/nginx
All listeners use temporary high ports and all credentials are disposable fixtures.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

REPO = Path(__file__).resolve().parents[2]


def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def run_case(nginx_binary, deny_health=False):
    with tempfile.TemporaryDirectory(prefix='quickbox-nginx-') as temporary:
        runtime = Path(temporary)
        (runtime / 'logs').mkdir()
        node_port, nginx_port = free_port(), free_port()
        secret = 'disposable-gateway-fixture-secret'
        (runtime / 'secret').write_text(secret)
        password_hash = subprocess.check_output(
            ['openssl', 'passwd', '-apr1', 'fixture-password'], text=True).strip()
        (runtime / 'htpasswd').write_text('fixture:' + password_hash + '\n')
        (runtime / 'gateway.conf').write_text(
            'proxy_set_header X-Quickbox-Gateway "' + secret + '";\n')
        template = (REPO / 'setup/templates/nginx/dashboard.conf.template').read_text()
        for old, new in [('/srv/dashboard', str(REPO / 'setup/dashboard')),
                         ('/etc/htpasswd', str(runtime / 'htpasswd')),
                         ('snippets/proxy.conf', str(REPO / 'setup/templates/nginx/proxy.conf')),
                         ('/etc/nginx/snippets/quickbox-ws-gateway.conf', str(runtime / 'gateway.conf')),
                         ('127.0.0.1:8575', f'127.0.0.1:{node_port}')]:
            template = template.replace(old, new)
        if deny_health:
            # Reject our loopback source to prove the address condition runs
            # before the health response, rather than an unconditional 200.
            template = template.replace('127', '192', 1)
        (runtime / 'dashboard.conf').write_text(template)
        (runtime / 'nginx.conf').write_text(
            f'daemon off; master_process off; pid {runtime}/nginx.pid; '
            f'error_log {runtime}/error.log; events {{}} http {{ access_log off; '
            f'server {{ listen 127.0.0.1:{nginx_port}; include {runtime}/dashboard.conf; }} }}')
        environment = dict(os.environ, NODE_ENV='production', MOCK_ENABLED='0',
                           WS_PORT=str(node_port), WS_HOST='127.0.0.1', QUICKBOX_WS_AUTH='1',
                           QUICKBOX_WS_ENFORCE_ORIGIN='1', QUICKBOX_WS_ALLOWED_ORIGINS='',
                           QUICKBOX_WS_GATEWAY_SECRET=secret,
                           QUICKBOX_WS_GATEWAY_SECRET_FILE=str(runtime / 'secret'))
        processes = []
        try:
            with (runtime / 'node.log').open('w') as log:
                node = subprocess.Popen(['node', 'dist/server.js'], cwd=REPO / 'setup/dashboard/ws',
                                        env=environment, stdout=log, stderr=subprocess.STDOUT)
            processes.append(node)
            ready = False
            for _ in range(100):
                if node.poll() is not None:
                    raise AssertionError((runtime / 'node.log').read_text())
                try:
                    with socket.create_connection(('127.0.0.1', node_port), timeout=0.1):
                        ready = True
                        break
                except OSError:
                    time.sleep(0.1)
            assert ready, 'production Node listener did not become ready'
            with (runtime / 'nginx.log').open('w') as log:
                nginx = subprocess.Popen([nginx_binary, '-p', str(runtime) + '/',
                                          '-c', str(runtime / 'nginx.conf')],
                                         stdout=log, stderr=subprocess.STDOUT)
            processes.append(nginx)
            ready = False
            for _ in range(100):
                if nginx.poll() is not None:
                    raise AssertionError((runtime / 'nginx.log').read_text())
                try:
                    with socket.create_connection(('127.0.0.1', nginx_port), timeout=0.1):
                        ready = True
                        break
                except OSError:
                    time.sleep(0.1)
            assert ready, 'nginx listener did not become ready'

            def http_code(path, auth=False, origin=None, websocket=False):
                args = ['curl', '-q', '--noproxy', '*', '-s', '--max-time', '1',
                        '-o', '/dev/null', '-w', '%{http_code}']
                if auth:
                    args += ['-u', 'fixture:fixture-password']
                if origin:
                    args += ['-H', 'Origin: ' + origin]
                if websocket:
                    args += ['--http1.1', '-H', 'Connection: Upgrade', '-H', 'Upgrade: websocket',
                             '-H', 'Sec-WebSocket-Version: 13',
                             '-H', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==']
                args += [f'http://127.0.0.1:{nginx_port}' + path]
                # curl times out after observing an open WebSocket: status 101
                # is still the expected transport handshake evidence.
                return subprocess.run(args, capture_output=True, text=True).stdout

            results = {}
            for path in ['/socket.io/', '/ws/socket.io/']:
                for transport, expected in [('polling', '200'), ('websocket', '101')]:
                    url = path + '?EIO=4&transport=' + transport
                    results[url] = http_code(url, True, f'http://127.0.0.1:{nginx_port}',
                                             transport == 'websocket')
                    assert results[url] == expected, results
            for name, path, auth, origin, expected in [
                    ('authenticated', '/node/dashboard_config', True, None, '200'),
                    ('unauthenticated', '/node/dashboard_config', False, None, '401'),
                    ('cross-origin', '/socket.io/?EIO=4&transport=polling', True, 'http://other.example', '403'),
                    ('health', '/qb-healthz', False, None, '403' if deny_health else '200')]:
                results[name] = http_code(path, auth, origin)
                assert results[name] == expected, results
            (runtime / 'passphrase').write_text('fixture-passphrase\n')
            encrypted = subprocess.check_output(
                ['openssl', 'enc', '-aes-128-ecb', '-pbkdf2', '-a', '-e', '-pass',
                 'file:' + str(runtime / 'passphrase'), '-nosalt'],
                input='fixture-password\n', text=True)
            (runtime / 'admin.info').write_text('fixture:' + encrypted)
            health_environment = dict(os.environ, QUICKBOX_WS_SECRET_FILE=str(runtime / 'secret'),
                                      QUICKBOX_WS_PORT=str(node_port), QUICKBOX_NGINX_SCHEME='http',
                                      QUICKBOX_WS_HEALTH_PORT=str(nginx_port), QUICKBOX_WS_HEALTH_HOST='127.0.0.1',
                                      QUICKBOX_ADMIN_INFO_FILE=str(runtime / 'admin.info'),
                                      QUICKBOX_ADMIN_PASSPHRASE_FILE=str(runtime / 'passphrase'))
            health_environment.pop('QUICKBOX_WS_HEALTH_COOKIE_JAR', None)
            health = subprocess.run(['bash', str(REPO / 'packages/system/auxiliary/qbWsHealthCheck'),
                                     '--expect-proxy'], env=health_environment, capture_output=True, text=True)
            assert health.returncode == (1 if deny_health else 0), health.stderr
            results['health-helper-exit'] = health.returncode
            print(json.dumps({'deny-health': deny_health, 'results': results}))
        finally:
            for process in reversed(processes):
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nginx', default=shutil.which('nginx'))
    arguments = parser.parse_args()
    if not arguments.nginx:
        parser.error('nginx is required; supply --nginx /path/to/nginx')
    run_case(arguments.nginx)
    run_case(arguments.nginx, deny_health=True)
