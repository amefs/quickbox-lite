#!/usr/bin/env python3
"""Check the layered rollback report of a failed update.

The update driver is sourced without its main process, so ``_updateAbort`` can be
called with each rollback layer in a known state. Every machine path it touches
is rewritten into a temporary directory.
"""

import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]
DRIVER = (REPO / "packages/system/qbUpdate").read_text().split("# MAIN PROCESS")[0]


def run(command):
    return subprocess.run(command, check=True, capture_output=True, text=True).stdout.strip()


def run_abort(root, restore_status, committed, recorded_ref, backup_ready=1):
    """Run _updateAbort once in ``root`` and return the completed process."""
    root.mkdir()
    repo = root / "repo"
    repo.mkdir()
    run(["git", "init", "-q", str(repo)])
    (repo / "tracked").write_text("base\n")
    run(["git", "-C", str(repo), "add", "."])
    run(
        [
            "git",
            "-C",
            str(repo),
            "-c",
            "user.email=s@example.invalid",
            "-c",
            "user.name=sandbox",
            "commit",
            "-qm",
            "base",
        ]
    )
    if recorded_ref:
        head = run(["git", "-C", str(repo), "rev-parse", "HEAD"])
        run(["git", "-C", str(repo), "update-ref", "refs/quickbox/pre-update-latest", head])

    text = DRIVER
    text = text.replace("/srv/dashboard/db/output.log", str(root / "output.log"))
    text = text.replace("/install/", str(root / "install") + "/")
    text = text.replace("source ~/.profile", ":").replace("source ~/.bashrc", ":")
    driver = root / "driver.sh"
    driver.write_text(text)
    (root / "install").mkdir()
    (root / "output.log").write_text("")

    harness = root / "harness.sh"
    harness.write_text(
        "set -u\n"
        f'source "{driver}"\n'
        f'OUTTO="{root}/output.log"\n'
        f'QUICKBOX_REPO_ROOT="{repo}"\n'
        f'update_backup_dir="{root}/backups"\n'
        f"update_backup_ready={backup_ready}\n"
        "update_started_ms=0\n"
        f"update_config_committed={committed}\n"
        f"_restoreUpdateConfig() {{ return {restore_status}; }}\n"
        "_printUpdateTiming() { :; }\n"
        "_releaseUpdateInstallLock() { :; }\n"
        '_updateAbort "fixture stage"\n'
    )
    return subprocess.run(
        ["bash", str(harness)],
        capture_output=True,
        text=True,
        env=dict(os.environ, TERM="xterm", QB_UPDATE_LIB_DIR=str(REPO / "packages/system/update")),
        timeout=30,
    )


def test_update_abort_rollback_states():
    with tempfile.TemporaryDirectory(prefix="quickbox-abort-scope-") as temporary:
        base = Path(temporary)

        outcome = run_abort(base / "restore-ok", 0, 0, recorded_ref=True)
        log = (base / "restore-ok" / "output.log").read_text()
        assert outcome.returncode == 1, (outcome.returncode, outcome.stdout, outcome.stderr)
        assert "Update aborted at stage: fixture stage" in log, log
        print("committed=0 restore=ok: passed")

        outcome = run_abort(base / "restore-failed", 1, 0, recorded_ref=False)
        log = (base / "restore-failed" / "output.log").read_text()
        assert outcome.returncode == 1, (outcome.returncode, outcome.stdout, outcome.stderr)
        assert "Automatic configuration rollback failed" in outcome.stdout, outcome.stdout
        assert "rollback succeeded" not in outcome.stdout, outcome.stdout
        print("committed=0 restore=failed: passed")

        outcome = run_abort(base / "committed", 0, 1, recorded_ref=True)
        assert outcome.returncode == 1, (outcome.returncode, outcome.stdout, outcome.stderr)
        assert "Configuration rollback skipped" in outcome.stdout, outcome.stdout
        assert "rollback succeeded" not in outcome.stdout, outcome.stdout
        print("committed=1: passed")

        # A missing configuration backup is reported as unavailable.
        outcome = run_abort(base / "no-backup", 0, 0, recorded_ref=True, backup_ready=0)
        assert outcome.returncode == 1, (outcome.returncode, outcome.stdout, outcome.stderr)
        assert "Configuration rollback unavailable" in outcome.stdout, outcome.stdout
        assert "rollback succeeded" not in outcome.stdout, outcome.stdout
        print("no configuration backup: passed")

    print("update rollback scope sandbox checks passed")
