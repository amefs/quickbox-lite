#!/usr/bin/env python3
"""Record CI acceptance step results and include unexecuted stages in the summary."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time

PLANS = {
    'panel': {
        'prepare': 'Prepare Node dependencies and Chromium',
        'typecheck': 'Type-check the browser suite',
        'tests': 'Dashboard rendering, widgets, state and interactions',
    },
    'sandboxes': {
        'runner': 'Acceptance runner regression checks',
        'runtime': 'Node runtime policy',
        'setup': 'Setup configuration, arguments and installation safety',
        'dashboard': 'Dashboard staging, gateway, health and update',
        'backups': 'Backup retention and configuration restore',
        'repository': 'Repository revert and reinstall',
        'progress': 'Update progress and arguments',
    },
    'linux': {
        'prepare': 'Load prepared image and start isolated environment',
        'install': 'Fresh install, permissions and sudo',
        'transports': 'HTTP, TLS and Socket.IO transports',
        'upgrade': 'Baseline upgrade and repeated upgrade',
        'recovery': 'Rollback after dependency, service, nginx and health failures',
        'mutex': 'WS and CLI update mutual exclusion',
        'cleanup': 'Collect diagnostics and remove environment',
    },
    'systemd': {
        'prepare': 'Prepare VM tools and offline application dependencies',
        'install': 'Deploy application under real systemd',
        'lifecycle': 'Unit settings, automatic restart and port recovery',
        'mutex': 'Detached update across service restart',
        'cleanup': 'Collect diagnostics and stop services',
    },
    'authentication': {
        'prepare': 'Prepare browser, application and identity providers',
        'basic': 'Basic Auth access and transports',
        'basic-webkit': 'WebKit Basic Auth login, refresh and reconnect',
        'authelia': 'Authelia login, access and session rejection',
        'vouch': 'Vouch login, access and session rejection',
        'cleanup': 'Collect diagnostics and remove authentication environment',
    },
}


def summary(suite, results):
    lines = [f'### Dashboard acceptance: {suite}', '', '| Stage | Result | Duration |',
             '| --- | --- | ---: |']
    for stage, label in PLANS[suite].items():
        result = results.get(stage, {})
        seconds = result.get('seconds')
        duration = f'{seconds:.1f}s' if seconds is not None else '—'
        lines.append(f'| {label} | {result.get("status", "skipped")} | {duration} |')
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--summary', action='store_true')
    parser.add_argument('stage', nargs='?')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    suite = os.environ['QUICKBOX_ACCEPTANCE_SUITE']
    path = Path(os.environ['QUICKBOX_ACCEPTANCE_RESULTS'])
    results = json.loads(path.read_text()) if path.exists() else {}
    if args.summary:
        rendered = summary(suite, results)
        print(rendered, end='')
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with Path(os.environ['GITHUB_STEP_SUMMARY']).open('a') as output:
                output.write(rendered)
        return 0
    if args.stage not in PLANS[suite] or not args.command:
        parser.error('Supply a planned stage followed by its command')
    started = time.monotonic()
    status = 1
    try:
        status = subprocess.run(args.command, check=False).returncode
    finally:
        results[args.stage] = dict(status='passed' if status == 0 else 'failed',
                                   seconds=time.monotonic() - started)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(results))
        temporary.replace(path)
    return status if status >= 0 else 128 - status


if __name__ == '__main__':
    raise SystemExit(main())
