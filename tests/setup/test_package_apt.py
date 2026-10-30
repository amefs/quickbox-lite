"""Exercise the existing APT overrides and lock-recovery paths with stubs."""
import os
from pathlib import Path
import re
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[2]
PACKAGE_DIR = REPO / "packages/package/install"
NAMES = (
    "rtorrent", "rutorrent", "flood", "transmission", "qbittorrent", "deluge",
    "mktorrent", "ffmpeg", "filebrowser", "linuxrar", "lecert", "vouchproxy",
)


def extract(source, name):
    pattern = r"^function " + re.escape(name) + r"\(\) \{\n.*?^\}"
    result = re.search(pattern, source, re.M | re.S)
    assert result, name
    return result.group(0)


def run(script, events, **overrides):
    env = dict(os.environ, EVENTS=str(events), EXEC_STATUS="0", OUTTO="/dev/null",
               APP_TITLE="test", APP_BASEDEPS="fake-package")
    env.update(overrides)
    return subprocess.run(["bash", "-c", script], env=env, text=True, capture_output=True, timeout=5)


def test_package_apt_lock_recovery_uses_original_sequence():
    with tempfile.TemporaryDirectory(prefix="quickbox-package-apt-") as temporary:
        events = Path(temporary) / "events"
        for name in NAMES:
            if name == "vouchproxy":
                continue
            source = (PACKAGE_DIR / ("installpackage-" + name)).read_text()
            update = extract(source, "_installSystemUpdates")
            events.write_text("")
            script = r'''
_info(){ :; }; _success(){ echo success >>"$EVENTS"; }; _warning(){ :; }; _error(){ :; }
apt-get(){
    printf 'apt %s\n' "$*" >>"$EVENTS"
    if [[ " $* " == *" upgrade "* && -z $upgraded ]]; then
        upgraded=1
        return 2
    fi
    return 0
}
find(){ echo /simulated-lock; }
rm(){ printf 'rm %s\n' "$*" >>"$EVENTS"; }
_execute(){ printf 'execute %s\n' "$1" >>"$EVENTS"; }
''' + update + "\n_installSystemUpdates\n"
            result = run(script, events)
            calls = events.read_text().splitlines()
            assert result.returncode == 0, (name, result.stdout, result.stderr)
            assert any(call.startswith("rm -f /var/lib/dpkg/updates/") for call in calls), (name, calls)
            assert "rm -rf /simulated-lock" in calls, (name, calls)
            assert "execute dpkg --configure -a" in calls, (name, calls)
            assert sum(" upgrade" in call for call in calls) == 2, (name, calls)
            assert "success" in calls, (name, calls)


def test_package_dependencies_keep_original_error_handling():
    with tempfile.TemporaryDirectory(prefix="quickbox-package-deps-") as temporary:
        events = Path(temporary) / "events"
        for name in NAMES:
            source = (PACKAGE_DIR / ("installpackage-" + name)).read_text()
            depends = extract(source, "_installDepends")
            for status in (0, 42):
                events.write_text("")
                script = r'''
_info(){ :; }; _success(){ echo success >>"$EVENTS"; }
_error(){ printf 'error %s\n' "$*" >>"$EVENTS"; }
_abort(){ _error "$1"; exit 1; }
_execute(){ printf '%s\n' "$1" >>"$EVENTS"; return "$EXEC_STATUS"; }
''' + depends + "\n_installDepends\n"
                result = run(script, events, EXEC_STATUS=str(status), APP_BASEDEPS="fake-one fake-two")
                calls = events.read_text().splitlines()
                expected_success = status == 0 or name == "deluge"
                assert (result.returncode == 0) == expected_success, (name, status, calls, result.stderr)
                commands = [line for line in calls if line.startswith("apt-get ")]
                assert commands and all("--allow-unauthenticated" in line for line in commands), (name, calls)
                assert len(commands) == (1 if status and name == "vouchproxy" else 2), (name, calls)
                if status:
                    assert "success" not in calls, (name, status, calls)
                    assert any("Could not install fake-one" in line for line in calls), (name, calls)
                    if name not in ("vouchproxy", "deluge"):
                        assert any("dependencies failed to install" in line for line in calls), (name, calls)
