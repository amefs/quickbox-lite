#!/usr/bin/env python3
"""Exercise the real update function with safe paths and failing command fixtures.

This checks shell orchestration, not Linux systemd/nginx/sudo behavior.
"""
import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]
SCRIPT = (REPO / 'packages/system/update/qbUpdateDashboard').read_text()


def run_case(stage):
    with tempfile.TemporaryDirectory(prefix='quickbox-update-') as temporary:
        root = Path(temporary)
        for name in ['srv/dashboard/ws/node_modules/old', 'srv/dashboard/db',
                     'srv/dashboard/skins', 'etc/nginx/apps', 'etc/nginx/snippets',
                     'etc/systemd/system', 'etc/quickbox', 'root', 'install',
                     'payload/ws', 'payload/db', 'payload/skins', 'templates/nginx',
                     'templates/systemd', 'quickbox/system/auxiliary', 'quickbox/system/theme']:
            (root / name).mkdir(parents=True, exist_ok=True)
        fixtures = {
            'srv/dashboard/ws/dist.js': 'old-runtime',
            'srv/dashboard/ws/node_modules/old/index.js': 'old-dependency',
            'srv/dashboard/db/output.log': 'old-log\n',
            'srv/dashboard/db/output.log.epoch': 'epoch-old\n',
            'srv/dashboard/db/output.log.generation': 'legacy-marker\n',
            'srv/dashboard/db/master.txt': 'fixture\n',
            'srv/dashboard/db/update.pid': '12345\n',
            'srv/dashboard/skins/custom.css': 'custom-style',
            'etc/nginx/apps/dashboard.conf': 'old-vhost',
            'etc/nginx/snippets/proxy.conf': 'old-proxy',
            'etc/systemd/system/quickbox-ws.service': 'old-unit',
            'root/.admin.info': 'fixture:fixture-ciphertext',
            'payload/ws/dist.js': 'new-runtime-v2',
            'payload/ws/package.json': '{}',
            'templates/nginx/dashboard.conf.template':
                'location / {\n    # qb-auth-begin\n    auth_basic "fixture";\n}\n',
            'templates/nginx/proxy.conf.template': 'new-proxy',
            'templates/systemd/quickbox-ws.service.template': 'new-unit',
        }
        for name, value in fixtures.items():
            (root / name).write_text(value)

        def rewrite(text):
            for old, new in [('/usr/local/bin/quickbox/', str(root / 'quickbox') + '/'),
                             ('/srv/', str(root / 'srv') + '/'),
                             ('/etc/nginx/', str(root / 'etc/nginx') + '/'),
                             ('/etc/systemd/', str(root / 'etc/systemd') + '/'),
                             ('/etc/quickbox/', str(root / 'etc/quickbox') + '/'),
                             ('/root/', str(root / 'root') + '/'),
                             ('/install/', str(root / 'install') + '/')]:
                text = text.replace(old, new)
            return text

        auxiliary = root / 'quickbox/system/auxiliary'
        (auxiliary / 'qbNginxProxyMigrate').write_text(rewrite(
            'printf new-proxy >/etc/nginx/snippets/proxy.conf\n'))
        (auxiliary / 'qbEnsureWsGateway').write_text(rewrite(
            'printf fixture-secret >/etc/quickbox/ws.secret\n'
            'printf new-gateway >/etc/nginx/snippets/quickbox-ws-gateway.conf\n'))
        (auxiliary / 'qbNginxAuth').write_text('printf \'    auth_basic "fixture";\\n\'\n')
        (auxiliary / 'qbWsHealthCheck').write_text('[ "$FAIL_STAGE" != health ]\n')
        for theme in ['smoked', 'defaulted']:
            (root / f'quickbox/system/theme/themeSelect-{theme}').write_text(
                '[ "$FAIL_STAGE" != theme ]\n')
        driver = root / 'driver.sh'
        driver.write_text(rewrite(SCRIPT) + r'''
_norm= _cyan= _green= _tan= _red=
OUTTO="$SANDBOX/srv/dashboard/db/output.log"
local_setup_dashboard="$SANDBOX/payload/"
local_setup_template="$SANDBOX/templates/"
QUICKBOX_BACKUP_DIR="$SANDBOX/backups"
export OUTTO QUICKBOX_BACKUP_DIR
chown() { return 0; }
# The updater runs as root in production. This sandbox is unprivileged, so
# keep install's modes but strip the ownership flags.
install() {
    local args=() arg
    while (($#)); do
        case "$1" in
        -o | --owner | -g | --group)
            shift 2
            ;;
        *)
            args+=("$1")
            shift
            ;;
        esac
    done
    command install "${args[@]}"
}
npm() {
    [[ "$FAIL_STAGE" != npm ]] || return 23
    mkdir -p node_modules/new
    printf new-dependency >node_modules/new/index.js
}
systemctl() {
    if [[ "$FAIL_STAGE" == restart && "$1" == restart && ! -e "$SANDBOX/failed-once" ]]; then
        touch "$SANDBOX/failed-once"; return 25
    fi
    return 0
}
nginx() {
    if [[ "$FAIL_STAGE" == nginx-test && "$1" == -t && ! -e "$SANDBOX/failed-once" ]] ||
       [[ "$FAIL_STAGE" == nginx-reload && "$*" == '-s reload' && ! -e "$SANDBOX/failed-once" ]]; then
        touch "$SANDBOX/failed-once"; return 26
    fi
    return 0
}
export -f npm chown install systemctl nginx
exec 9>>"$OUTTO"
_updatedashboard
result=$?
printf 'after-update-via-original-fd\n' >&9
exec 9>&-
exit "$result"
''')
        result = subprocess.run(
            ['bash', str(driver)],
            env=dict(os.environ, SANDBOX=str(root), FAIL_STAGE=stage,
                     QB_UPDATE_BACKUP_LIB=str(REPO / 'packages/system/update/qbUpdateBackup')),
            capture_output=True, text=True)
        live = root / 'srv/dashboard'
        assert 'after-update-via-original-fd' in (live / 'db/output.log').read_text(), result.stderr
        assert (live / 'db/master.txt').read_text() == 'fixture\n'
        assert (live / 'db/output.log.epoch').read_text() == 'epoch-old\n'
        assert (live / 'db/update.pid').read_text() == '12345\n'
        assert (live / 'skins/custom.css').read_text() == 'custom-style'
        if stage == 'success':
            assert result.returncode == 0, (result.stdout, result.stderr)
            assert (live / 'ws/dist.js').read_text() == 'new-runtime-v2'
            assert not (live / 'db/output.log.generation').exists()
            assert (live / 'ws/node_modules/new/index.js').read_text() == 'new-dependency'
            assert not (live / 'ws/node_modules/old').exists()
            backups = root / 'backups'
            assert backups.stat().st_mode & 0o777 == 0o700
            dashboard_backups = list(backups.glob('*-dashboard'))
            assert len(dashboard_backups) == 1, dashboard_backups
            assert dashboard_backups[0].stat().st_mode & 0o777 == 0o700
        else:
            assert result.returncode != 0, (stage, result.stdout, result.stderr)
            assert (live / 'ws/dist.js').read_text() == 'old-runtime', stage
            assert (live / 'ws/node_modules/old/index.js').read_text() == 'old-dependency', stage
            for name in ['etc/nginx/apps/dashboard.conf', 'etc/nginx/snippets/proxy.conf',
                         'etc/systemd/system/quickbox-ws.service']:
                assert (root / name).read_text() == fixtures[name], stage
            assert not (root / 'etc/quickbox/ws.secret').exists(), stage
            assert not (root / 'etc/nginx/snippets/quickbox-ws-gateway.conf').exists(), stage
            assert 'QuickBox dashboard updated' not in result.stdout, stage
            if stage != 'npm':
                assert 'Rollback completed successfully' in result.stdout, (stage, result.stdout)
        print(f'{stage}: passed')


for failure in ['npm', 'restart', 'nginx-test', 'nginx-reload', 'health', 'theme', 'success']:
    run_case(failure)

# Load only the CLI definitions, never its real update entry point. An early
# error exit must release the legacy installation marker owned by this updater.
with tempfile.TemporaryDirectory(prefix='quickbox-cli-lock-') as temporary:
    root = Path(temporary)
    definitions = (REPO / 'packages/system/qbUpdate').read_text().split('# MAIN PROCESS')[0]
    (root / 'library.sh').write_text(definitions.replace('/install/', str(root) + '/'))
    outcome = subprocess.run(
        ['bash', '-c', 'source "$1"; _setLock || exit 1; trap _releaseUpdateInstallLock EXIT; exit 42',
         'bash', str(root / 'library.sh')], env=dict(os.environ, TERM='xterm'),
        capture_output=True, text=True)
    assert outcome.returncode == 42, outcome.stderr
    assert not (root / '.install.lock').exists()
    print('CLI early-exit lock cleanup: passed')
