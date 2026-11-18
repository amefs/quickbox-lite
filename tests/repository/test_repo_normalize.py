#!/usr/bin/env python3
# Author: TautCony
"""Exercise qbNormalizeRepo against temporary Git and non-Git trees."""

from pathlib import Path
import stat
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]
HELPER = REPO / "packages/system/auxiliary/qbNormalizeRepo"
LINT = REPO / "scripts/lint-repo-files.py"


def run(root):
    result = subprocess.run(["bash", str(HELPER), str(root)], text=True, capture_output=True)
    assert result.returncode == 0, (result.returncode, result.stdout, result.stderr)


def mode(path):
    return stat.S_IMODE(path.stat().st_mode)


def git(root, *args):
    subprocess.run(["git", "-C", str(root), "-c", "core.autocrlf=false", *args], check=True, capture_output=True)


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def test_tracked_tree_keeps_index_mode_as_the_authority():
    with tempfile.TemporaryDirectory(prefix="quickbox-normalize-git-") as temporary:
        root = Path(temporary)
        git(root, "init", "-q")
        paths = {
            "bin/tool": b"#!/bin/bash\r\necho tool\r\n",
            "data/config.conf": b"key = value\r\n",
            "asset/app.min.js": b"var a=1;\r\n",
            "binary.dat": b"\x00\x01\r\n",
            "dir with space/script tool": b"#!/bin/sh\r\necho spaced\r\n",
        }
        for name, data in paths.items():
            write(root / name, data)
        git(root, "add", "--", *paths)
        # Start from a deliberately wrong index: executable bits must not be the
        # source of truth for the helper.
        for name in ["bin/tool", "dir with space/script tool"]:
            git(root, "update-index", "--chmod=-x", "--", name)
        for name in ["data/config.conf", "asset/app.min.js", "binary.dat"]:
            git(root, "update-index", "--chmod=+x", "--", name)

        untracked = root / "node_modules/dep/readme.txt"
        write(untracked, b"untouched\r\n")
        untracked.chmod(0o777)
        deploy_untracked = root / "packages/system/auxiliary/untracked-tool"
        write(deploy_untracked, b"#!/bin/sh\r\necho deploy\r\n")
        deploy_untracked.chmod(0o644)
        deploy_space = root / "packages/system/auxiliary/space tool"
        write(deploy_space, b"#!/bin/sh\r\necho space\r\n")
        deploy_space.chmod(0o644)
        outside = root / "docs/outside.sh"
        write(outside, b"#!/bin/sh\r\necho outside\r\n")
        outside.chmod(0o644)
        fileshare = root / "setup/dashboard/fileshare/user.sh"
        write(fileshare, b"#!/bin/sh\r\necho user\r\n")
        fileshare.chmod(0o644)

        run(root)
        run(root)  # idempotent

        assert (root / "bin/tool").read_bytes() == b"#!/bin/bash\necho tool\n"
        assert mode(root / "bin/tool") == 0o755
        assert (root / "data/config.conf").read_bytes() == b"key = value\n"
        assert mode(root / "data/config.conf") == 0o644
        assert mode(root / "asset/app.min.js") == 0o644
        assert (root / "binary.dat").read_bytes() == b"\x00\x01\r\n"
        assert mode(root / "binary.dat") == 0o644
        spaced = root / "dir with space/script tool"
        assert spaced.read_bytes() == b"#!/bin/sh\necho spaced\n"
        assert mode(spaced) == 0o755
        assert untracked.read_bytes() == b"untouched\r\n"
        assert mode(untracked) == 0o777
        # The scoped fallback repairs untracked deployable files but stays out of
        # docs/, setup/dashboard/fileshare/ and node_modules/.
        assert deploy_untracked.read_bytes() == b"#!/bin/sh\necho deploy\n"
        assert mode(deploy_untracked) == 0o755
        assert deploy_space.read_bytes() == b"#!/bin/sh\necho space\n"
        assert mode(deploy_space) == 0o755
        assert outside.read_bytes() == b"#!/bin/sh\r\necho outside\r\n"
        assert mode(outside) == 0o644
        assert fileshare.read_bytes() == b"#!/bin/sh\r\necho user\r\n"
        assert mode(fileshare) == 0o644


def test_plain_tree_uses_the_deployable_path_scope():
    with tempfile.TemporaryDirectory(prefix="quickbox-normalize-plain-") as temporary:
        root = Path(temporary)
        write(root / "packages/system/tool", b"#!/bin/bash\r\necho plain\r\n")
        write(root / "setup/templates/app.conf", b"key = value\r\n")
        write(root / "setup/dashboard/ws/tool", b"#!/bin/sh\r\necho ws\r\n")
        write(root / "docs/outside.sh", b"#!/bin/sh\r\necho outside\r\n")
        write(root / "setup/dashboard/fileshare/user.sh", b"#!/bin/sh\r\necho user\r\n")
        write(root / "node_modules/dep/index.js", b"var untouched=1;\r\n")

        run(root)

        assert (root / "packages/system/tool").read_bytes() == b"#!/bin/bash\necho plain\n"
        assert mode(root / "packages/system/tool") == 0o755
        assert (root / "setup/templates/app.conf").read_bytes() == b"key = value\n"
        assert (root / "setup/dashboard/ws/tool").read_bytes() == b"#!/bin/sh\necho ws\n"
        assert mode(root / "setup/dashboard/ws/tool") == 0o755
        assert (root / "docs/outside.sh").read_bytes() == b"#!/bin/sh\r\necho outside\r\n"
        assert (root / "setup/dashboard/fileshare/user.sh").read_bytes() == b"#!/bin/sh\r\necho user\r\n"
        assert (root / "node_modules/dep/index.js").read_bytes() == b"var untouched=1;\r\n"


def test_missing_tree_is_refused():
    missing = subprocess.run(["bash", str(HELPER), "/nonexistent/quickbox"], text=True, capture_output=True)
    assert missing.returncode == 1, missing


def test_lint_fix_changes_only_the_mode():
    with tempfile.TemporaryDirectory(prefix="quickbox-mode-fix-") as temporary:
        root = Path(temporary)
        git(root, "init", "-q")
        write(root / "tool", b"#!/bin/bash\necho one\n")
        git(root, "add", "tool")
        git(root, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "-m", "init")
        git(root, "update-index", "--chmod=-x", "tool")
        (root / "tool").write_bytes(b"#!/bin/bash\necho two\n")

        fixed = subprocess.run(["python3", str(LINT), "--root", str(root), "--fix"], text=True, capture_output=True)
        assert fixed.returncode == 0, (fixed.stdout, fixed.stderr)
        assert mode(root / "tool") == 0o755
        assert subprocess.check_output(["git", "-C", str(root), "show", ":tool"]) == b"#!/bin/bash\necho one\n"
        index_entry = subprocess.check_output(["git", "-C", str(root), "ls-files", "-s", "tool"])
        assert index_entry.split()[0] == b"100755", index_entry


def test_crlf_helper_repairs_itself_when_bash_runs_it():
    with tempfile.TemporaryDirectory(prefix="quickbox-crlf-helper-") as temporary:
        root = Path(temporary)
        helper = root / "packages/system/auxiliary/qbNormalizeRepo"
        helper.parent.mkdir(parents=True)
        helper.write_bytes(HELPER.read_bytes().replace(b"\n", b"\r\n"))
        helper.chmod(0o644)
        target = root / "packages/system/tool"
        target.write_bytes(b"#!/bin/sh\r\necho tool\r\n")
        target.chmod(0o644)

        result = subprocess.run(["bash", str(helper), str(root)], text=True, capture_output=True)
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert b"\r" not in helper.read_bytes(), "CRLF helper must repair itself"
        assert mode(helper) == 0o755
        assert target.read_bytes() == b"#!/bin/sh\necho tool\n"
        assert mode(target) == 0o755


def test_crlf_helper_repairs_itself_through_the_stripped_bootstrap():
    with tempfile.TemporaryDirectory(prefix="quickbox-crlf-bootstrap-") as temporary:
        root = Path(temporary)
        helper = root / "packages/system/auxiliary/qbNormalizeRepo"
        helper.parent.mkdir(parents=True)
        helper.write_bytes(HELPER.read_bytes().replace(b"\n", b"\r\n"))
        helper.chmod(0o644)
        target = root / "packages/system/tool"
        target.write_bytes(b"#!/bin/sh\r\necho bootstrap\r\n")
        target.chmod(0o644)
        driver = root / "driver.sh"
        driver.write_text('QB_NORMALIZE_BOOTSTRAP=1 QB_NORMALIZE_RUN=1 bash -c "$(sed \'s/\\r$//\' "$1")" _ "$2"\n')

        result = subprocess.run(["bash", str(driver), str(helper), str(root)], text=True, capture_output=True)
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert b"\r" not in helper.read_bytes(), "bootstrap run must repair the helper file"
        assert mode(helper) == 0o755
        assert target.read_bytes() == b"#!/bin/sh\necho bootstrap\n"
        assert mode(target) == 0o755
