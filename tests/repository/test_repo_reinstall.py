#!/usr/bin/env python3
"""Run box revert and its real update driver against disposable repositories.

Only installation helpers and absolute machine paths are replaced. Git reset,
argument forwarding, update orchestration and descriptor locks remain real.
"""

import fcntl
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True, stderr=subprocess.PIPE).strip()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value)


def test_revert_reinstalls_selected_checkout():
    with tempfile.TemporaryDirectory(prefix="quickbox-reinstall-") as temporary:
        root = Path(temporary)
        work = root / "repo"
        work.mkdir()
        git(work, "init", "-q", "-b", "master")
        git(work, "config", "user.email", "sandbox@example.invalid")
        git(work, "config", "user.name", "sandbox")

        # Versions predating the feature must be rejected without changing HEAD.
        write(work / "packages/system/qbUpdate", "exit 91\n")
        write(
            work / "packages/system/update/qbUpdateRepo",
            r"""
    _updateRepo() {
        printf 'repository-update\n' >>"$TEST_EVENTS"
        git -C "$QUICKBOX_REPO_ROOT" reset --hard origin/master
    }
    _setPerm() { printf 'permissions\n' >>"$TEST_EVENTS"; }
    _bashrc() { printf 'shell\n' >>"$TEST_EVENTS"; }
    _updateskel() { printf 'skel\n' >>"$TEST_EVENTS"; }
    """,
        )
        write(
            work / "packages/system/update/qbUpdateService",
            r"""
    _updateservice() {
        printf 'service\n' >>"$TEST_EVENTS"
        # A separate open file description must not acquire the inherited lock.
        bash -c 'exec 7>"$QUICKBOX_UPDATE_CORE_LOCK"; ! flock -n 7' || return 1
        [[ "${TEST_FAIL_INSTALL:-0}" != 1 ]]
    }
    """,
        )
        write(
            work / "packages/system/update/qbUpdateDashboard",
            r"""
    _updatedashboard() {
        printf 'dashboard\n' >>"$TEST_EVENTS"
        cp "$QUICKBOX_REPO_ROOT/payload" "$TEST_DEPLOYED"
    }
    _updatelanguage() { printf 'language\n' >>"$TEST_EVENTS"; }
    """,
        )
        write(work / "payload", "unsupported version\n")
        git(work, "add", ".")
        git(work, "commit", "-qm", "unsupported installer")
        unsupported = git(work, "rev-parse", "HEAD")

        # A and B both support reinstalling a selected checkout. A distinct marker
        # proves that revert invokes A's updater rather than continuing with B's.
        system = work / "packages/system"
        driver = (REPO / "packages/system/qbUpdate").read_text()
        driver = driver.replace("/srv/dashboard/db/output.log", str(root / "output.log"))
        driver = driver.replace("/install/", str(root / "install") + "/")
        driver = driver.replace("source ~/.profile", ":").replace("source ~/.bashrc", ":")
        driver = driver.replace(
            "function _installSystemUpdates() {",
            'function _installSystemUpdates() {\n    printf "system-packages\\n" >>"$TEST_EVENTS"; return 93\n',
        )
        driver = driver.replace(
            '_parseUpdateArgs "$@" || exit $?',
            '_parseUpdateArgs "$@" || exit $?\nprintf "driver-A\\n" >>"$TEST_EVENTS"',
        )
        write(system / "qbUpdate", driver)
        write(system / "update/qbUpdateRevert", (REPO / "packages/system/update/qbUpdateRevert").read_text())
        for shared in ("qbUpdateLib", "qbUpdateTimer", "qbUpdateStep"):
            shutil.copy(REPO / "packages/system/update" / shared, system / "update" / shared)
        box = (
            (REPO / "packages/system/box").read_text().replace("/usr/local/bin/quickbox/", str(work / "packages") + "/")
        )
        write(system / "box", box)
        write(work / "payload", "version A\n")
        git(work, "add", ".")
        git(work, "commit", "-qm", "A: supports checkout installation")
        base = git(work, "rev-parse", "HEAD")

        write(system / "qbUpdate", driver.replace("driver-A", "driver-B"))
        write(work / "payload", "version B\n")
        git(work, "add", ".")
        git(work, "commit", "-qm", "B: current installer")
        current = git(work, "rev-parse", "HEAD")
        git(work, "update-ref", "refs/remotes/origin/master", current)

        bin_dir = root / "bin"
        write(bin_dir / "lsb_release", '#!/bin/sh\nprintf "jammy\\n"\n')
        (bin_dir / "lsb_release").chmod(0o755)
        if not shutil.which("flock"):
            write(
                bin_dir / "flock",
                """#!/usr/bin/env python3
import fcntl
import sys
try:
    fcntl.flock(int(sys.argv[-1]), fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    sys.exit(1)
""",
            )
            (bin_dir / "flock").chmod(0o755)
        (root / "install").mkdir()
        backup = root / "backups"
        backup.mkdir()
        state = (
            f"QUICKBOX_REPO={work}\nQUICKBOX_REPO_BRANCH=master\n"
            f"QUICKBOX_REPO_COMMIT={base}\nQUICKBOX_REPO_TIMESTAMP=20240101-000000\n"
        )
        write(backup / "repo-state.env", state)
        history = f"20240101-000000\tmaster\t{base}\t{work}\n"
        write(backup / "repo-history.tsv", history)
        git(work, "update-ref", "refs/quickbox/pre-update-latest", base)
        events = root / "events"
        deployed = root / "deployed"
        env = dict(
            os.environ,
            TERM="xterm",
            PATH=str(bin_dir) + os.pathsep + os.environ["PATH"],
            QUICKBOX_ALLOW_NON_ROOT="1",
            QUICKBOX_BACKUP_DIR=str(backup),
            QUICKBOX_REPO_ROOT=str(work),
            QUICKBOX_UPDATE_CORE_LOCK=str(root / "update.lock"),
            QUICKBOX_OPERATION_LOCK=str(root / "operation.lock"),
            TMPDIR=str(root),
            TEST_EVENTS=str(events),
            TEST_DEPLOYED=str(deployed),
        )

        def reset():
            git(work, "checkout", "--force", "-B", "master", current)
            events.write_text("")
            deployed.unlink(missing_ok=True)

        def box_run(*args, **overrides):
            return subprocess.run(
                ["bash", str(system / "box"), *args],
                env=dict(env, **overrides),
                capture_output=True,
                text=True,
                input="",
                timeout=20,
            )

        # Both CLI spellings must pass the option and commit as separate arguments.
        for args in [("revert", "--yes", base), ("update", "revert", "--yes", base), ("revert", "--yes")]:
            reset()
            result = box_run(*args)
            assert result.returncode == 0, (args, result.stdout, result.stderr)
            assert git(work, "rev-parse", "HEAD") == base
            assert deployed.read_text() == "version A\n"
            assert events.read_text().splitlines() == [
                "driver-A",
                "permissions",
                "shell",
                "skel",
                "service",
                "dashboard",
                "language",
            ]
            assert (backup / "repo-state.env").read_text() == state
            assert (backup / "repo-history.tsv").read_text() == history
            assert git(work, "rev-parse", "refs/quickbox/pre-update-latest") == base
            assert not (root / "install/.install.lock").exists()
            assert "restored and reinstalled" in result.stderr
            print(f"{' '.join(args[:2])}: pinned reinstall passed")

        # Reinstallation failure must propagate and leave the chosen commit in
        # place, with no success message and no stale installation lock.
        reset()
        result = box_run("revert", "--yes", base, TEST_FAIL_INSTALL="1")
        assert result.returncode == 1, (result.stdout, result.stderr)
        assert git(work, "rev-parse", "HEAD") == base
        assert not deployed.exists()
        assert "reinstallation failed" in result.stderr
        assert "restored and reinstalled" not in result.stderr
        assert not (root / "install/.install.lock").exists()
        print("reinstall failure: passed")

        reset()
        with (root / "update.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = box_run("revert", "--yes", base)
            assert result.returncode == 75, (result.stdout, result.stderr)
            assert git(work, "rev-parse", "HEAD") == current
            assert not events.read_text()
            # Listing recovery points is read-only and must work during an update.
            result = box_run("revert", "--list")
            assert result.returncode == 0 and base in result.stdout
        print("concurrent update refusal and read-only list: passed")

        reset()
        result = box_run("revert", "--yes", "invalid-commit")
        assert result.returncode == 1, (result.stdout, result.stderr)
        assert git(work, "rev-parse", "HEAD") == current
        assert not events.read_text()
        result = box_run("revert")
        assert result.returncode == 1, (result.stdout, result.stderr)
        assert git(work, "rev-parse", "HEAD") == current
        print("invalid commit and declined confirmation: passed")

        result = box_run("revert", "--yes", unsupported)
        assert result.returncode == 1, (result.stdout, result.stderr)
        assert "does not support reinstallation" in result.stderr
        assert git(work, "rev-parse", "HEAD") == current
        assert not events.read_text()
        print("unsupported target refusal: passed")

        # The public update entry point supports retrying the selected checkout,
        # including multiple options, without taking a new repository snapshot.
        for args in [
            ("update", "quickbox", "--from-checkout"),
            ("update", "quickbox", "--only-core", "--from-checkout"),
        ]:
            reset()
            result = box_run(*args)
            assert result.returncode == 0, (args, result.stdout, result.stderr)
            assert git(work, "rev-parse", "HEAD") == current
            assert deployed.read_text() == "version B\n"
            assert events.read_text().splitlines() == [
                "driver-B",
                "permissions",
                "shell",
                "skel",
                "service",
                "dashboard",
                "language",
            ]
            assert (backup / "repo-state.env").read_text() == state
        print("checkout installation and option forwarding: passed")

        # Exercise the full lifecycle with the actual state-recording stage:
        # normal update A -> B, then revert and reinstall A while origin stays B.
        reset()
        git(work, "reset", "--hard", base)
        result = box_run("update", "quickbox", "--only-core")
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert git(work, "rev-parse", "HEAD") == current
        assert deployed.read_text() == "version B\n"
        assert "repository-update" in events.read_text().splitlines()
        assert f"QUICKBOX_REPO_COMMIT={base}\n" in (backup / "repo-state.env").read_text()
        recorded_state = (backup / "repo-state.env").read_text()
        recorded_history = (backup / "repo-history.tsv").read_text()
        events.write_text("")
        result = box_run("revert", "--yes")
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert git(work, "rev-parse", "HEAD") == base
        assert deployed.read_text() == "version A\n"
        assert git(work, "rev-parse", "origin/master") == current
        assert (backup / "repo-state.env").read_text() == recorded_state
        assert (backup / "repo-history.tsv").read_text() == recorded_history
        assert "repository-update" not in events.read_text().splitlines()
        print("normal update B followed by revert and reinstall A: passed")

    print("repository revert and reinstall sandbox checks passed")
