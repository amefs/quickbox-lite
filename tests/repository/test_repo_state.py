"""Pre-update repository records and revert in a temporary checkout."""

import os
import subprocess

from tests.support import REPO, functions_before_main, run_bash, write_file


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


def test_record_and_revert(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "-q")
    git(repo, "config", "user.email", "sandbox@example.invalid")
    git(repo, "config", "user.name", "sandbox")
    tracked = write_file(repo / "tracked.txt", "base\n")
    write_file(
        repo / "packages/system/qbUpdate",
        """case "$1" in --from-checkout) ;; *) exit 42;; esac
git -C "$QUICKBOX_REPO_ROOT" rev-parse HEAD >"$QUICKBOX_BACKUP_DIR/reinstalled"
""",
    )
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "base")
    base = git(repo, "rev-parse", "HEAD")
    install = tmp_path / "install"
    install.mkdir()
    backup = tmp_path / "backups"
    env = {
        "QB_UPDATE_LIB_DIR": str(REPO / "packages/system/update"),
        "OUTTO": str(tmp_path / "out.log"),
        "QUICKBOX_BACKUP_DIR": str(backup),
        "QUICKBOX_INSTALL_DIR": str(install),
        "QUICKBOX_REPO_ROOT": str(repo),
        "QUICKBOX_UPDATE_CORE_LOCK": str(tmp_path / "update.lock"),
        "QUICKBOX_ALLOW_NON_ROOT": "1",
    }
    definitions = functions_before_main("packages/system/qbUpdate").replace(
        "/srv/dashboard/db/output.log", str(tmp_path / "out.log")
    )
    result = run_bash(definitions + "\n_saveRepoState", env=env)
    assert result.returncode == 0, result.stderr
    for filename in ("repo-state.env", "repo-history.tsv"):
        path = backup / filename
        assert path.stat().st_mode & 0o777 == 0o600
        assert base in path.read_text()
    assert git(repo, "rev-parse", "refs/quickbox/pre-update-latest") == base
    assert git(repo, "for-each-ref", "--format=%(refname)", "refs/quickbox/pre-update/")
    tracked.write_text("updated\n")
    git(repo, "add", "tracked.txt")
    git(repo, "commit", "-qm", "update")
    revert = REPO / "packages/system/update/qbUpdateRevert"

    def run(*args):
        return subprocess.run(
            ["bash", str(revert), *args],
            input="",
            capture_output=True,
            text=True,
            env=dict(os.environ, TERM="xterm", **env),
        )

    assert run().returncode != 0
    result = run("--yes")
    assert result.returncode == 0, result.stderr
    assert git(repo, "rev-parse", "HEAD") == base
    assert (backup / "reinstalled").read_text().strip() == base
    assert (install / ".quickbox-branch").read_text().splitlines()[1] == base
    result = run("--list")
    assert result.returncode == 0
    assert base in result.stdout and "TIMESTAMP" in result.stdout
