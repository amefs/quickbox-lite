#!/usr/bin/env python3
"""Regression checks for staged acceptance, failure propagation and reporting."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

DIRECTORY = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('deployment_run', DIRECTORY / 'run.py')
deployment = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deployment)


class DeploymentPhasesTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        state = patch.object(deployment, 'STATE', Path(self.directory.name))
        state.start()
        self.addCleanup(state.stop)

    def invoke(self, *arguments):
        with patch.object(sys, 'argv', ['run.py', *arguments]), \
                patch.object(sys, 'platform', 'linux'), patch.object(os, 'geteuid', return_value=0), \
                patch.dict(os.environ, QUICKBOX_TEST_DISPOSABLE='1'), contextlib.redirect_stdout(io.StringIO()):
            deployment.main()

    def test_systemd_only_runs_service_specific_checks(self):
        with patch.object(deployment, 'execute_phase') as execute, patch.object(deployment, 'cleanup') as cleanup:
            self.invoke('--systemd')
        self.assertEqual([call.args[0] for call in execute.call_args_list], ['install', 'lifecycle', 'mutex'])
        cleanup.assert_called_once()

    def test_default_linux_sequence_and_failure_cleanup(self):
        with patch.object(deployment, 'execute_phase', side_effect=[None, None, RuntimeError('upgrade failed')]) as execute, \
                patch.object(deployment, 'cleanup') as cleanup:
            with self.assertRaisesRegex(RuntimeError, 'upgrade failed'):
                self.invoke()
        self.assertEqual([call.args[0] for call in execute.call_args_list], ['install', 'transports', 'upgrade'])
        cleanup.assert_called_once()

    def test_selected_phase_keeps_environment_until_explicit_cleanup(self):
        with patch.object(deployment, 'execute_phase') as execute, patch.object(deployment, 'cleanup') as cleanup:
            self.invoke('--phase', 'install')
        execute.assert_called_once_with('install')
        cleanup.assert_not_called()

    def test_failed_install_cannot_unlock_later_phases(self):
        with patch.object(deployment, 'install', side_effect=RuntimeError('npm cache missing')):
            with self.assertRaisesRegex(RuntimeError, 'npm cache missing'):
                deployment.execute_phase('install')
        with patch.object(deployment, 'transports') as transports:
            with self.assertRaisesRegex(RuntimeError, 'install phase successfully'):
                deployment.execute_phase('transports')
        transports.assert_not_called()

    def test_recovery_requires_successful_upgrade(self):
        (deployment.STATE / 'install.passed').touch()
        with patch.object(deployment, 'recovery') as recovery:
            with self.assertRaisesRegex(RuntimeError, 'upgrade phase successfully'):
                deployment.execute_phase('recovery')
        recovery.assert_not_called()

    def test_failed_rerun_removes_success_marker(self):
        (deployment.STATE / 'install.passed').touch()
        (deployment.STATE / 'upgrade.passed').touch()
        with patch.object(deployment, 'upgrade', side_effect=RuntimeError('failure')):
            with self.assertRaises(RuntimeError):
                deployment.execute_phase('upgrade')
        self.assertFalse((deployment.STATE / 'upgrade.passed').exists())


class ReportingTest(unittest.TestCase):
    def test_failure_exit_status_timing_and_skipped_stages(self):
        with tempfile.TemporaryDirectory() as directory:
            results = Path(directory) / 'results.json'
            summary = Path(directory) / 'summary.md'
            env = dict(os.environ, QUICKBOX_ACCEPTANCE_SUITE='linux',
                       QUICKBOX_ACCEPTANCE_RESULTS=str(results), GITHUB_STEP_SUMMARY=str(summary))
            command = [sys.executable, str(DIRECTORY / 'report.py')]
            passed = subprocess.run([*command, 'prepare', sys.executable, '-c', 'pass'], env=env, capture_output=True)
            failed = subprocess.run([*command, 'install', sys.executable, '-c', 'raise SystemExit(23)'],
                                    env=env, capture_output=True)
            rendered = subprocess.run([*command, '--summary'], env=env, capture_output=True, text=True, check=True)
            self.assertEqual(passed.returncode, 0)
            self.assertEqual(failed.returncode, 23)
            data = json.loads(results.read_text())
            self.assertEqual(data['prepare']['status'], 'passed')
            self.assertEqual(data['install']['status'], 'failed')
            self.assertGreaterEqual(data['install']['seconds'], 0)
            self.assertIn('| Fresh install, permissions and sudo | failed |', rendered.stdout)
            self.assertIn('| Baseline upgrade and repeated upgrade | skipped |', rendered.stdout)
            self.assertEqual(rendered.stdout, summary.read_text())

    def test_missing_command_is_reported_as_failed(self):
        with tempfile.TemporaryDirectory() as directory:
            results = Path(directory) / 'results.json'
            env = dict(os.environ, QUICKBOX_ACCEPTANCE_SUITE='sandboxes', QUICKBOX_ACCEPTANCE_RESULTS=str(results))
            result = subprocess.run([sys.executable, str(DIRECTORY / 'report.py'), 'runtime',
                                     str(Path(directory) / 'missing-command')], env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(results.read_text())['runtime']['status'], 'failed')


class ContainerWrapperTest(unittest.TestCase):
    def test_prepared_image_starts_without_mounts_and_propagates_docker_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            binary = Path(directory) / 'docker'
            log = Path(directory) / 'docker.log'
            binary.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >>"$DOCKER_TEST_LOG"\nexit "${DOCKER_TEST_STATUS:-0}"\n')
            binary.chmod(0o755)
            git = Path(directory) / 'git'
            git.write_text('#!/bin/sh\necho "Prepared images must not access Git history" >&2\nexit 99\n')
            git.chmod(0o755)
            env = dict(os.environ, PATH=directory + os.pathsep + os.environ['PATH'],
                       QUICKBOX_DEPLOYMENT_USE_IMAGE='1', QUICKBOX_DEPLOYMENT_SKIP_BUILD='0',
                       QUICKBOX_TEST_BASELINE='unavailable-in-shallow-checkout',
                       QUICKBOX_DEPLOYMENT_CONTAINER='quickbox-wrapper-test', DOCKER_TEST_LOG=str(log))
            command = ['bash', str(DIRECTORY / 'run-linux.sh'), '--start']
            result = subprocess.run(command, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('run -d --name quickbox-wrapper-test', log.read_text())
            self.assertIn('--network=none', log.read_text())
            self.assertNotIn(' -v ', log.read_text())
            self.assertNotIn('build ', log.read_text())
            failure = subprocess.run(command, env=dict(env, DOCKER_TEST_STATUS='23'), capture_output=True)
            self.assertEqual(failure.returncode, 23)


if __name__ == '__main__':
    unittest.main()
