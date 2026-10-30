"""Update checkout handoff with distinct installed and target drivers."""

import os
import shutil
import subprocess

import pytest

from tests.support import REPO, write_file


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, text=True, capture_output=True).stdout.strip()


@pytest.mark.parametrize("target_kind", ["current", "previous", "legacy", "custom"])
@pytest.mark.parametrize("fail", [False, True])
@pytest.mark.parametrize("full", [False, True])
def test_target_updater_continues_under_original_locks(tmp_path, target_kind, fail, full):
    source = tmp_path / "source"
    source.mkdir()
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", str(remote)], check=True, capture_output=True)
    git(source, "init", "-b", "master")
    git(source, "config", "user.name", "QuickBox test")
    git(source, "config", "user.email", "test@example.invalid")
    install = tmp_path / "install"
    install.mkdir()
    log = tmp_path / "output.log"
    events = tmp_path / "events"
    system = source / "packages/system"
    update = system / "update"
    update.mkdir(parents=True)
    driver = (REPO / "packages/system/qbUpdate").read_text()
    driver = driver.replace("/srv/dashboard/db/output.log", str(log))
    driver = driver.replace("/install/", str(install) + "/")
    driver = driver.replace("source ~/.profile", ":").replace("source ~/.bashrc", ":")
    driver = driver.replace(
        "function _installSystemUpdates() {",
        'function _installSystemUpdates() { printf "system DRIVER_LABEL\\n" >>"$TEST_EVENTS"; return 0;',
    )
    driver = driver.replace(
        '_parseUpdateArgs "$@" || exit $?',
        '_parseUpdateArgs "$@" || exit $?\nprintf "DRIVER_LABEL\\n" >>"$TEST_EVENTS"',
    )
    repo_helper = (REPO / "packages/system/update/qbUpdateRepo").read_text()
    repo_helper = repo_helper.replace("/install/", str(install) + "/")
    repo_helper = repo_helper.split("function _setPerm() {")[0] + '''
_setPerm() { printf 'permissions TARGET_LABEL\\n' >>"$TEST_EVENTS"; }
_bashrc() { :; }
_updateskel() { :; }
'''
    write_file(update / "qbUpdateRepo", repo_helper)
    write_file(update / "qbUpdateService", '''
_updateservice() {
  bash -c 'exec 7>"$QUICKBOX_UPDATE_CORE_LOCK"; ! flock -n 7' || return 1
  bash -c 'exec 7>"$QUICKBOX_OPERATION_LOCK"; ! flock -n 7' || return 1
  printf 'service TARGET_LABEL\\n' >>"$TEST_EVENTS"
  if [[ ${TEST_FAIL_TARGET:-0} == 1 ]]; then exit 42; fi
}
''')
    write_file(update / "qbUpdateDashboard", '''
_updatedashboard() { printf 'dashboard TARGET_LABEL\\n' >>"$TEST_EVENTS"; }
_updatelanguage() { :; }
''')
    for name in ("qbUpdateLib", "qbUpdateTimer", "qbUpdateStep"):
        shutil.copy(REPO / "packages/system/update" / name, update / name)
    write_file(system / "qbUpdate", driver.replace("DRIVER_LABEL", "driver master"))
    git(source, "add", ".")
    git(source, "commit", "-m", "master")
    master = git(source, "rev-parse", "HEAD")
    git(source, "remote", "add", "origin", str(remote))
    git(source, "push", "origin", "master")
    checkout = tmp_path / "checkout"
    subprocess.run(["git", "clone", "--single-branch", "--branch", "master", str(remote), str(checkout)],
                   check=True, capture_output=True)
    installed = tmp_path / "installed/system"
    shutil.copytree(system, installed)

    git(source, "checkout", "-b", "feature")
    if target_kind == "custom":
        target_driver = r"""#!/bin/bash
printf 'driver feature\n' >>"$TEST_EVENTS"
if [[ ${1:-} != --only-core ]]; then printf 'system driver feature\n' >>"$TEST_EVENTS"; fi
printf 'permissions feature\n' >>"$TEST_EVENTS"
bash -c 'exec 7>"$QUICKBOX_UPDATE_CORE_LOCK"; ! flock -n 7' || exit 1
bash -c 'exec 7>"$QUICKBOX_OPERATION_LOCK"; ! flock -n 7' || exit 1
printf 'service feature\n' >>"$TEST_EVENTS"
if [[ ${TEST_FAIL_TARGET:-0} == 1 ]]; then exit 42; fi
printf 'dashboard feature\n' >>"$TEST_EVENTS"
"""
    elif target_kind == "legacy":
        target_driver = (REPO / "tests/repository/fixtures/legacy-qbUpdate").read_text()
        target_driver = target_driver.replace("/srv/dashboard/db/output.log", str(log))
        target_driver = target_driver.replace("/install/", str(install) + "/")
        target_driver = target_driver.replace("/etc/QuickBox/", str(checkout) + "/")
        target_driver = target_driver.replace("source ~/.profile", ":").replace("source ~/.bashrc", ":")
        target_driver = target_driver.replace(
            "function _installSystemUpdates() {",
            'function _installSystemUpdates() { printf "system driver feature\\n" >>"$TEST_EVENTS"; return 0;',
        )
        target_driver = target_driver.replace(
            "# MAIN PROCESS", 'printf "driver feature\\n" >>"$TEST_EVENTS"\n# MAIN PROCESS'
        )
    else:
        target_driver = driver.replace("DRIVER_LABEL", "driver feature")
        if target_kind == "previous":
            target_driver = target_driver.replace("# QB_UPDATE_HANDOFF_PROTOCOL=1", "")
    write_file(system / "qbUpdate", target_driver)
    for name in ("qbUpdateRepo", "qbUpdateService", "qbUpdateDashboard"):
        path = update / name
        path.write_text(path.read_text().replace("TARGET_LABEL", "feature"))
    git(source, "add", ".")
    git(source, "commit", "-m", "feature")
    git(source, "push", "origin", "feature")
    env = dict(os.environ, TERM="xterm", QUICKBOX_REPO_ROOT=str(checkout),
               QUICKBOX_BACKUP_DIR=str(tmp_path / "backups"),
               QUICKBOX_UPDATE_CORE_LOCK=str(tmp_path / "core.lock"),
               QUICKBOX_OPERATION_LOCK=str(tmp_path / "operation.lock"), TEST_EVENTS=str(events),
               TEST_LOG=str(log), TEST_INSTALL=str(install), TEST_FAIL_TARGET="1" if fail else "0")
    args = ["bash", str(installed / "qbUpdate")]
    if not full:
        args.append("--only-core")
    args.extend(["--branch", "feature"])
    result = subprocess.run(args, env=env, text=True, capture_output=True, timeout=30)
    assert (result.returncode != 0) if fail else (result.returncode == 0), (
        result.stdout, result.stderr, log.read_text()
    )
    expected = ["driver master", "driver feature"]
    if full:
        expected.append("system driver feature")
    expected.extend(["permissions feature", "service feature"])
    if not fail:
        expected.append("dashboard feature")
    assert events.read_text().splitlines() == expected
    assert git(checkout, "branch", "--show-current") == "feature"
    assert f"QUICKBOX_REPO_COMMIT={master}" in (tmp_path / "backups/repo-state.env").read_text()
    if fail:
        assert not (install / ".quickbox-branch").exists()
    else:
        assert (install / ".quickbox-branch").read_text().splitlines()[0] == "feature"
    assert "Continuing with the target checkout's updater" in log.read_text()
    assert not (install / ".install.lock").exists()
