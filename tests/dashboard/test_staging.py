"""Dashboard staging and configuration backup behavior."""

import os

import pytest

from tests.support import REPO, run_bash, write_file

UPDATE = REPO / "packages/system/update"


@pytest.fixture
def staging(tmp_path):
    live, source, stage = (tmp_path / name for name in ("live", "source", "stage"))
    for path, content in {
        "live/ws/node_modules/old-dep/index.js": "old package\n",
        "live/ws/dist.js": "old runtime\n",
        "live/db/output.log": "old log\n",
        "live/db/output.log.epoch": "epoch-old\n",
        "live/db/output.log.generation": "legacy-marker\n",
        "live/custom/custom.css": "user custom css\n",
        "live/fileshare/uploaded.txt": "user upload\n",
        "live/skins/quick.css": "selected skin\n",
        "live/obsolete-top-level.php": "obsolete\n",
        "source/ws/package.json": "{}",
        "source/ws/dist.js": "new runtime\n",
        "source/custom/custom.css": "release custom css\n",
        "source/skins/quick.css": "release skin\n",
    }.items():
        write_file(tmp_path / path, content)
    (source / "fileshare").mkdir()
    write_file(tmp_path / "bin/npm", '#!/bin/sh\nexit "${NPM_EXIT:-0}"\n', True)
    env = {
        "QB_UPDATE_LIB_DIR": str(UPDATE),
        "OUTTO": str(tmp_path / "out.log"),
        "PATH": str(tmp_path / "bin") + os.pathsep + os.environ["PATH"],
    }
    script = """source "$QB_UPDATE_LIB_DIR/qbUpdateTimer"
source "$QB_UPDATE_LIB_DIR/qbUpdateDashboard"
install() {
  local args=() arg
  while (($#)); do
    case "$1" in -o|--owner|-g|--group) shift 2;; *) args+=("$1"); shift;; esac
  done
  command install "${args[@]}"
}
_dashboardPrepareStage "$1" "$2" "$3"
"""
    return live, source, stage, env, script


def test_failed_dependency_install_preserves_live(staging):
    live, source, stage, env, script = staging
    result = run_bash(script, live, stage, source, env=dict(env, NPM_EXIT="23"))
    assert result.returncode != 0
    assert (live / "ws/dist.js").read_text() == "old runtime\n"
    assert (live / "ws/node_modules/old-dep/index.js").read_text() == "old package\n"


def test_activation_preserves_state_and_open_log(staging):
    live, source, stage, env, script = staging
    result = run_bash(script, live, stage, source, env=env)
    assert result.returncode == 0, result.stderr
    previous = live.with_name("previous")
    with (live / "db/output.log").open("a") as output:
        live.rename(previous)
        stage.rename(live)
        output.write("written through old descriptor\n")
    assert "written through old descriptor" in (live / "db/output.log").read_text()
    for file in ("output.log", "output.log.epoch"):
        assert (live / "db" / file).stat().st_ino == (previous / "db" / file).stat().st_ino
    assert (live / "db/output.log.epoch").read_text() == "epoch-old\n"
    assert not (live / "db/output.log.generation").exists()
    assert (live / "custom/custom.css").read_text() == "user custom css\n"
    assert (live / "fileshare/uploaded.txt").read_text() == "user upload\n"
    assert (live / "skins/quick.css").read_text() == "selected skin\n"
    assert not (live / "obsolete-top-level.php").exists()
    assert (live / "ws/dist.js").read_text() == "new runtime\n"


def test_repo_helpers_propagate_failures(tmp_path):
    repo = tmp_path / "repo"
    write_file(repo / "packages/system/auxiliary/qbNormalizeRepo", "exit 29\n")
    skel = tmp_path / "skel"
    skel.mkdir()
    templates = tmp_path / "templates"
    write_file(templates / "skel/example", "")
    write_file(tmp_path / "bin/rsync", "#!/bin/sh\nexit 31\n", True)
    env = {
        "QUICKBOX_REPO_ROOT": str(repo),
        "QUICKBOX_SKEL_DIR": str(skel),
        "local_setup_template": str(templates) + "/",
        "OUTTO": str(tmp_path / "log"),
        "PATH": str(tmp_path / "bin") + os.pathsep + os.environ["PATH"],
    }
    for function in ("_setPerm", "_updateskel"):
        result = run_bash(f'source "$1/qbUpdateRepo"; {function}', UPDATE, env=env)
        assert result.returncode != 0


@pytest.mark.parametrize("code", [0, 21])
def test_language_failure_is_nonblocking(tmp_path, code):
    box = write_file(tmp_path / "box", f"#!/bin/sh\nexit {code}\n", True)
    env = {"QB_UPDATE_LIB_DIR": str(UPDATE), "QUICKBOX_BOX_CLI": str(box), "OUTTO": str(tmp_path / "log")}
    result = run_bash('source "$QB_UPDATE_LIB_DIR/qbUpdateDashboard"; _updatelanguage', env=env)
    assert result.returncode == 0
    if code:
        assert "keeps its current language" in result.stdout + result.stderr
