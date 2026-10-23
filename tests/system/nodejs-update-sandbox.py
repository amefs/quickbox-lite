#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Exercise Node installation with private paths and mocked network/APT commands."""

import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[2]
HELPER = REPO / 'packages/system/auxiliary/qbEnsureNodejs'


class NodeUpdateTest(unittest.TestCase):
    def setUp(self):
        # Keep the sandbox root outside /tmp/quickbox*: the caller fixtures
        # below rewrite that prefix to isolate their own temporary paths.
        self.temporary = tempfile.TemporaryDirectory(prefix='nodejs-sandbox-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.runtime = self.root / 'system-node'
        self.log = self.root / 'commands'
        self.script = self.root / 'ensure-node.sh'
        self.apt = self.root / 'apt'
        (self.apt / 'sources.list.d').mkdir(parents=True)
        # Both the runtime binary and the APT list root are redirected into the
        # sandbox, so the helper never reads or writes the host's real paths.
        self.script.write_text(HELPER.read_text()
                               .replace('/usr/bin/node', str(self.runtime))
                               .replace('/etc/apt/', f'{self.apt}/'))
        self.write_command('curl', '''#!/bin/bash
printf 'curl %s\n' "$*" >>"$COMMAND_LOG"
[[ "$FAIL_STAGE" != curl ]] || exit 22
while [[ "$1" != -o ]]; do shift; done
cat >"$2" <<'SETUP'
printf 'setup\n' >>"$COMMAND_LOG"
[[ "$FAIL_STAGE" != setup ]] || exit 27
SETUP
''')
        self.write_command('apt-get', '''#!/bin/bash
printf 'apt-get %s\n' "$*" >>"$COMMAND_LOG"
[[ "$FAIL_STAGE" != apt ]] || exit 28
[[ "$FAIL_STAGE" != apt-update || "$1" != update ]] || exit 30
if [[ "$1" == install ]]; then
	printf '#!/bin/sh\nprintf "%%s\\n" "%s"\n' "$TARGET_VERSION" >"$SYSTEM_NODE"
	chmod +x "$SYSTEM_NODE"
fi
''')
        self.write_command('apt-cache', '''#!/bin/bash
printf 'apt-cache %s\n' "$*" >>"$COMMAND_LOG"
[[ "$FAIL_STAGE" != apt-cache ]] || exit 31
[[ "$CANDIDATE_PKG" != none ]] || exit 0
printf 'nodejs:\n  Installed: %s\n  Candidate: %s\n' "$INSTALLED_PKG" "$CANDIDATE_PKG"
''')
        self.write_command('dpkg', '''#!/usr/bin/env python3
import sys
assert sys.argv[1] == '--compare-versions'
first = tuple(map(int, sys.argv[2].split('.')))
second = tuple(map(int, sys.argv[4].split('.')))
result = {'ge': first >= second, 'gt': first > second}[sys.argv[3]]
sys.exit(0 if result else 1)
''')
        # A shell-level Node must never substitute for the systemd runtime.
        self.write_command('node', '#!/bin/sh\nprintf "v26.12.1\\n"\n')
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
                        COMMAND_LOG=str(self.log), SYSTEM_NODE=str(self.runtime),
                        TMPDIR=str(self.root), FAIL_STAGE='', TARGET_VERSION='v24.22.1',
                        INSTALLED_PKG='24.22.1-1nodesource1', CANDIDATE_PKG='24.22.1-1nodesource1',
                        QB_UPDATE_LIB_DIR=str(REPO / 'packages/system/update'),
                        QB_UPDATE_STEP_LIB=str(REPO / 'packages/system/update/qbUpdateStep'))

    def write_command(self, name, source):
        target = self.bin / name
        target.write_text(source)
        target.chmod(0o755)

    def publish_nodesource_list(self):
        (self.apt / 'sources.list.d' / 'nodesource.list').write_text(
            'deb https://deb.nodesource.com/node_24.x nodistro main\n')

    def run_helper(self, version=None, target='v24.22.1', failure='', arguments=(), **overrides):
        if version is not None:
            self.runtime.write_text(f'#!/bin/sh\nprintf "%s\\n" "{version}"\n')
            self.runtime.chmod(0o755)
        outcome = subprocess.run(['bash', str(self.script)] + list(arguments), text=True,
                                 capture_output=True,
                                 env=dict(self.env, TARGET_VERSION=target, FAIL_STAGE=failure,
                                          **overrides),
                                 timeout=10)
        self.assertEqual(list(self.root.glob('tmp.*')), [], 'setup directory leaked')
        return outcome, (self.log.read_text() if self.log.exists() else '')

    def test_fresh_install_major_upgrade_and_patch_refresh(self):
        for version in [None, 'v20.20.0', 'v22.23.2', 'v24.18.0', 'v24.22.1']:
            with self.subTest(version=version):
                self.log.unlink(missing_ok=True)
                result, log = self.run_helper(version)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('https://deb.nodesource.com/setup_24.x', log)
                self.assertLess(log.index('setup\n'), log.index('apt-get install -y nodejs'))
                self.assertIn('v24.22.1', result.stdout)

    def test_newer_patch_is_accepted(self):
        result, _ = self.run_helper('v24.22.1', target='v24.22.2')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_supported_runtime_refreshes_only_the_nodesource_index(self):
        self.publish_nodesource_list()
        result, log = self.run_helper('v24.22.1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('apt-get update -qq -o Dir::Etc::sourcelist=sources.list.d/nodesource.list', log)
        self.assertIn('Dir::Etc::sourceparts=-', log)
        self.assertNotIn('curl', log)
        self.assertNotIn('apt-get install', log)
        self.assertIn('already up to date', result.stdout)

    def test_available_patch_is_installed_without_the_setup_script(self):
        self.publish_nodesource_list()
        result, log = self.run_helper('v24.22.1', target='v24.22.2',
                                      CANDIDATE_PKG='24.22.2-1nodesource1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('apt-get install -y --only-upgrade nodejs', log)
        self.assertNotIn('curl', log)
        self.assertIn('v24.22.2', result.stdout)

    def test_packaging_revision_alone_is_not_a_node_update(self):
        self.publish_nodesource_list()
        result, log = self.run_helper('v24.22.1', CANDIDATE_PKG='24.22.1-1nodesource2')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('apt-get install', log)
        self.assertIn('already up to date', result.stdout)

    def test_unreadable_index_keeps_the_installed_runtime(self):
        self.publish_nodesource_list()
        result, _ = self.run_helper('v24.22.1', failure='apt-update')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Cannot refresh the NodeSource package index', result.stderr)
        self.assertIn('v24.22.1', result.stdout)

    def test_reuse_keeps_a_supported_runtime_untouched(self):
        self.publish_nodesource_list()
        result, log = self.run_helper('v24.22.1', arguments=['--reuse'],
                                      CANDIDATE_PKG='24.22.2-1nodesource1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(log.strip(), '', 'a reused runtime must not touch APT')
        self.assertIn('Keeping the installed Node.js', result.stdout)

    def test_reuse_still_installs_when_the_policy_is_not_met(self):
        self.publish_nodesource_list()
        result, log = self.run_helper('v22.23.2', arguments=['--reuse'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('https://deb.nodesource.com/setup_24.x', log)

    def test_unknown_option_is_rejected(self):
        result, _ = self.run_helper('v24.22.1', arguments=['--nope'])
        self.assertEqual(result.returncode, 2)

    def test_network_repository_and_package_failures_stop(self):
        for failure in ['curl', 'setup', 'apt']:
            with self.subTest(failure=failure):
                self.log.unlink(missing_ok=True)
                result, log = self.run_helper('v22.23.2', failure=failure)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('is ready.', result.stdout)
                self.assertIn('v22.23.2', self.runtime.read_text())
                if failure != 'apt':
                    self.assertNotIn('apt-get', log)

    def test_wrong_or_unpatched_system_runtime_is_rejected(self):
        for target in ['v22.23.4', 'v24.18.0', 'v24.22.0', 'v24.22.1-rc.1']:
            with self.subTest(target=target):
                result, _ = self.run_helper(target=target)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Node.js update failed', result.stderr)

    def test_newer_major_line_is_left_alone(self):
        # A host that already runs Node 26 must never be downgraded to the
        # managed 24.x line by a routine update.
        self.publish_nodesource_list()
        for arguments in ([], ['--reuse']):
            with self.subTest(arguments=arguments):
                self.log.unlink(missing_ok=True)
                result, log = self.run_helper('v26.12.1', arguments=arguments)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(log.strip(), '', 'a newer runtime must not touch APT')
                self.assertIn('newer than the managed 24.x line', result.stdout)

    def test_missing_system_node_is_rejected_despite_path_node(self):
        self.write_command('apt-get', '#!/bin/sh\nexit 0\n')
        result, _ = self.run_helper()
        self.assertNotEqual(result.returncode, 0)

    def test_all_callers_stop_when_runtime_update_fails(self):
        failing = self.root / 'failure.sh'
        failing.write_text('#!/bin/sh\nprintf "helper-failed\\n"\nexit 29\n')
        noop = self.root / 'noop.sh'
        noop.write_text('#!/bin/sh\nexit 0\n')
        cases = [
            ('setup.sh', '_insnodejs'),
            ('packages/system/update/qbUpdateService', '_updateservice'),
            ('packages/package/install/installpackage-flood', '_installApp'),
        ]
        for path, function in cases:
            with self.subTest(path=path):
                (self.root / 'output.log').unlink(missing_ok=True)
                source = (REPO / path).read_text()
                if function != '_updateservice':
                    source = re.search(r'^function ' + function + r'\(\) \{\n.*?^\}',
                                       source, re.M | re.S).group()
                source = source.replace('/usr/local/bin/quickbox/system/auxiliary/qbEnsureNodejs',
                                        str(failing))
                source = source.replace('/usr/local/bin/quickbox/system/auxiliary/qbEnsureSudoers',
                                        str(noop)).replace('/tmp/quickbox', str(self.root / 'flood'))
                source += '''
_errorcolor() { :; }; _defaultcolor() { :; }
_fix_nginx_app_include() { :; }
_execute() { $1 >>"$OUTTO" 2>&1; }
_error() { :; }
_info() { :; }
'''
                source += f'OUTTO={shlex.quote(str(self.root / "output.log"))}\n{function}\n'
                result = subprocess.run(['bash', '-c', source], env=self.env,
                                        text=True, capture_output=True, timeout=10)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('helper-failed', (self.root / 'output.log').read_text())


if __name__ == '__main__':
    unittest.main()
