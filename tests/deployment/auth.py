#!/usr/bin/env python3
"""Real Authelia/Vouch integration server with a disposable OAuth login fixture."""
import base64
import html
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import threading
import time
from urllib.parse import parse_qs, urlencode, urlsplit

import run as deployment

REPO = deployment.REPO
CODES = set()


def control_file(path):
    # A bind mount can briefly invalidate a cached dentry during an atomic
    # host-side replacement. Retry on the next poll, not by restarting services.
    try:
        return Path(path).read_text().strip()
    except FileNotFoundError:
        return None


def control_json(path):
    content = control_file(path)
    if content is None:
        return None
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def switch(provider):
    for name in ['.authelia.lock', '.vouchproxy.lock']:
        Path('/install', name).unlink(missing_ok=True)
    for file in Path('/etc/nginx/apps').glob('*auth.conf'):
        file.unlink()
    Path('/etc/nginx/conf.d/provider-map.conf').unlink(missing_ok=True)
    # Restore the managed basic config, then use the real auth migration helper.
    config = (REPO / 'setup/templates/nginx/dashboard.conf.template').read_text().replace(
        '/etc/htpasswd', '/etc/htpasswd.d/htpasswd.fixture')
    Path('/etc/nginx/apps/dashboard.conf').write_text(config)
    if provider != 'basic':
        package = 'authelia' if provider == 'authelia' else 'vouchproxy'
        installer = (REPO / f'packages/package/install/installpackage-{package}').read_text()
        name = 'authelia-auth.conf' if provider == 'authelia' else 'vouchproxy-auth.conf'
        pattern = r"cat >\s*/etc/nginx/apps/" + re.escape(name) + r" <<'EOF'\n(.*?)\nEOF"
        matched = re.search(pattern, installer, re.S)
        assert matched is not None, f'{name} snippet is missing from {package}'
        snippet = matched.group(1)
        Path('/etc/nginx/apps', name).write_text(snippet + '\n')
        Path('/install', f'.{package}.lock').touch()
        if provider == 'authelia':
            source, target, identity = '$auth_resp_remote_user', '$qb_authelia_local_user', 'fixture'
        else:
            source, target, identity = '$auth_resp_x_vouch_user', '$qb_vouch_local_user', 'fixture@example.com'
        Path('/etc/nginx/conf.d/provider-map.conf').write_text(
            f'map {source} {target} {{ default ""; "{identity}" "fixture"; }}\n')
        deployment.run(['bash', '/usr/local/bin/quickbox/system/auxiliary/qbAuthMigrate',
                        '--provider', provider, '--migrate'])
    Path('/etc/nginx/apps/fixture-idp.conf').write_text('''
location /fixture-idp/ { proxy_pass http://127.0.0.1:9093/; }
''')
    deployment.run(['nginx', '-t'])
    deployment.run(['nginx', '-s', 'reload'])


class IdentityFixture(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, content, mime='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(content.encode())

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == '/authorize':
            query = parse_qs(parsed.query)
            if query.get('client_id') != ['fixture-client']:
                self.reply(400, '{}')
                return
            fields = ''.join(f'<input type="hidden" name="{name}" value="{html.escape(query[name][0], quote=True)}">'
                             for name in ['state', 'redirect_uri'])
            self.reply(200, '<form method="post" action="/fixture-idp/authorize">' + fields
                       + '<label>Username<input name="username"></label>'
                       '<label>Password<input name="password" type="password"></label>'
                       '<button>Sign in</button></form>', 'text/html')
        elif parsed.path == '/userinfo' and self.headers.get('Authorization') == 'Bearer fixture-access-token':
            self.reply(200, json.dumps({'sub': 'fixture', 'email': 'fixture@example.com',
                                       'email_verified': True, 'name': 'Fixture Admin'}))
        else:
            self.reply(404, '{}')

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        query = parse_qs(body)
        if self.path == '/authorize':
            if query.get('username') != ['fixture'] or query.get('password') != ['fixture-password']:
                self.reply(401, '{}')
                return
            if query.get('redirect_uri') != ['https://dashboard.example.com:18443/auth/vouch/callback']:
                self.reply(400, '{}')
                return
            code = secrets.token_urlsafe(24)
            CODES.add(code)
            self.send_response(302)
            self.send_header('Location', query['redirect_uri'][0] + '?' + urlencode(
                {'code': code, 'state': query['state'][0]}))
            self.end_headers()
        elif self.path == '/token' and query.get('code', [''])[0] in CODES:
            basic = 'Basic ' + base64.b64encode(b'fixture-client:fixture-client-secret').decode()
            if self.headers.get('Authorization') != basic and not (
                    query.get('client_id') == ['fixture-client']
                    and query.get('client_secret') == ['fixture-client-secret']):
                self.reply(401, '{}')
                return
            CODES.remove(query['code'][0])
            token = {'access_token': 'fixture-access-token', 'token_type': 'Bearer', 'expires_in': 60}
            self.reply(200, json.dumps(token))
        else:
            self.reply(400, '{}')


def main():
    if os.environ.get('QUICKBOX_TEST_DISPOSABLE') != '1':
        raise RuntimeError('Disposable integration fixture only')
    for filename in ['ready', 'active', 'session-result.json']:
        Path('/auth-fixtures', filename).unlink(missing_ok=True)
    deployment.setup()
    deployment.driver(fresh=True)
    server = ThreadingHTTPServer(('127.0.0.1', 9093), IdentityFixture)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    Path('/auth-fixtures/ready').touch()
    # The host runner requests provider changes via a file in the disposable
    # fixture volume. This control channel is never exposed through nginx.
    previous = ''
    previous_session = ''
    while not Path('/auth-fixtures/stop').exists():
        provider = control_file('/auth-fixtures/provider')
        if provider is not None and provider != previous:
            if provider not in ['basic', 'authelia', 'vouch']:
                raise RuntimeError('Unexpected provider request')
            switch(provider)
            previous = provider
            Path('/auth-fixtures/active').write_text(provider)
        data = control_json('/auth-fixtures/session.json')
        if data is not None:
            if data['id'] != previous_session:
                jar = Path('/run/quickbox-test/provider.cookies')
                lines = ['# Netscape HTTP Cookie File']
                for cookie in data['cookies']:
                    expires = str(max(0, int(cookie.get('expires', 0))))
                    lines.append('\t'.join([cookie['domain'], 'TRUE' if cookie['domain'].startswith('.') else 'FALSE',
                                            cookie['path'], 'TRUE' if cookie['secure'] else 'FALSE',
                                            expires, cookie['name'], cookie['value']]))
                jar.write_text('\n'.join(lines) + '\n')
                jar.chmod(0o600)
                environment = dict(deployment.ENV, QUICKBOX_WS_HEALTH_COOKIE_JAR=str(jar),
                                   QUICKBOX_WS_HEALTH_HOST='dashboard.example.com',
                                   QUICKBOX_WS_HEALTH_PORT='18443', QUICKBOX_NGINX_SCHEME='https')
                result = subprocess.run(['bash', '/usr/local/bin/quickbox/system/auxiliary/qbWsHealthCheck',
                                         '--expect-proxy'], env=environment, capture_output=True, text=True)
                Path('/auth-fixtures/session-result.json').write_text(json.dumps(
                    {'id': data['id'], 'status': result.returncode, 'diagnostics': result.stderr}))
                previous_session = data['id']
        time.sleep(0.1)
    server.shutdown()


if __name__ == '__main__':
    main()
