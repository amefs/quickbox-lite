#!/usr/bin/env python3
"""Destructive-to-fixture Linux deployment acceptance. Disposable hosts ONLY."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time

REPO = Path(__file__).resolve().parents[2]
STATE = Path('/run/quickbox-test')
ENV = dict(os.environ, TERM='xterm', QUICKBOX_TEST_DISPOSABLE='1',
           QUICKBOX_NGINX_SCHEME='http', QUICKBOX_WS_HEALTH_PORT='18080')
SYSTEMD = False


def run(command, **kwargs):
    return subprocess.run(command, check=True, env=ENV, **kwargs)


def wait_http():
    for _ in range(100):
        result = subprocess.run(['curl', '--noproxy', '*', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                                 'http://127.0.0.1:8575/node/dashboard_config'], capture_output=True, text=True)
        if result.stdout in ['200', '401']:
            return
        time.sleep(0.2)
    raise AssertionError('Node did not become reachable')


def control(action):
    command = ['systemctl', action, 'quickbox-ws.service'] if SYSTEMD else [
        'python3', str(REPO / 'tests/deployment/service.py'), action, 'quickbox-ws.service']
    run(command)


def healthy():
    wait_http()
    run(['bash', '/usr/local/bin/quickbox/system/auxiliary/qbWsHealthCheck', '--expect-proxy'])


def driver(fresh=False, failure=''):
    if fresh:
        text = (REPO / 'setup.sh').read_text()
        text = re.search(r'^function _insdashboard\(\) \{\n.*?^\}', text, re.M | re.S).group()
        # Runtime packages and the console-independent nginx fixture are already
        # installed. Execute the real Dashboard installation body after them.
        text += '\n_insngx() { :; }; _insnodejs() { :; }; _webconsole() { :; }\n'
        text += '_errorcolor() { :; }; _defaultcolor() { :; }\n'
    else:
        text = (REPO / 'packages/system/update/qbUpdateDashboard').read_text()
    text += '''
_norm= _cyan= _green= _tan= _red=
OUTTO=/srv/dashboard/db/output.log
local_setup_dashboard=/etc/QuickBox/setup/dashboard/
local_setup_template=/etc/QuickBox/setup/templates/
username=fixture
dash_theme=smoked
uilang=en
npm() { [[ "$FAILURE" != npm ]] || return 23; command npm "$@"; }
nginx() {
  if [[ "$FAILURE" == nginx-test && "$1" == -t && ! -f /run/quickbox-test/injected ]] ||
     [[ "$FAILURE" == nginx-reload && "$*" == '-s reload' && ! -f /run/quickbox-test/injected ]]; then
    touch /run/quickbox-test/injected; return 24
  fi
  command nginx "$@"
}
bash() {
  if [[ "$FAILURE" == health && "$1" == */qbWsHealthCheck ]]; then return 25; fi
  command bash "$@"
}
systemctl() {
  if [[ "$FAILURE" == restart && "$1" == restart && ! -f /run/quickbox-test/injected ]]; then
    touch /run/quickbox-test/injected; return 26
  fi
'''
    text += '  command systemctl "$@"\n' if SYSTEMD else (
        f'  python3 {REPO}/tests/deployment/service.py "$@"\n')
    text += '}\nexport -f npm nginx bash systemctl\n'
    text += '_insdashboard\n' if fresh else '_updatedashboard\n'
    script = STATE / 'driver.sh'
    script.write_text(text)
    (STATE / 'injected').unlink(missing_ok=True)
    environment = dict(ENV, FAILURE=failure)
    with (STATE / f'{"install" if fresh else "update"}-{failure or "success"}.log').open('w') as log:
        result = subprocess.run(['bash', str(script)], env=environment, stdout=log, stderr=subprocess.STDOUT)
    assert (result.returncode != 0) if failure else (result.returncode == 0), script
    return result.returncode


def setup():
    if Path('/srv/dashboard').exists():
        raise RuntimeError('Refusing to overwrite an existing Dashboard: use a fresh disposable host')
    STATE.mkdir(parents=True)
    for directory in ['/install', '/etc/QuickBox', '/etc/nginx/apps', '/etc/nginx/snippets', '/root/.ssh',
                      '/etc/htpasswd.d', '/usr/local/bin/quickbox', '/srv/dashboard/db']:
        Path(directory).mkdir(parents=True, exist_ok=True)
    run(['rsync', '-a', '--exclude=node_modules', str(REPO) + '/', '/etc/QuickBox/'])
    run(['rsync', '-a', str(REPO / 'packages') + '/', '/usr/local/bin/quickbox/'])
    run(['chown', '-R', 'root:root', '/etc/QuickBox', '/usr/local/bin/quickbox'])
    for path in Path('/usr/local/bin/quickbox').rglob('*'):
        if path.is_file():
            path.chmod(0o755)
    Path('/root/.ssh/local_user').write_text('disposable-fixture-passphrase\n')
    encoded = subprocess.check_output(['openssl', 'enc', '-aes-128-ecb', '-pbkdf2', '-a', '-e',
                                      '-pass', 'file:/root/.ssh/local_user', '-nosalt'], input=b'fixture-password\n')
    Path('/root/.admin.info').write_bytes(b'fixture:' + encoded)
    hashed = subprocess.check_output(['openssl', 'passwd', '-apr1', 'fixture-password']).decode().strip()
    Path('/etc/htpasswd.d/htpasswd.fixture').write_text('fixture:' + hashed + '\n')
    shutil.copy(REPO / 'setup/templates/nginx/proxy.conf.template', '/etc/nginx/snippets/proxy.conf')
    shutil.copy(REPO / 'setup/templates/sudoers.template', '/etc/sudoers.d/quickbox-test')
    Path('/etc/sudoers.d/quickbox-test').chmod(0o440)
    run(['visudo', '-cf', '/etc/sudoers'])
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=dashboard.test',
         '-keyout', str(STATE / 'tls.key'), '-out', str(STATE / 'tls.crt')], stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL)
    Path('/etc/nginx/nginx.conf').write_text('''
user www-data;
pid /run/nginx.pid;
events {}
http {
  include /etc/nginx/mime.types;
  include /etc/nginx/conf.d/*.conf;
  access_log /var/log/nginx/access.log;
  error_log /var/log/nginx/error.log info;
  server {
    listen 127.0.0.1:18080;
    listen [::1]:18080;
    listen 127.0.0.1:18443 ssl;
    ssl_certificate /run/quickbox-test/tls.crt;
    ssl_certificate_key /run/quickbox-test/tls.key;
    server_name dashboard.test;
    include /etc/nginx/apps/*.conf;
  }
}
''')
    if os.environ.get('QUICKBOX_TEST_EXTERNAL') == '1':
        config = Path('/etc/nginx/nginx.conf')
        config.write_text(config.read_text().replace('listen 127.0.0.1:18443 ssl;', 'listen 0.0.0.0:18443 ssl;'))
    run(['nginx', '-t'])
    if SYSTEMD:
        # Make the Type=simple readiness race deterministic: the main process
        # starts immediately, then waits before exec'ing the real Node service.
        dropin = Path('/etc/systemd/system/quickbox-ws.service.d')
        dropin.mkdir(parents=True, exist_ok=True)
        (dropin / 'test-startup.conf').write_text(
            '[Service]\nExecStart=\n'
            'ExecStart=/bin/sh -c "sleep 1; exec /usr/bin/node /srv/dashboard/ws/dist/server.js"\n')
        subprocess.run(['systemctl', 'stop', 'nginx'], env=ENV, check=False)
        run(['systemctl', 'start', 'nginx'])
    else:
        run(['nginx'])


def permissions():
    for filename, mode in [('/etc/quickbox/ws.secret', 0o640),
                           ('/etc/nginx/snippets/quickbox-ws-gateway.conf', 0o600)]:
        info = Path(filename).stat()
        assert info.st_uid == 0 and info.st_mode & 0o777 == mode
        result = subprocess.run(['runuser', '-u', 'www-data', '--', 'test', '-w', filename])
        assert result.returncode != 0
    run(['runuser', '-u', 'www-data', '--', 'test', '-r', '/etc/quickbox/ws.secret'])
    for filename in ['/srv/dashboard', '/srv/dashboard/ws', '/srv/dashboard/ws/config/commands.json',
                     '/etc/quickbox', '/etc/nginx/snippets']:
        assert subprocess.run(['runuser', '-u', 'www-data', '--', 'test', '-w', filename]).returncode != 0
    run(['runuser', '-u', 'www-data', '--', 'touch', '/srv/dashboard/db/permission-fixture'])
    fixture = Path('/usr/local/bin/quickbox/system/test-fixture')
    fixture.write_text('#!/bin/sh\ntouch /run/quickbox-test/sudo-authorized\n')
    fixture.chmod(0o755)
    run(['runuser', '-u', 'www-data', '--', 'sudo', '-n', '--', str(fixture)])
    assert (STATE / 'sudo-authorized').exists()
    result = subprocess.run(['runuser', '-u', 'www-data', '--', 'sudo', '-n', '--', '/usr/bin/touch',
                             '/run/quickbox-test/sudo-forbidden'], capture_output=True)
    assert result.returncode != 0 and not (STATE / 'sudo-forbidden').exists()


def transports():
    for scheme, authority in [('http', '127.0.0.1:18080'), ('http', '[::1]:18080'),
                              ('https', '127.0.0.1:18443')]:
        for path in ['/socket.io/', '/ws/socket.io/']:
            for transport, expected in [('polling', '200'), ('websocket', '101')]:
                args = ['curl', '--noproxy', '*', '-ks', '--max-time', '1', '-o', '/dev/null', '-w', '%{http_code}',
                        '-u', 'fixture:fixture-password', '-H', f'Origin: {scheme}://{authority}']
                if transport == 'websocket':
                    args += ['--http1.1', '-H', 'Connection: Upgrade', '-H', 'Upgrade: websocket',
                             '-H', 'Sec-WebSocket-Version: 13', '-H', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==']
                result = subprocess.run(args + [f'{scheme}://{authority}{path}?EIO=4&transport={transport}'],
                                        capture_output=True, text=True)
                assert result.stdout == expected, (scheme, authority, path, transport, result.stdout, result.stderr)
    print('IPv4/IPv6, HTTP/TLS, polling/direct WebSocket: passed', flush=True)


def legacy():
    control('stop')
    shutil.rmtree('/srv/dashboard')
    baseline = Path(os.environ.get('QUICKBOX_TEST_BASELINE_DIR', '/opt/quickbox-baseline'))
    run(['rsync', '-a', str(baseline / 'setup/dashboard') + '/', '/srv/dashboard/'])
    for filename, content in [('master.txt', 'fixture\n'), ('interface.txt', 'eth0\n'), ('output.log', 'legacy-output\n')]:
        Path('/srv/dashboard/db', filename).write_text(content)
    shutil.copy(baseline / 'setup/templates/systemd/quickbox-ws.service.template',
                '/etc/systemd/system/quickbox-ws.service')
    shutil.copy(baseline / 'setup/templates/nginx/proxy.conf.template', '/etc/nginx/snippets/proxy.conf')
    Path('/etc/nginx/snippets/proxy.conf').open('a').write('\n# retained custom fixture\nproxy_buffer_size 8k;\n')
    for filename in ['/etc/quickbox/ws.secret', '/etc/nginx/snippets/quickbox-ws-gateway.conf']:
        Path(filename).unlink(missing_ok=True)
    # Use the actual old vhost as well as its runtime, dependencies and unit.
    Path('/etc/nginx/apps/dashboard.conf').write_text(
        (baseline / 'setup/templates/nginx/dashboard.conf.template').read_text().replace(
            '/etc/htpasswd', '/etc/htpasswd.d/htpasswd.fixture'))
    run(['nginx', '-s', 'reload'])
    if SYSTEMD:
        run(['systemctl', 'daemon-reload'])
    control('start')
    wait_http()
    driver()
    healthy()
    assert 'retained custom fixture' in Path('/etc/nginx/snippets/proxy.conf').read_text()
    print('Pinned baseline first upgrade: passed', flush=True)


def digest(filename):
    return hashlib.sha256(Path(filename).read_bytes()).hexdigest()


def lifecycle():
    if not SYSTEMD:
        print('systemd lifecycle: not claimed in container mode', flush=True)
        return
    fields = subprocess.check_output(['systemctl', 'show', 'quickbox-ws.service',
                                      '-p', 'User', '-p', 'PrivateTmp', '-p', 'KillMode'], text=True)
    assert 'User=www-data' in fields and 'PrivateTmp=yes' in fields and 'KillMode=process' in fields, fields
    dropin = Path('/etc/systemd/system/quickbox-ws.service.d')
    dropin.mkdir(exist_ok=True)
    (dropin / 'test-delay.conf').write_text('[Service]\nRestartSec=200ms\n')
    run(['systemctl', 'daemon-reload'])
    pid = int(subprocess.check_output(['systemctl', 'show', 'quickbox-ws.service', '-p', 'MainPID', '--value']))
    os.kill(pid, signal.SIGKILL)
    time.sleep(1)
    healthy()
    new_pid = int(subprocess.check_output(['systemctl', 'show', 'quickbox-ws.service', '-p', 'MainPID', '--value']))
    assert new_pid != pid
    print('Real systemd automatic restart: passed', flush=True)
    control('stop')
    with socket.socket() as blocker:
        blocker.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        blocker.bind(('127.0.0.1', 8575))
        blocker.listen()
        before = int(subprocess.check_output(['systemctl', 'show', 'quickbox-ws.service',
                                              '-p', 'NRestarts', '--value']))
        control('start')
        for _ in range(50):
            current = int(subprocess.check_output(['systemctl', 'show', 'quickbox-ws.service',
                                                   '-p', 'NRestarts', '--value']))
            if current > before:
                break
            time.sleep(0.1)
        else:
            raise AssertionError('port collision did not trigger Restart=on-failure')
    healthy()
    print('Real port collision followed by systemd recovery: passed', flush=True)


def update_mutex():
    # Keep the production WS protocol, command policy, sudoers, detached runner
    # and core lock; replace only the destructive update body with sleep.
    definitions = (REPO / 'packages/system/qbUpdate').read_text().split('# MAIN PROCESS')[0]
    fixture = Path('/usr/local/bin/quickbox/system/qbUpdate')
    fixture.write_text('#!/bin/bash\n' + definitions + '''
OUTTO=/srv/dashboard/db/output.log
_updateLockCheck
result=$?
[[ "$result" == 0 ]] || exit "$result"
_lockCheck
_setLock || exit 1
trap _releaseUpdateInstallLock EXIT
echo entered >>/run/quickbox-test/update-entered.log
sleep 4
touch /run/quickbox-test/update-finished
''')
    fixture.chmod(0o755)
    command = ['node', str(REPO / 'tests/deployment/ws-update.cjs')]
    if SYSTEMD:
        command.append('--systemd')
    run(command)
    healthy()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--systemd', action='store_true')
    parser.add_argument('--only-mutex', action='store_true', help='focused real WS/CLI concurrency regression')
    arguments = parser.parse_args()
    global SYSTEMD
    SYSTEMD = arguments.systemd
    if sys.platform != 'linux' or os.geteuid() != 0 or os.environ.get('QUICKBOX_TEST_DISPOSABLE') != '1':
        parser.error('Run only as root in a disposable Linux deployment-test host')
    try:
        # Run before provisioning production secrets so tests retain isolation.
        run(['npm', 'test'], cwd=REPO / 'setup/dashboard/ws')
        setup()
        driver(fresh=True)
        healthy()
        permissions()
        if arguments.only_mutex:
            update_mutex()
            return
        transports()
        legacy()
        secret = digest('/etc/quickbox/ws.secret')
        driver()
        assert digest('/etc/quickbox/ws.secret') == secret
        healthy()
        print('Repeat upgrade and secret preservation: passed', flush=True)
        candidate = Path('/etc/QuickBox/setup/dashboard/ws/dist/server.js')
        original_candidate = candidate.read_bytes()
        for failure in ['npm', 'restart', 'nginx-test', 'nginx-reload', 'health']:
            # Make the candidate observably different. A repeat deployment of
            # identical bytes could otherwise pass even if no rollback happened.
            candidate.write_bytes(f'// candidate for {failure}\n'.encode() + original_candidate)
            vhost = Path('/etc/nginx/apps/dashboard.conf')
            vhost.write_text(vhost.read_text() + f'\n# previous release before {failure}\n')
            old_config = digest(vhost)
            before = digest('/srv/dashboard/ws/dist/server.js')
            driver(failure=failure)
            assert digest('/srv/dashboard/ws/dist/server.js') == before
            assert digest(vhost) == old_config, 'rollback must restore the previous vhost bytes'
            assert digest('/etc/quickbox/ws.secret') == secret
            healthy()
            print(f'Real deployment recovery after {failure}: passed', flush=True)
        candidate.write_bytes(original_candidate)
        lifecycle()
        update_mutex()
        print(json.dumps({'linux-deployment': 'passed', 'systemd': SYSTEMD}), flush=True)
    finally:
        if STATE.exists():
            subprocess.run(['journalctl', '-u', 'quickbox-ws.service', '--no-pager', '-n', '100'], check=False) if SYSTEMD else None
            for filename in STATE.glob('*.log'):
                print(f'--- {filename.name} ---\n{filename.read_text()[-6000:]}', flush=True)
            for filename in ['/srv/dashboard/db/output.log', '/var/log/nginx/error.log']:
                if Path(filename).exists():
                    print(f'--- {filename} ---\n{Path(filename).read_text()[-10000:]}', flush=True)
            subprocess.run(['nginx', '-s', 'quit'], check=False)
            try:
                control('stop')
            except subprocess.CalledProcessError:
                pass


if __name__ == '__main__':
    main()
