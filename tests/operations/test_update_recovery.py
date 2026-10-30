"""Exercise interrupted update recovery and abort in isolated paths."""

import os
from pathlib import Path
import shutil
import subprocess

import pytest

from tests.support import REPO, write_file


def executable(path, text):
    write_file(path, text, executable=True)
    return path


def run(script, env, *args):
    return subprocess.run(["bash", str(script), *args], env=env, text=True, capture_output=True, timeout=30)


def test_abort_ignores_dashboard_pid(tmp_path):
    source = (REPO / "packages/system/auxiliary/qbAbortTask").read_text()
    source = source.replace("/srv/dashboard/db/output.log", str(tmp_path / "log"))
    source = source.replace("/install/.install.lock", str(tmp_path / "install.lock"))
    script = write_file(tmp_path / "abort", source)
    executable(tmp_path / "bin/pgrep", "#!/bin/sh\nexit 1\n")
    (tmp_path / "install.lock").write_text("QuickBox\n")
    victim = subprocess.Popen(["sleep", "30"])
    try:
        (tmp_path / "update.pid").write_text(f"{victim.pid}\n")
        env = dict(os.environ, TERM="xterm", PATH=f"{tmp_path / 'bin'}:{os.environ['PATH']}",
                   QUICKBOX_OPERATION_LOCK=str(tmp_path / "operation.lock"))
        result = run(script, env)
        assert result.returncode == 0, result.stderr
        assert victim.poll() is None
        assert not (tmp_path / "install.lock").exists()
    finally:
        victim.terminate()
        victim.wait()


@pytest.mark.skipif(os.geteuid() != 0, reason="task owner matching requires root")
def test_abort_stops_root_owned_task(tmp_path):
    prefix = tmp_path / "quickbox"
    task = executable(prefix / "system/qbUpdate", "#!/bin/bash\nsleep 30\n")
    process = subprocess.Popen(["bash", str(task)])
    source = (REPO / "packages/system/auxiliary/qbAbortTask").read_text()
    source = source.replace("/usr/local/bin/quickbox/", f"{prefix}/")
    source = source.replace("/srv/dashboard/db/output.log", str(tmp_path / "log"))
    source = source.replace("/install/.install.lock", str(tmp_path / "install.lock"))
    script = write_file(tmp_path / "abort", source)
    (tmp_path / "install.lock").write_text("QuickBox\n")
    env = dict(os.environ, TERM="xterm", QUICKBOX_OPERATION_LOCK=str(tmp_path / "op.lock"))
    try:
        result = run(script, env)
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert process.wait(timeout=5) != 0
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()


@pytest.mark.parametrize("state", ["before_swap", "between_moves", "after_swap"])
def test_recover_interrupted_release(tmp_path, state):
    lib = tmp_path / "lib"
    lib.mkdir()
    for name in ("qbUpdateLib", "qbUpdateTimer", "qbUpdateStep", "qbUpdateBackup"):
        shutil.copy(REPO / "packages/system/update" / name, lib / name)
    srv = tmp_path / "srv"
    srv.mkdir()
    dashboard = srv / "dashboard"
    stage = srv / ".dashboard-stage.ABC123"
    previous = Path(f"{stage}.previous")
    source = (REPO / "packages/system/update/qbUpdateRecovery").read_text()
    source = source.replace("/srv/dashboard", str(dashboard))
    source = source.replace("/srv/.dashboard-stage.", f"{srv}/.dashboard-stage.")
    source = source.replace(r"^/srv/\.dashboard-stage\.", f"^{srv}/" + r"\.dashboard-stage\.")
    write_file(lib / "qbUpdateRecovery", source)
    script = write_file(lib / "resume", '_info() { :; }; source "$1/qbUpdateLib"; '
                        'source "$1/qbUpdateRecovery"; _qbRecoveryResume || exit 1\n')
    state_dir = tmp_path / "recovery"
    state_dir.mkdir(mode=0o700)
    backup = tmp_path / "backup"
    config = write_file(tmp_path / "config", "old config\n")
    env = dict(os.environ, TERM="xterm", QUICKBOX_ALLOW_NON_ROOT="1", QUICKBOX_RECOVERY_DIR=str(state_dir),
               QUICKBOX_UPDATE_CORE_LOCK=str(tmp_path / "core.lock"), QUICKBOX_OPERATION_LOCK=str(tmp_path / "op.lock"),
               QUICKBOX_INSTALL_DIR=str(tmp_path / "install"), PATH=f"{tmp_path / 'bin'}:{os.environ['PATH']}")
    subprocess.run(["bash", "-c", 'source "$1"; _qbBackupCreate "$2" "$3"', "test",
                    str(lib / "qbUpdateBackup"), str(backup), str(config)], env=env, check=True)
    config.write_text("new config\n")
    (state_dir / "backup").write_text(f"{backup}\n")
    (state_dir / "stage").write_text(f"{stage}\n")
    old = dashboard if state == "before_swap" else previous
    write_file(old / "release", "old\n")
    new = dashboard if state == "after_swap" else stage
    write_file(new / "release", "new\n")
    install = tmp_path / "install"
    install.mkdir()
    (install / ".install.lock").write_text("QuickBox\n")
    backup_file = backup / str(config).replace("/", "_")
    original = backup_file.read_bytes()
    backup_file.write_text("corrupt\n")
    result = run(script, env, str(lib))
    assert result.returncode != 0
    assert state_dir.is_dir()
    assert (dashboard / "release").read_text() == "old\n"
    backup_file.write_bytes(original)
    result = run(script, env, str(lib))
    assert result.returncode == 0, (result.stdout, result.stderr)
    assert (dashboard / "release").read_text() == "old\n"
    assert config.read_text() == "old config\n"
    assert state_dir.is_dir()
    assert not (state_dir / "backup").exists()
    assert not (install / ".install.lock").exists()


def test_killed_update_keeps_marker_and_blocks_next_update(tmp_path):
    state_dir = tmp_path / "recovery"
    helper = REPO / "packages/system/update/qbUpdateRecovery"
    env = dict(os.environ, QUICKBOX_RECOVERY_DIR=str(state_dir))
    process = subprocess.Popen(
        ["bash", "-c", 'source "$1"; _qbRecoveryBegin || exit 1; echo ready; exec sleep 30', "test", str(helper)],
        env=env, stdout=subprocess.PIPE, text=True,
    )
    assert process.stdout is not None
    try:
        assert process.stdout.readline().strip() == "ready"
        process.kill()
        process.wait()
        assert state_dir.is_dir()
        result = subprocess.run(["bash", "-c", 'source "$1"; _qbRecoveryBegin', "test", str(helper)],
                                env=env, capture_output=True, text=True)
        assert result.returncode != 0
        assert "record already exists" in result.stderr
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        if process.stdout is not None:
            process.stdout.close()
