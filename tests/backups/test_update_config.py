"""Managed update snapshots and rollback failure paths."""

from pathlib import Path
import shutil
import subprocess
import time

from tests.support import REPO, functions_before_main, run_bash, write_file

LIB = REPO / "packages/system/update"


def backup_command(*args, prefix=""):
    return run_bash('source "$1/qbUpdateBackup"; shift; ' + prefix + ' "$@"', LIB, *args)


def test_file_and_absent_restore(tmp_path):
    managed = write_file(tmp_path / "managed.conf", "before\n")
    managed.chmod(0o640)
    absent = tmp_path / "absent.conf"
    backup = tmp_path / "snapshot"
    result = backup_command(backup, managed, absent, prefix="_qbBackupCreate")
    assert result.returncode == 0, result.stderr
    manifest = (backup / "manifest.tsv").read_text()
    assert "file\t" in manifest and "absent\t" in manifest
    managed.write_text("after\n")
    managed.chmod(0o600)
    absent.write_text("created\n")
    for _ in range(2):
        result = backup_command(backup, prefix="_qbBackupRestoreAll")
        assert result.returncode == 0, result.stderr
        assert managed.read_text() == "before\n"
        assert managed.stat().st_mode & 0o777 == 0o640
        assert not absent.exists()


def test_backup_unique_name(tmp_path):
    collision = tmp_path / "backup"
    collision.mkdir()
    result = backup_command(collision, prefix="_qbBackupUniqueDir")
    assert result.stdout.strip() == str(collision) + "-2"
    (tmp_path / "backup-2").mkdir()
    assert backup_command(collision, prefix="_qbBackupUniqueDir").stdout.strip() == str(collision) + "-3"


def test_symlink_restore_and_rename_failure(tmp_path):
    target = write_file(tmp_path / "site.conf", "original\n")
    target.chmod(0o640)
    link = tmp_path / "enabled.conf"
    link.symlink_to(target)
    backup = tmp_path / "backup"
    assert backup_command(backup, link, prefix="_qbBackupCreate").returncode == 0
    target.write_text("changed\n")
    target.chmod(0o777)
    assert backup_command(backup, prefix="_qbBackupRestoreAll").returncode == 0
    assert link.is_symlink() and target.read_text() == "original\n"
    assert target.stat().st_mode & 0o777 == 0o640
    target.write_text("keep live\n")
    result = run_bash(
        'source "$1/qbUpdateBackup"; mv() { echo "fixture rename denied" >&2; return 19; }; _qbBackupRestoreAll "$2"',
        LIB,
        backup,
    )
    assert result.returncode != 0
    assert "fixture rename denied" in result.stderr
    assert target.read_text() == "keep live\n"
    assert not list(tmp_path.glob(".qb-restore.*"))


def test_tampered_backup_is_rejected(tmp_path):
    managed = write_file(tmp_path / "managed.conf", "old\n")
    backup = tmp_path / "backup"
    assert backup_command(backup, managed, prefix="_qbBackupCreate").returncode == 0
    copy = backup / str(managed).replace("/", "_")
    copy.write_text("tampered\n")
    managed.write_text("changed\n")
    assert backup_command(backup, managed, prefix="_qbBackupRestorePath").returncode != 0
    assert managed.read_text() == "changed\n"


def test_running_binary_can_be_restored(tmp_path):
    binary = tmp_path / "sleep"
    shutil.copy("/bin/sleep", binary)
    backup = tmp_path / "backup"
    assert backup_command(backup, binary, prefix="_qbBackupCreate").returncode == 0
    process = subprocess.Popen([str(binary), "30"])
    try:
        time.sleep(0.1)
        assert backup_command(backup, prefix="_qbBackupRestoreAll").returncode == 0
        assert process.poll() is None
        assert binary.read_bytes() == Path("/bin/sleep").read_bytes()
    finally:
        process.terminate()
        process.wait(timeout=5)


def test_config_rollback_activation_and_missing_backup(tmp_path):
    managed = write_file(tmp_path / "managed.conf", "before\n")
    absent = tmp_path / "created.conf"
    output = tmp_path / "output.log"
    definitions = functions_before_main("packages/system/qbUpdate").replace("/srv/dashboard/db/output.log", str(output))
    env = {
        "QB_UPDATE_LIB_DIR": str(LIB),
        "OUTTO": str(output),
        "QUICKBOX_BACKUP_DIR": str(tmp_path / "backups"),
        "QUICKBOX_REPO_ROOT": str(REPO),
        "MANAGED": str(managed),
        "ABSENT": str(absent),
    }
    prelude = (
        definitions
        + """
_loadBackupHelper
_managedUpdatePaths() { printf '%s\\n' "$MANAGED" "$ABSENT"; }
_backupUpdateConfig || exit 1
printf 'BACKUP=%s\\n' "$update_backup_dir"
"""
    )
    result = run_bash(prelude, env=env)
    assert result.returncode == 0, result.stderr
    backup = Path(result.stdout.split("BACKUP=")[-1].strip())
    managed.write_text("after\n")
    absent.write_text("created\n")
    restore = (
        definitions
        + """
_loadBackupHelper
update_backup_ready=1
update_backup_dir="$1"
update_service_started=1
systemctl() { return 0; }
nginx() { [[ "$*" != '-s reload' ]] || { echo 'fixture reload denied' >&2; return 29; }; }
_restoreUpdateConfig
"""
    )
    result = run_bash(restore, backup, env=env)
    assert result.returncode != 0
    assert managed.read_text() == "before\n" and not absent.exists(), (result.stdout, result.stderr, str(backup))
    assert "fixture reload denied" in output.read_text()
    (backup / str(managed).replace("/", "_")).unlink()
    activation = tmp_path / "activation"
    missing = (
        definitions
        + """
_loadBackupHelper
update_backup_ready=1
update_backup_dir="$1"
update_service_started=1
systemctl() { echo called >>"$2"; }
nginx() { echo called >>"$2"; }
_restoreUpdateConfig
"""
    )
    result = run_bash(missing, backup, activation, env=env)
    assert result.returncode != 0
    assert not activation.exists()


def test_shared_backup_root_keeps_permissions_and_warns(tmp_path):
    root = tmp_path / "shared"
    root.mkdir(mode=0o777)
    root.chmod(0o777)
    result = run_bash('source "$1/qbUpdateBackup"; _qbBackupRoot', LIB, env={"QUICKBOX_BACKUP_DIR": str(root)})
    assert result.returncode == 0
    assert result.stdout.strip() == str(root)
    assert root.stat().st_mode & 0o777 == 0o777
    assert "writable by group/other" in result.stderr
