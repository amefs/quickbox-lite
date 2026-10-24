#!/usr/bin/env python3
"""Discoverable entry point for the ``tests/system`` sandboxes.

Every sandbox stays a standalone script; this module only schedules them, so

    python3 -m unittest tests.system.test_sandboxes -k test_backups_ -v

runs exactly what CI runs for that stage, and ``-k backup_retention`` selects a
single script. Group membership lives here only: ``run-dashboard-sandboxes.sh``
delegates to this module instead of keeping a second list, and a sandbox that
gains a case needs no edit outside its own file (cases are auto-discovered, see
``sandbox_support.run_cases``).
"""
import os
from pathlib import Path
import subprocess
import sys
import unittest

SYSTEM_DIR = Path(__file__).resolve().parent
REPO_ROOT = SYSTEM_DIR.parents[1]

# CI stage -> scripts. Keep in sync with the step names in
# .github/workflows/deployment.yml; adding a script is a one-line change here.
GROUPS = {
    "runtime": ("nodejs-update-sandbox.py",),
    "dashboard": (
        "dashboard-stage-sandbox.sh",
        "qb-ensure-ws-gateway-sandbox.py",
        "ws-health-startup-sandbox.py",
        "ws-health-proxy-sandbox.py",
        "theme-selection-sandbox.py",
        "dashboard-update-sandbox.py",
    ),
    "backups": ("backup-retention-sandbox.py", "update-config-backup-sandbox.sh"),
    "repository": ("repo-state-revert-sandbox.sh", "repo-reinstall-sandbox.py"),
    "progress": ("update-timing-sandbox.sh",),
}

TIMEOUT_SECONDS = int(os.environ.get("QUICKBOX_SANDBOX_TIMEOUT", "300"))


def _slug(script):
    return "".join(char if char.isalnum() else "_" for char in Path(script).stem)


class SandboxScripts(unittest.TestCase):
    """One test per sandbox script, tagged with the CI stage that runs it."""


def _make_runner(group, script):
    path = SYSTEM_DIR / script

    def run(self):
        if not path.exists():
            self.fail(f"missing sandbox script: {script}")
        if path.suffix == ".py":
            command = [sys.executable, str(path)]
        else:
            command = ["bash", str(path)]
        try:
            completed = subprocess.run(
                command,
                cwd=REPO_ROOT,
                # Unbuffered children keep their stdout in execution order with
                # unittest's own progress lines once CI merges the two streams.
                env=dict(os.environ, TERM="xterm", PYTHONUNBUFFERED="1"),
                timeout=TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            self.fail(f"{script} exceeded the {TIMEOUT_SECONDS}s budget")
        self.assertEqual(completed.returncode, 0, f"{script} exited with {completed.returncode}")

    return run


def _install_tests():
    for group, scripts in GROUPS.items():
        for index, script in enumerate(scripts, start=1):
            method = _make_runner(group, script)
            method.__name__ = f"test_{group}_{index:02d}_{_slug(script)}"
            method.__doc__ = f"{group}: {script}"
            setattr(SandboxScripts, method.__name__, method)


_install_tests()


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--groups" in argv:
        print("\n".join(GROUPS))
        return 0
    if "--list" in argv:
        for group, scripts in GROUPS.items():
            for script in scripts:
                print(f"{group}\t{script}")
        return 0
    print("usage: python3 -m tests.system.test_sandboxes [--groups|--list]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
