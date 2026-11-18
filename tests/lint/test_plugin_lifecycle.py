"""Exercise the affected ruTorrent plugin lifecycle scripts in a sandbox."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]


def run_plugin_script(script, tmp_path):
    source = (ROOT / "packages/plugin" / script).read_text()
    source = source.replace("/srv/rutorrent/", f"{tmp_path}/rutorrent/")
    source = source.replace("/usr/local/bin/quickbox/rutorrent/plugins/", f"{tmp_path}/vault/")
    source = "sleep() { :; }\nchown() { :; }\n" + source
    return subprocess.run(["bash"], input=source, text=True, capture_output=True, check=True)


def test_getdir_removal_targets_installed_plugin(tmp_path):
    plugins = tmp_path / "rutorrent/plugins"
    (plugins / "_getdir").mkdir(parents=True)
    (plugins / "getdir").mkdir()
    (tmp_path / "rutorrent/home/db").mkdir(parents=True)
    run_plugin_script("remove/removeplugin-_getdir", tmp_path)
    assert not (plugins / "_getdir").exists()
    assert (plugins / "getdir").exists()


def test_chunks_installer_runs_without_missing_command(tmp_path):
    (tmp_path / "vault/chunks").mkdir(parents=True)
    (tmp_path / "rutorrent/plugins").mkdir(parents=True)
    (tmp_path / "rutorrent/home/db").mkdir(parents=True)
    result = run_plugin_script("install/installplugin-chunks", tmp_path)
    assert (tmp_path / "rutorrent/plugins/chunks").is_dir()
    assert result.stderr == ""
