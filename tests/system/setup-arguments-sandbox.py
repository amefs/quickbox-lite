#!/usr/bin/env python3
"""Exercise wrapper and child-script argv handling with temporary stubs only."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from sandbox_support import run_cases

REPO = Path(__file__).resolve().parents[2]
ONEKEY = (REPO / "onekey.sh").read_text()


class Sandbox:
    def __init__(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="quickbox-arguments-")
        self.root = Path(self.temporary.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.events = self.root / "events.jsonl"
        self.forwarded = self.root / "setup-argv.json"
        self.script = self.root / "onekey.sh"
        self.setup_root = self.root / "etc" / "QuickBox"
        self.source = ONEKEY.replace("/etc/QuickBox", str(self.setup_root))
        self.source = self.source.replace("/install", str(self.root / "install"))
        self.source = self.source.replace("_checkroot\n", "# root check omitted in sandbox\n")
        self.command("tput", "exit 0\n")
        self.command("sleep", "exit 0\n")
        self.command("dos2unix", "exit 0\n")
        self.command("apt-get", '''
printf '%s\\n' "$*" >>"$EVENTS"
if [[ ${FAIL_APT:-} && " $* " == *" ${FAIL_APT} "* ]]; then exit 31; fi
exit 0
''')
        self.command("git", '''
printf '%s\\n' "$*" >>"$EVENTS"
destination=${!#}
mkdir -p "$destination"
cat >"$destination/setup.sh" <<'SETUP'
#!/bin/bash
python3 -c 'import json,os,sys; json.dump(sys.argv[1:], open(os.environ["FORWARDED"], "w"))' "$@"
exit "${SETUP_EXIT:-0}"
SETUP
exit 0
''')
        self.command("screen", '''
printf '%s\\n' "$*" >>"$EVENTS"
if [[ $1 == -dmS ]]; then
    [[ -z $SCREEN_START_EXIT ]] || exit "$SCREEN_START_EXIT"
    shift 4
    "$@"
    exit $?
fi
exit 0
''')

    def __enter__(self):
        self.script.write_text(self.source)
        return self

    def __exit__(self, *args):
        self.temporary.cleanup()

    def command(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/bash\n" + body)
        path.chmod(0o755)

    def run(self, *args, **overrides):
        env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                   EVENTS=str(self.events), FORWARDED=str(self.forwarded), QB_ONEKEY_BOOTSTRAP="1")
        env.update(overrides)
        return subprocess.run(["bash", str(self.script), *args], env=env, text=True,
                              capture_output=True, timeout=10)


def test_onekey_preserves_argv_as_data_and_branch_array():
    marker_payload = "space 'double\" $HOME ; touch MARKER * ? [ab]"
    for branch_flag, branch_name in (("--dev", "development"), ("--legacy", "legacy")):
        with Sandbox() as box:
            marker = box.root / "MARKER"
            payload = marker_payload.replace("MARKER", str(marker))
            args = [branch_flag, "--username", "user name", "--password", payload,
                    "--hostname", "", "--qbittorrent-version", "4.6.7; echo nope", "--domain", "line1\nline2"]
            result = box.run(*args)
            assert result.returncode == 0, (result.returncode, result.stdout, result.stderr)
            assert json.loads(box.forwarded.read_text()) == args[1:]
            assert not marker.exists(), "shell metacharacters in argument executed"
            events = box.events.read_text().splitlines()
            git_args = next(line for line in events if line.startswith("clone "))
            assert f"--branch {branch_name}" in git_args, git_args
            assert any(" update" in line for line in events)


def test_onekey_getopt_option_spec_matches_setup():
    one_key = (REPO / "onekey.sh").read_text()
    setup = (REPO / "setup.sh").read_text()
    short_match = re.search(r"local short_options='([^']+)'", one_key)
    long_match = re.search(r"local long_options='([^']+)'", one_key)
    assert short_match and long_match
    short_options = short_match.group(1)
    long_options = long_match.group(1)
    setup_getopt = re.search(r'ARGS=\$\(getopt -a -o ([^ ]+) -l ([^ ]+) --', setup)
    assert setup_getopt
    assert setup_getopt.group(1).strip("'\"") == short_options
    assert setup_getopt.group(2).strip("'\"") == long_options


def test_onekey_preserves_empty_argument():
    with Sandbox() as box:
        result = box.run("--password", "", "--hostname", "quote'and\"dollar$;", "--password", "--generate-config")
        assert result.returncode == 0, (result.returncode, result.stdout, result.stderr)
        assert json.loads(box.forwarded.read_text()) == [
            "--password", "", "--hostname", "quote'and\"dollar$;", "--password", "--generate-config"
        ]


def test_onekey_install_failure_is_explicit():
    with Sandbox() as box:
        result = box.run(FAIL_APT="install")
        assert result.returncode != 0
        assert "Unable to install required packages" in result.stdout
        assert not any(line.startswith("clone ") for line in box.events.read_text().splitlines())


def test_onekey_restores_original_lock_recovery():
    with Sandbox() as box:
        box.command("apt-get", '''
printf 'apt %s\\n' "$*" >>"$EVENTS"
if [[ " $* " == *" upgrade "* && ! -f "$UPGRADE_MARKER" ]]; then
    touch "$UPGRADE_MARKER"
    exit 2
fi
exit 0
''')
        box.command("find", 'printf "%s\\n" /simulated-lock\n')
        box.command("rm", 'printf "rm %s\\n" "$*" >>"$EVENTS"\n')
        box.command("dpkg", 'printf "dpkg %s\\n" "$*" >>"$EVENTS"\n')
        result = box.run(UPGRADE_MARKER=str(box.root / "upgrade-marker"))
        assert result.returncode == 0, (result.stdout, result.stderr)
        calls = box.events.read_text().splitlines()
        assert any(call.startswith("rm -f /var/lib/dpkg/updates/") for call in calls), calls
        assert "rm -rf /simulated-lock" in calls, calls
        assert "dpkg --configure -a" in calls, calls
        assert sum(" upgrade" in call for call in calls) == 2, calls


def test_screen_start_failure_stops_wrapper():
    with Sandbox() as box:
        result = box.run(SCREEN_START_EXIT="42")
        assert result.returncode != 0
        assert "Unable to start the installer session" in result.stdout + result.stderr
        assert not box.forwarded.exists()
        assert not any(line.startswith("-rA ") for line in box.events.read_text().splitlines())


def test_generation_mode_remains_rejected_by_onekey():
    for args in (("--generate-config",), ("--gen",), ("-generate-config",),
                 ("--config=local.json", "--generate-config")):
        with Sandbox() as box:
            result = box.run(*args)
            assert result.returncode != 0
            assert "bash setup.sh --generate-config" in result.stderr
            assert not box.events.exists() or not box.events.read_text()


def test_setup_script_wrappers_preserve_argv_and_child_status():
    with tempfile.TemporaryDirectory(prefix="quickbox-child-wrappers-") as temporary:
        root = Path(temporary)
        package_dir = root / "package" / "install"
        package_dir.mkdir(parents=True)
        capture = root / "capture.jsonl"
        child = '''name=${0##*/}
python3 - "$name" "$@" <<'PYCHILD'
import json, os, sys
with open(os.environ["CAPTURE"], "a") as out:
    out.write(json.dumps({"name": sys.argv[1], "args": sys.argv[2:]}) + "\\n")
PYCHILD
case "$name" in installpackage-rutorrent|installpackage-flood) exit "${GUI_EXIT:-${CHILD_EXIT:-0}}" ;; esac
exit "${CHILD_EXIT:-0}"
'''
        for name in ("qbittorrent", "deluge", "transmission", "rtorrent", "rutorrent", "flood",
                     "filebrowser", "linuxrar", "ffmpeg", "mktorrent", "lecert", "authelia", "vouchproxy"):
            path = package_dir / f"installpackage-{name}"
            path.write_text(child)
            path.chmod(0o755)
        env = dict(os.environ, CAPTURE=str(capture))

        def run_script(name, *args, **overrides):
            script = (REPO / "setup" / "scripts" / f"{name}.sh").read_text()
            script = script.replace("/usr/local/bin/quickbox", str(root))
            staged = root / f"{name}.sh"
            staged.write_text(script)
            staged.chmod(0o755)
            child_env = dict(env)
            child_env.update(overrides)
            return subprocess.run(["bash", str(staged), *args], env=child_env,
                                  text=True, capture_output=True, timeout=10)

        tricky = "space 'quote\" $HOME ; * ? [xy]"
        cases = {
            "qbittorrent": ["--with-cf", "--qb", "4.6.7-rc", "--lt", "", tricky],
            "deluge": ["--with-sf", "--de", "2.1.1", "--lt", "2.0.9", tricky],
            "transmission": ["--with-osdn", "--version", "4.0.6; echo nope", "", tricky],
        }
        for name, flags in cases.items():
            log = str(root / "log path;*.txt")
            result = run_script(name, log, *flags)
            assert result.returncode == 0, (name, result.stderr)
            record = json.loads(capture.read_text().splitlines()[-1])
            assert record["args"] == ["-l", log, *flags], (name, record)

        log = str(root / "log path;*.txt")
        for name in ("ffmpeg", "filebrowser", "linuxrar", "mktorrent"):
            result = run_script(name, log, CHILD_EXIT="42")
            assert result.returncode == 42, (name, result.stderr)
            record = json.loads(capture.read_text().splitlines()[-1])
            assert record["args"] == ["-l", log], (name, record)

        result = run_script("lecert", log, "example.test", CHILD_EXIT="42")
        assert result.returncode == 42, result.stderr
        record = json.loads(capture.read_text().splitlines()[-1])
        assert record["args"] == ["-l", log, "-d", "example.test"], record

        for name in ("authelia", "vouchproxy"):
            flags = ["-l", log, "--client-secret", tricky, ""]
            result = run_script(name, *flags, CHILD_EXIT="42")
            assert result.returncode == 42, (name, result.stderr)
            record = json.loads(capture.read_text().splitlines()[-1])
            assert record["args"] == flags, (name, record)

        rtorrent_flags = ["--with-github", "--version", "0.15.5", tricky]
        result = run_script("rtorrent", str(root / "log path"), "flood", *rtorrent_flags)
        assert result.returncode == 0, result.stderr
        records = [json.loads(line) for line in capture.read_text().splitlines()[-2:]]
        assert records[0]["args"] == ["-l", str(root / "log path"), *rtorrent_flags]
        assert records[1]["name"] == "installpackage-flood"
        assert records[1]["args"] == ["-l", str(root / "log path")]

        result = run_script("rtorrent", log, "rutorrent", GUI_EXIT="43")
        assert result.returncode == 43, result.stderr
        records = [json.loads(line) for line in capture.read_text().splitlines()[-2:]]
        assert [record["name"] for record in records] == [
            "installpackage-rtorrent", "installpackage-rutorrent"]

        before = len(capture.read_text().splitlines())
        result = run_script("rtorrent", str(root / "log"), "../../evil", *rtorrent_flags)
        assert result.returncode == 2
        assert len(capture.read_text().splitlines()) == before

        result = run_script("transmission", str(root / "log"), "--version", "4.0", CHILD_EXIT="42")
        assert result.returncode == 42

        before = len(capture.read_text().splitlines())
        result = run_script("rtorrent", str(root / "log"), "rutorrent", CHILD_EXIT="42")
        assert result.returncode == 42
        added = [json.loads(line) for line in capture.read_text().splitlines()[before:]]
        assert len(added) == 1 and added[0]["name"] == "installpackage-rtorrent", added


sys.exit(run_cases(globals(), "setup argument and package-manager sandbox"))
