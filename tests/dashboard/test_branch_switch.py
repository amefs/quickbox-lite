"""Repository branch switching uses the fetched origin and preserves dirty files."""

import subprocess

from tests.support import REPO, run_bash

HELPER = REPO / "packages/system/update/qbUpdateRepo"


def git(*args, cwd=None):
    return subprocess.run(
        ["git", *map(str, args)], cwd=cwd, check=True, capture_output=True, text=True
    ).stdout.strip()


def test_switch_fetches_missing_branch_and_rejects_dirty_checkout(tmp_path):
    origin = tmp_path / "origin.git"
    source = tmp_path / "source"
    checkout = tmp_path / "checkout"
    git("init", "--bare", origin)
    git("init", "-b", "master", source)
    git("config", "user.email", "test@example.com", cwd=source)
    git("config", "user.name", "Test", cwd=source)
    (source / "tracked").write_text("master\n")
    git("add", "tracked", cwd=source)
    git("commit", "-m", "master", cwd=source)
    git("remote", "add", "origin", origin, cwd=source)
    git("push", "origin", "master", cwd=source)
    git("clone", "--single-branch", "--branch", "master", origin, checkout)
    git("checkout", "-b", "feature/test", cwd=source)
    (source / "tracked").write_text("feature\n")
    git("commit", "-am", "feature", cwd=source)
    git("push", "origin", "feature/test", cwd=source)

    env = {"QUICKBOX_REPO_ROOT": str(checkout), "OUTTO": str(tmp_path / "out")}
    script = 'source "$1"; update_target_branch="feature/test"; _updateRepo'
    (checkout / "tracked").write_text("local changes\n")
    dirty = run_bash(script, HELPER, env=env)
    assert dirty.returncode != 0
    assert (checkout / "tracked").read_text() == "local changes\n"
    assert git("branch", "--show-current", cwd=checkout) == "master"

    git("restore", "tracked", cwd=checkout)
    result = run_bash(script, HELPER, env=env)
    assert result.returncode == 0, result.stdout + result.stderr
    assert git("branch", "--show-current", cwd=checkout) == "feature/test"
    assert (checkout / "tracked").read_text() == "feature\n"

    missing = run_bash('source "$1"; update_target_branch=missing; _updateRepo', HELPER, env=env)
    assert missing.returncode != 0
    assert git("branch", "--show-current", cwd=checkout) == "feature/test"


def test_box_forwards_branch_and_core_options(tmp_path):
    system = tmp_path / "system"
    system.mkdir()
    box = system / "box"
    box.write_text(
        (REPO / "packages/system/box").read_text().replace(
            "/usr/local/bin/quickbox/system/", str(system) + "/"
        )
    )
    box.chmod(0o755)
    updater = system / "qbUpdate"
    updater.write_text('printf "%s\\n" "$@" >"$CAPTURE_ARGS"\n')
    capture = tmp_path / "args"
    env = {"CAPTURE_ARGS": str(capture)}
    for args in (
        ("switch-branch", "feature/test"),
        ("update", "quickbox", "--only-core", "--branch", "feature/test"),
    ):
        result = run_bash('bash "$1" "${@:2}"', box, *args, env=env)
        assert result.returncode == 0, result.stderr
        assert capture.read_text().splitlines() == ["--only-core", "--branch", "feature/test"]
    result = run_bash(
        'bash "$1" "${@:2}"', box, "update", "quickbox", "--branch", "feature/test", env=env
    )
    assert result.returncode == 0, result.stderr
    assert capture.read_text().splitlines() == ["--branch", "feature/test"]
