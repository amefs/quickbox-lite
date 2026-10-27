"""Update timing, progress and degraded helper behavior."""

import os
import shutil
import subprocess
import time

import pytest

from tests.support import REPO, functions_before_main, run_bash, write_file


@pytest.fixture
def driver(tmp_path):
    root = tmp_path / "system"
    path = write_file(
        root / "qbUpdate",
        functions_before_main("packages/system/qbUpdate").replace(
            "/srv/dashboard/db/output.log", str(tmp_path / "out.log")
        ),
    )
    for name in ("qbUpdateTimer", "qbUpdateStep", "qbUpdateLib"):
        target = root / "update" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(REPO / "packages/system/update" / name, target)
    write_file(tmp_path / "bin/lsb_release", '#!/bin/sh\ncase "$1" in -cs) echo jammy;; *) echo Ubuntu;; esac\n', True)
    return path, {"PATH": str(tmp_path / "bin") + os.pathsep + os.environ["PATH"], "TMPDIR": str(tmp_path)}


def test_clock_and_formatting(driver):
    path, env = driver
    result = run_bash(
        'source "$1"; _qbNowMs; sleep 1.1; _qbNowMs; '
        'for v in 0 938 12400 65000 3900000; do _qbFormatMs "$v"; printf "\\n"; done',
        path,
        env=env,
    )
    assert result.returncode == 0, result.stderr
    lines = result.stdout.splitlines()
    assert int(lines[1]) - int(lines[0]) >= 1000
    assert lines[2:] == ["0.0s", "0.9s", "12.4s", "1m05s", "1h05m"]


def test_stage_reporting_and_failure(driver, tmp_path):
    path, env = driver
    result = run_bash(
        """source "$1"
step_ok() { sleep 0.2; }
step_fail() { return 9; }
update_started_ms=$(_qbNowMs)
_updateStep repository step_ok
_updateStep dashboard step_fail
""",
        path,
        env=env,
    )
    assert result.returncode == 1
    output = result.stdout + result.stderr
    assert "⏱ repository:" in output and "still running" not in output
    assert "Update stage failed: dashboard (after " in output
    assert "dashboard (failed)" in output and "Update timing (total " in output
    log = (tmp_path / "out.log").read_text()
    assert "Timing: repository took" in log and "Timing: update total" in log


def test_unaccounted_time_is_reported(driver):
    path, env = driver
    result = run_bash(
        'source "$1"; update_started_ms=$(_qbNowMs); _updateRecordStage repository 100; sleep 1.5; _printUpdateTiming',
        path,
        env=env,
    )
    assert result.returncode == 0
    assert "repository " in result.stdout
    assert "other (locks, prepare, cleanup)" in result.stdout
    assert "  total " in result.stdout


def test_heartbeat_silence_and_cleanup(driver, tmp_path):
    path, env = driver
    activity = tmp_path / "activity"
    output = tmp_path / "heartbeat"
    script = """source "$1"
update_activity_file="$2"
_updateActivityInit
_updateHeartbeatLoop 1 probe terminal "$(_qbNowMs)"
"""
    with output.open("w") as sink:
        process = subprocess.Popen(
            ["bash", "-c", script, "test", str(path), str(activity)],
            env=dict(os.environ, TERM="xterm", **env),
            stdout=sink,
            stderr=subprocess.PIPE,
        )
        try:
            for _ in range(5):
                time.sleep(0.35)
                activity.write_text(str(time.time_ns() // 1_000_000) + "\n")
            assert "still running" not in output.read_text()
            time.sleep(2)
        finally:
            process.terminate()
            process.wait(timeout=5)
    assert "probe still running (no output for " in output.read_text()
    result = run_bash('source "$1"; update_activity_file="$2"; _updateCleanup', path, activity, env=env)
    assert result.returncode == 0 and not activity.exists()


@pytest.mark.parametrize(
    ("arguments", "expected"),
    [
        ("--only-core", "1 0 0"),
        ("--from-checkout", "1 1 0"),
        ("--verbose", "0 0 1"),
    ],
)
def test_update_arguments(driver, arguments, expected):
    path, env = driver
    result = run_bash(
        'source "$1"; _parseUpdateArgs "$2"; printf "%s %s %s\\n" "$core" "$from_checkout" "${QB_UPDATE_VERBOSE:-0}"',
        path,
        arguments,
        env=env,
    )
    assert result.returncode == 0
    assert result.stdout.strip().endswith(expected)


def test_unknown_argument_is_rejected(driver):
    path, env = driver
    assert run_bash('source "$1"; _parseUpdateArgs --nope', path, env=env).returncode != 0


def test_missing_timer_helper_is_nonfatal(driver, tmp_path):
    path, env = driver
    broken = tmp_path / "broken"
    (broken / "update").mkdir(parents=True)
    shutil.copy(path, broken / "qbUpdate")
    shutil.copy(path.parent / "update/qbUpdateLib", broken / "update/qbUpdateLib")
    result = run_bash(
        'source "$1"; _qbNowMs; _qbFormatMs 5000; _qbReportLap "no helper" 10; _qbTouchActivity',
        broken / "qbUpdate",
        env=env,
    )
    assert result.returncode == 0
    assert result.stdout.splitlines()[:2] == ["0", "5.0s"]


@pytest.mark.parametrize("terminal", ["dumb", ""])
def test_missing_terminal_colours_are_empty(driver, terminal):
    path, env = driver
    env["TERM"] = terminal
    result = run_bash('set -e; source "$1"; printf "colors=<%s%s%s>\\n" "$_norm" "$_red" "$_cyan"', path, env=env)
    assert result.returncode == 0
    assert "colors=<>" in result.stdout
