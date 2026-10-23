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
        self.temporary = tempfile.TemporaryDirectory(prefix='quickbox-nodejs-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.runtime = self.root / 'system-node'
        self.log = self.root / 'commands'
        self.script = self.root / 'ensure-node.sh'
        self.script.write_text(HELPER.read_text().replace('/usr/bin/node', str(self.runtime)))
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
printf '#!/bin/sh\nprintf "%%s\\n" "%s"\n' "$TARGET_VERSION" >"$SYSTEM_NODE"
chmod +x "$SYSTEM_NODE"
''')
        self.write_command('dpkg', '''#!/usr/bin/env python3
import sys
assert sys.argv[1] == '--compare-versions' and sys.argv[3] == 'ge'
sys.exit(0 if tuple(map(int, sys.argv[2].split('.'))) >=
         tuple(map(int, sys.argv[4].split('.'))) else 1)
''')
        # A shell-level Node must never substitute for the systemd runtime.
        self.write_command('node', '#!/bin/sh\nprintf "v26.12.1\\n"\n')
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
                        COMMAND_LOG=str(self.log), SYSTEM_NODE=str(self.runtime),
                        TMPDIR=str(self.root), FAIL_STAGE='', TARGET_VERSION='v24.22.1')

    def write_command(self, name, source):
        target = self.bin / name
        target.write_text(source)
        target.chmod(0o755)

    def run_helper(self, version=None, target='v24.22.1', failure=''):
        if version is not None:
            self.runtime.write_text(f'#!/bin/sh\nprintf "%s\\n" "{version}"\n')
            self.runtime.chmod(0o755)
        outcome = subprocess.run(['bash', str(self.script)], text=True, capture_output=True,
                                 env=dict(self.env, TARGET_VERSION=target, FAIL_STAGE=failure),
                                 timeout=10)
        self.assertEqual(list(self.root.glob('tmp.*')), [], 'setup directory leaked')
        return outcome, self.log.read_text()

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

    def test_network_repository_and_package_failures_stop(self):
        for failure in ['curl', 'setup', 'apt']:
            with self.subTest(failure=failure):
                self.log.unlink(missing_ok=True)
                result, log = self.run_helper('v22.23.2', failure=failure)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('System Node.js updated', result.stdout)
                self.assertIn('v22.23.2', self.runtime.read_text())
                if failure != 'apt':
                    self.assertNotIn('apt-get', log)

    def test_wrong_or_unpatched_system_runtime_is_rejected(self):
        for target in ['v22.23.4', 'v24.18.0', 'v24.22.0', 'v26.12.1', 'v24.22.1-rc.1']:
            with self.subTest(target=target):
                result, _ = self.run_helper(target=target)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Node.js update failed', result.stderr)

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
