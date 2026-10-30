"""Dashboard interface writes retain the expected ownership and isolation."""

import os
import pwd
import re

from tests.support import REPO, run_bash, write_file

BOX = REPO / "packages/system/box"


def test_no_recursive_dashboard_chown():
    pattern = re.compile(r"chown\s+(?:-R|--recursive)\s+\S*www-data\S*\s+/srv/dashboard(?:\s|$)")
    for path in [REPO / "setup.sh", *(p for p in (REPO / "packages").rglob("*") if p.is_file())]:
        try:
            assert not pattern.search(path.read_text()), str(path)
        except UnicodeDecodeError:
            continue
    source = BOX.read_text()
    assert "_writeDashboardDbFile interface.txt" in source
    assert ">/srv/dashboard/db/interface.txt" not in source


def test_interface_write_and_failure(tmp_path):
    source = BOX.read_text()
    function = re.search(r"^function _writeDashboardDbFile\(\) \{\n.*?^\}", source, re.M | re.S)
    assert function
    db = tmp_path / "db"
    db.mkdir()
    interface = write_file(db / "interface.txt", "old\n")
    master = write_file(db / "master.txt", "keep\n")
    inode = interface.stat().st_ino
    env = {"QUICKBOX_DASHBOARD_DB": str(db)}
    if os.geteuid() != 0:
        write_file(tmp_path / "bin/chown", '#!/bin/sh\n[ "$1" = www-data:www-data ]\n', executable=True)
        env["PATH"] = str(tmp_path / "bin") + os.pathsep + os.environ["PATH"]
    result = run_bash(function.group() + "\n_writeDashboardDbFile interface.txt eth9", env=env)
    assert result.returncode == 0, result.stderr
    assert interface.read_text() == "eth9\n"
    assert interface.stat().st_ino != inode
    assert master.read_text() == "keep\n"
    assert not list(db.glob(".interface.txt.*"))
    if os.geteuid() == 0:
        assert interface.stat().st_uid == pwd.getpwnam("www-data").pw_uid
        assert interface.stat().st_mode & 0o777 == 0o640
    if os.geteuid() != 0:
        db.chmod(0o500)
        try:
            assert run_bash(function.group() + "\n_writeDashboardDbFile interface.txt eth10", env=env).returncode != 0
        finally:
            db.chmod(0o700)
    env["QUICKBOX_DASHBOARD_DB"] = str(tmp_path / "missing")
    assert run_bash(function.group() + "\n_writeDashboardDbFile interface.txt eth10", env=env).returncode != 0
    assert interface.read_text() == "eth9\n"
