#!/usr/bin/env python3
"""Exercise qbBackupPrune with synthetic backup trees.

Each case builds its own temporary backup root, so no real /var/backups path is
read or written. Age is expressed through directory modification times.
"""
import os
from pathlib import Path
import subprocess
import tempfile
import time

REPO = Path(__file__).resolve().parents[2]
HELPER = REPO / "packages/system/auxiliary/qbBackupPrune"
DAY = 86400
OLD = time.time() - 90 * DAY
FRESH = time.time() - 3600


def run(root, *args, keep=None, days=None):
    env = os.environ.copy()
    for key in ("QUICKBOX_BACKUP_DIR", "QUICKBOX_BACKUP_KEEP", "QUICKBOX_BACKUP_DAYS"):
        env.pop(key, None)
    env["QUICKBOX_BACKUP_DIR"] = str(root)
    if keep is not None:
        env["QUICKBOX_BACKUP_KEEP"] = str(keep)
    if days is not None:
        env["QUICKBOX_BACKUP_DAYS"] = str(days)
    return subprocess.run(
        ["bash", str(HELPER), *args], env=env, capture_output=True, text=True
    )


def make_backup(root, name, mtime, target=None):
    path = root / name
    if target is not None:
        path.symlink_to(target, target_is_directory=True)
        return path
    path.mkdir()
    os.utime(path, (mtime, mtime))
    return path


def names(root):
    return {entry.name for entry in root.iterdir()}


def dashboard_names(count):
    return [f"20240101-0000{index:02d}" for index in range(count)]


with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    missing = Path(temporary) / "missing"
    result = run(missing)
    assert result.returncode == 0, result.stderr
    assert not missing.exists()

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    result = run(root)
    assert result.returncode == 0, result.stderr
    (root / "unknown").mkdir()
    result = run(root)
    assert result.returncode == 0, result.stderr
    assert (root / "unknown").is_dir()

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    dashboards = dashboard_names(15)
    for name in dashboards:
        make_backup(root, f"{name}-dashboard", OLD)
    sudoers = ["20240102-000000-sudoers", "20240102-000001-sudoers"]
    for name in sudoers:
        make_backup(root, name, OLD)
    keep_always = [
        "20231201-000000",  # proxy family, within the keep count
        "20240101-000000-other",  # unknown family
        "keep-me",  # not a timestamped name
    ]
    for name in keep_always:
        make_backup(root, name, OLD)
    outside = Path(temporary) / "outside"
    outside.mkdir()
    symlink = make_backup(root, "20240101-000098", OLD, target=outside)
    plain_file = root / "20240101-000099"
    plain_file.write_text("not a directory\n")
    os.utime(plain_file, (OLD, OLD))

    result = run(root)
    assert result.returncode == 0, result.stderr
    remaining = names(root)
    # The ten newest dashboard copies survive even though they are all old.
    assert set(f"{name}-dashboard" for name in dashboards[5:]) <= remaining
    assert not any(f"{name}-dashboard" in remaining for name in dashboards[:5])
    # Fewer entries than the keep limit are never removed.
    for name in sudoers + keep_always + [symlink.name]:
        assert name in remaining, name
    assert plain_file.name in remaining
    assert outside.is_dir()
    # A second run is a no-op.
    before = names(root)
    result = run(root)
    assert result.returncode == 0, result.stderr
    assert names(root) == before

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    dashboards = dashboard_names(5)
    # Newest three are fresh, the excess two are old: remove only the old ones.
    for index, name in enumerate(dashboards):
        make_backup(root, f"{name}-dashboard", FRESH if index >= 2 else OLD)
    result = run(root, keep=3, days=30)
    assert result.returncode == 0, result.stderr
    assert names(root) == {f"{name}-dashboard" for name in dashboards[2:]}

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    dashboards = dashboard_names(5)
    # The excess entries are fresh, so the age gate keeps them even when they
    # exceed the keep count.
    for index, name in enumerate(dashboards):
        make_backup(root, f"{name}-dashboard", OLD if index >= 2 else FRESH)
    result = run(root, keep=3, days=30)
    assert result.returncode == 0, result.stderr
    assert len(names(root)) == 5

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    dashboards = dashboard_names(5)
    for name in dashboards:
        make_backup(root, f"{name}-dashboard", OLD)
    result = run(root, keep=2, days=0)
    assert result.returncode == 0, result.stderr
    assert names(root) == {f"{name}-dashboard" for name in dashboards[3:]}

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    dashboards = dashboard_names(5)
    for name in dashboards:
        make_backup(root, f"{name}-dashboard", OLD)
    result = run(root, "--dry-run", keep=0, days=0)
    assert result.returncode == 0, result.stderr
    assert len(names(root)) == 5
    assert "would remove" in result.stderr

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    base = "20240101-000000-dashboard"
    collided = [base, f"{base}-2", f"{base}-3", f"{base}-4"]
    for name in collided:
        make_backup(root, name, OLD)
    result = run(root, keep=2, days=0)
    assert result.returncode == 0, result.stderr
    # Reverse name order treats the collision suffixes as the newer copies.
    assert names(root) == {f"{base}-3", f"{base}-4"}

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    # The managed-configuration family follows the same keep policy, and the
    # repository state files are plain files that pruning must leave alone.
    updates = dashboard_names(4)
    for name in updates:
        make_backup(root, f"{name}-update", OLD)
    state_file = root / "repo-state.env"
    history_file = root / "repo-history.tsv"
    state_file.write_text("QUICKBOX_REPO_COMMIT=deadbeef\n")
    history_file.write_text("20240101-000000\tmaster\tdeadbeef\t/etc/QuickBox\n")
    result = run(root, keep=2, days=0)
    assert result.returncode == 0, result.stderr
    assert names(root) == {
        f"{name}-update" for name in updates[2:]
    } | {state_file.name, history_file.name}

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    base = "20240101-000000-dashboard"
    collided = [base] + [f"{base}-{index}" for index in range(2, 13)]
    for name in collided:
        make_backup(root, name, OLD)
    result = run(root, keep=2, days=0)
    assert result.returncode == 0, result.stderr
    # Numeric suffixes: -12 and -11 are newer than -2, which must not win.
    assert names(root) == {f"{base}-11", f"{base}-12"}

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    root = Path(temporary) / "backups"
    root.mkdir()
    result = run(root, keep="not-a-number")
    assert result.returncode == 2, result.stdout

with tempfile.TemporaryDirectory(prefix="quickbox-prune-") as temporary:
    target = Path(temporary) / "target"
    target.mkdir()
    linked = Path(temporary) / "linked"
    linked.symlink_to(target, target_is_directory=True)
    result = run(linked)
    assert result.returncode != 0, "a symlinked backup root must be rejected"

# The proxy migration writes its own backup: it must be private, uniquely named,
# and skipped when the snippet is already up to date.
with tempfile.TemporaryDirectory(prefix="quickbox-proxy-") as temporary:
    root = Path(temporary)
    backup_root = root / "backups"
    proxy = root / "proxy.conf"
    legacy = "proxy_set_header Host \\$host;\n"
    proxy.write_text(legacy)
    env = os.environ.copy()
    env.update(
        QUICKBOX_ALLOW_NON_ROOT="1",
        QUICKBOX_BACKUP_DIR=str(backup_root),
        QUICKBOX_NGINX_PROXY_CONF=str(proxy),
    )
    command = [
        "bash",
        str(REPO / "packages/system/auxiliary/qbNginxProxyMigrate"),
        "--no-verify",
    ]
    first = subprocess.run(command, env=env, capture_output=True, text=True)
    assert first.returncode == 0, (first.stdout, first.stderr)
    assert proxy.read_text() == "proxy_set_header Host $http_host;\n"
    backups = [entry for entry in backup_root.iterdir() if entry.is_dir()]
    assert len(backups) == 1, backups
    assert backup_root.stat().st_mode & 0o777 == 0o700
    assert backups[0].stat().st_mode & 0o777 == 0o700
    assert (backups[0] / "proxy.conf").read_text() == legacy
    second = subprocess.run(command, env=env, capture_output=True, text=True)
    assert second.returncode == 0, (second.stdout, second.stderr)
    assert len([entry for entry in backup_root.iterdir() if entry.is_dir()]) == 1

print("backup retention sandbox checks passed")
