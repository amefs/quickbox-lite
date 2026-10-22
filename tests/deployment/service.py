#!/usr/bin/env python3
"""Container-only process adapter. This deliberately does not emulate systemd."""
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
import time

PID = Path('/run/quickbox-test/node.pid')


def alive():
    try:
        os.kill(int(PID.read_text()), 0)
        return True
    except (OSError, ValueError):
        return False


def stop():
    if alive():
        os.killpg(int(PID.read_text()), signal.SIGTERM)
        for _ in range(50):
            if not alive():
                break
            time.sleep(0.1)
    PID.unlink(missing_ok=True)


def start():
    stop()
    environment = dict(os.environ)
    user = 'root'
    for line in Path('/etc/systemd/system/quickbox-ws.service').read_text().splitlines():
        if line.startswith('Environment='):
            for setting in shlex.split(line.split('=', 1)[1]):
                key, value = setting.split('=', 1)
                environment[key] = value
        if line.startswith('User='):
            user = line.split('=', 1)[1]
    command = ['/usr/bin/node', '/srv/dashboard/ws/dist/server.js']
    if user != 'root':
        command = ['runuser', '-u', user, '--'] + command
    with Path('/run/quickbox-test/node.log').open('a') as log:
        child = subprocess.Popen(command, env=environment, stdout=log, stderr=subprocess.STDOUT,
                                 start_new_session=True)
    PID.write_text(str(child.pid))
    # Startup includes loading the production dependencies, not just forking.
    time.sleep(1)
    return 0 if alive() else 1


if __name__ == '__main__':
    if os.environ.get('QUICKBOX_TEST_DISPOSABLE') != '1':
        sys.exit('This adapter is restricted to the disposable deployment fixture')
    action = sys.argv[1]
    if action in ['daemon-reload', 'enable']:
        sys.exit(0)
    if not any(arg == 'quickbox-ws.service' for arg in sys.argv[2:]):
        sys.exit('Unexpected service in process adapter')
    if action in ['start', 'restart']:
        sys.exit(start())
    if action == 'stop':
        stop()
        sys.exit(0)
    if action == 'is-active':
        sys.exit(0 if alive() else 1)
    sys.exit('Unsupported process-adapter action')
