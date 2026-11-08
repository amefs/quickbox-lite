"""Exercise version updates in an isolated repository."""

import json
import os
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[2]


def test_bump_version_updates_project_files(tmp_path):
    paths = [
        "scripts/bump-version.sh",
        "packages/package/README.md",
        "packages/package/templates/install.sh.template",
        "packages/system/box",
        "setup/scripts/authelia.sh",
        "onekey.sh",
        "setup.sh",
        "setup/templates/motd/01-custom",
        "setup/templates/bash_qb.template",
        "setup/dashboard/ws/package.json",
        "setup/dashboard/ws/package-lock.json",
        "README.md",
        "README_zh.md",
    ]
    for name in paths:
        source = ROOT / name
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    lock_path = tmp_path / "setup/dashboard/ws/package-lock.json"
    original_lock = json.loads(lock_path.read_text())
    env = {**os.environ, "TERM": "dumb"}
    result = subprocess.run(
        ["bash", str(tmp_path / "scripts/bump-version.sh"), "-v", "9.8.7"],
        cwd=tmp_path.parent, env=env, text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    for name in ["scripts/bump-version.sh", "packages/package/README.md",
                 "packages/package/templates/install.sh.template", "packages/system/box",
                 "setup/scripts/authelia.sh",
                 "onekey.sh", "setup.sh", "setup/templates/motd/01-custom"]:
        assert "# Current version:  v9.8.7" in (tmp_path / name).read_text()
    for name in ["README.md", "README_zh.md"]:
        assert "badge/version-9.8.7" in (tmp_path / name).read_text()
    for name in ["setup/templates/motd/01-custom", "setup/templates/bash_qb.template"]:
        assert "QUICKBOX_VERSION=v9.8.7" in (tmp_path / name).read_text()
    assert json.loads((tmp_path / "setup/dashboard/ws/package.json").read_text())["version"] == "9.8.7"
    new_lock = json.loads(lock_path.read_text())
    assert new_lock["version"] == new_lock["packages"][""]["version"] == "9.8.7"
    original_lock["version"] = original_lock["packages"][""]["version"] = "9.8.7"
    assert new_lock == original_lock
    staged = subprocess.check_output(["git", "-C", str(tmp_path), "diff", "--cached", "--name-only"], text=True)
    assert "setup/dashboard/ws/package-lock.json" in staged
