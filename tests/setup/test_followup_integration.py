"""Verify JSON versions reach real setup wrappers as separate literal argv."""
import json
import os
from pathlib import Path
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[2]


def test_config_to_application_argv_preserves_versions_and_log_path():
    with tempfile.TemporaryDirectory(prefix="quickbox-config-argv-") as directory:
        root = Path(directory)
        drivers = root / "scripts"
        packages = root / "quickbox/package/install"
        drivers.mkdir()
        packages.mkdir(parents=True)
        for source in (REPO / "setup/scripts").glob("*.sh"):
            (drivers / source.name).write_text(source.read_text().replace(
                "/usr/local/bin/quickbox/", str(root / "quickbox") + "/"))
        recorder = '''#!/bin/bash
exec python3 -c 'import json,os,sys
with open(os.environ["APP_ARGV_RECORD"], "a") as output:
    output.write(json.dumps(sys.argv[1:]) + "\\n")
' "$(basename "$0")" "$@"
'''
        for name in ("rtorrent", "rutorrent", "transmission", "qbittorrent", "deluge"):
            (packages / ("installpackage-" + name)).write_text(recorder)
        config = {
            "username": "configuser", "password": "ExamplePass123", "log": False,
            "packages": ["rtorrent", "transmission", "qbittorrent", "deluge"],
            "rtorrent_gui": "rutorrent", "cdn": "sf", "ssh_port": "default",
            "mirror": "", "change_source": False,
            "qbittorrent_version": "4.6.7", "qbit_libt_version": "1.2.19",
            "deluge_version": "2.1.1", "de_libt_version": "2.0.10",
            "rtorrent_version": "0.9.8", "transmission_version": "4.0.6",
        }
        input_file = root / "input.json"
        input_file.write_text(json.dumps(config))
        events = root / "argv.jsonl"
        log = str(root / "log with spaces ; $literal 'quoted'.log")
        source = (REPO / "setup.sh").read_text().split("# OPT GENERATOR", 1)[0]
        script = source + '''
_error(){ printf '%s\\n' "$*" >&2; }
sleep(){ :; }
_load_config "$1" || exit 1
_validate_loaded_config
local_setup_script="$2/"
OUTTO="$3"
_insapps
'''
        result = subprocess.run(
            ["bash", "-c", script, "integration", str(input_file), str(drivers), log],
            env=dict(os.environ, APP_ARGV_RECORD=str(events), TERM="xterm"),
            capture_output=True, text=True, timeout=10,
        )
        assert result.returncode == 0, (result.stdout, result.stderr)
        calls = [json.loads(line) for line in events.read_text().splitlines()]
        actual = {row[0]: row[1:] for row in calls}
        prefix = ["-l", log, "--with-sf"]
        assert actual == {
            "installpackage-rtorrent": prefix + ["--version", "0.9.8"],
            "installpackage-rutorrent": ["-l", log],
            "installpackage-transmission": prefix + ["--version", "4.0.6"],
            "installpackage-qbittorrent": prefix + ["--qb", "4.6.7", "--lt", "1.2.19"],
            "installpackage-deluge": prefix + ["--de", "2.1.1", "--lt", "2.0.10"],
        }, actual
        assert len(calls) == len(actual)


def test_ffmpeg_failures_propagate_through_real_package_and_wrapper():
    with tempfile.TemporaryDirectory(prefix="quickbox-ffmpeg-chain-") as directory:
        root = Path(directory)
        install = root / "install"
        install.mkdir()
        (install / ".system.lock").touch()
        tmp = root / "tmp"
        tmp.mkdir()
        destination = root / "usr-bin"
        destination.mkdir()
        bin_dir = root / "bin"
        bin_dir.mkdir()
        packages = root / "quickbox/package/install"
        packages.mkdir(parents=True)
        package = (REPO / "packages/package/install/installpackage-ffmpeg").read_text()
        package = package.replace("/tmp", str(tmp)).replace("/usr/bin", str(destination))
        package = package.replace("/install/", str(install) + "/")
        (packages / "installpackage-ffmpeg").write_text(package)
        drivers = root / "scripts"
        drivers.mkdir()
        wrapper = (REPO / "setup/scripts/ffmpeg.sh").read_text()
        (drivers / "ffmpeg.sh").write_text(wrapper.replace(
            "/usr/local/bin/quickbox/", str(root / "quickbox") + "/"))

        def stub(name, body):
            path = bin_dir / name
            path.write_text("#!/bin/bash\n" + body + "\n")
            path.chmod(0o755)

        stub("apt-get", 'echo unexpected-apt >>"$EVENTS"; exit 99')
        stub("mktemp", '[[ $FAIL_AT != mktemp ]] || exit 42; exec /usr/bin/mktemp "$@"')
        stub("wget", '''
[[ $FAIL_AT != wget ]] || exit 42
while (($#)); do
    if [[ $1 == -O ]]; then printf archive >"$2"; exit 0; fi
    shift
done
exit 1''')
        stub("tar", '''
[[ $FAIL_AT != tar ]] || exit 42
while (($#)); do
    if [[ $1 == -C ]]; then
        for name in ffmpeg ffprobe qt-faststart; do printf binary >"$2/$name"; done
        exit 0
    fi
    shift
done
exit 1''')
        stub("cp", '''
[[ ${2##*/} != "$FAIL_AT" ]] || exit 42
exec /bin/cp "$@"''')
        source = (REPO / "setup.sh").read_text().split("# OPT GENERATOR", 1)[0]
        script = source + '''
_map_cdn_option(){ echo --with-github; }
sleep(){ :; }
app_list=ffmpeg; cdn=github; local_setup_script="$DRIVERS/"; OUTTO="$LOGFILE"
_insapps
'''
        for failure in ("mktemp", "wget", "tar", "ffmpeg", "ffprobe", "qt-faststart", ""):
            for path in destination.iterdir():
                path.unlink()
            lock = install / ".ffmpeg.lock"
            lock.unlink(missing_ok=True)
            process_lock = install / ".install.lock"
            process_lock.unlink(missing_ok=True)
            log = root / "install.log"
            log.write_text("")
            events = root / "events"
            events.write_text("")
            env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ["PATH"],
                       DRIVERS=str(drivers), LOGFILE=str(log), FAIL_AT=failure,
                       EVENTS=str(events), TERM="xterm")
            result = subprocess.run(["bash", "-c", script], env=env, text=True,
                                    capture_output=True, timeout=10)
            assert not events.read_text(), events.read_text()
            if failure:
                assert result.returncode != 0, (failure, result.stdout, result.stderr)
                assert not lock.exists(), failure
                assert not process_lock.exists(), failure
                assert "Install Complete!" not in log.read_text(), failure
            else:
                assert result.returncode == 0, (result.stdout, result.stderr, log.read_text())
                assert lock.exists() and not process_lock.exists()
                assert sorted(path.name for path in destination.iterdir()) == [
                    "ffmpeg", "ffprobe", "qt-faststart"]

        (install / ".ffmpeg.lock").unlink()
        (drivers / "filebrowser.sh").write_text('''#!/bin/bash
[[ ! -e "$INSTALL_LOCK" ]] || exit 77
printf 'filebrowser continued\\n' >>"$EVENTS"
''')
        events.write_text("")
        env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ["PATH"],
                   DRIVERS=str(drivers), LOGFILE=str(log), FAIL_AT="wget", EVENTS=str(events),
                   INSTALL_LOCK=str(install / ".install.lock"), TERM="xterm")
        continued = script.replace("app_list=ffmpeg;", "app_list='ffmpeg filebrowser';")
        result = subprocess.run(["bash", "-c", continued], env=env, text=True,
                                capture_output=True, timeout=10)
        assert result.returncode != 0
        assert events.read_text() == "filebrowser continued\n"
        assert not (install / ".install.lock").exists()


def test_ffmpeg_does_not_remove_an_existing_package_lock():
    with tempfile.TemporaryDirectory(prefix="quickbox-existing-package-lock-") as directory:
        root = Path(directory)
        lock = root / ".install.lock"
        lock.write_text("another installer\n")
        source = (REPO / "packages/package/install/installpackage-ffmpeg").read_text()
        source = source.replace("/install/", str(root) + "/")
        script = root / "installer.sh"
        script.write_text(source)
        result = subprocess.run(["bash", str(script), "-l", str(root / "log")],
                                env=dict(os.environ, TERM="xterm"),
                                capture_output=True, text=True, timeout=5)
        assert result.returncode != 0
        assert lock.read_text() == "another installer\n"


def test_ffmpeg_does_not_remove_a_replaced_package_lock_on_exit():
    with tempfile.TemporaryDirectory(prefix="quickbox-replaced-package-lock-") as directory:
        root = Path(directory)
        (root / ".system.lock").touch()
        (root / "tmp").mkdir()
        bin_dir = root / "bin"
        bin_dir.mkdir()
        wget = bin_dir / "wget"
        wget.write_text('''#!/bin/bash
mv "$LOCK" "$LOCK.old"
printf 'FFmpeg\\n' >"$LOCK"
exit 42
''')
        wget.chmod(0o755)
        source = (REPO / "packages/package/install/installpackage-ffmpeg").read_text()
        source = source.replace("/tmp", str(root / "tmp"))
        source = source.replace("/install/", str(root) + "/")
        script = root / "installer.sh"
        script.write_text(source)
        lock = root / ".install.lock"
        env = dict(os.environ, TERM="xterm", LOCK=str(lock),
                   PATH=str(bin_dir) + os.pathsep + os.environ["PATH"])
        result = subprocess.run(["bash", str(script), "-l", str(root / "log")],
                                env=env, capture_output=True, text=True, timeout=5)
        assert result.returncode != 0
        assert lock.read_text() == "FFmpeg\n"
        assert (root / ".install.lock.old").exists()
