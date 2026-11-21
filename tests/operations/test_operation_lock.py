"""Concurrent package operations preserve the active lock and log."""

import os
import shlex
import subprocess
import time

import pytest

from tests.support import REPO, bash_function, run_bash, write_file


PACKAGE_LOCK_SCRIPTS = sorted(
    path.relative_to(REPO).as_posix()
    for pattern in (
        "packages/package/install/installpackage-*",
        "packages/package/update/updatepackage-*",
        "packages/package/remove/removepackage-*",
        "packages/package/templates/*.sh.template",
    )
    for path in REPO.glob(pattern)
    if path.is_file()
)


def _package_lock_functions(path, marker):
    source = (REPO / path).read_text()
    helpers = "\n".join(bash_function(source, name) for name in ("_setLock", "_clearInstallLock"))
    helpers = helpers.replace("/install/.install.lock", shlex.quote(str(marker)))
    return 'APP_TITLE="Same package"\n_error() { printf "%s\\n" "$@" >&2; }\n' + helpers


@pytest.mark.parametrize("path", PACKAGE_LOCK_SCRIPTS)
@pytest.mark.parametrize(
    "commands, expected_status, expected_marker",
    [
        ('_setLock\n_clearInstallLock\n[[ ! -e "$1" ]]', 0, None),
        ("_setLock\nexit 23", 23, None),
        ('printf Existing >"$1"\n_setLock', 1, "Existing"),
        ('_setLock\nrm -f "$1"\n_clearInstallLock', 0, None),
        (
            '_setLock\nmv "$1" "$1.original"\nprintf "%s\\n" "$APP_TITLE" >"$1"\n_clearInstallLock\nexit 23',
            23,
            "Same package\n",
        ),
    ],
    ids=("explicit-cleanup", "early-exit", "contention", "missing-marker", "replaced-marker"),
)
def test_package_lock_cleanup(tmp_path, path, commands, expected_status, expected_marker):
    marker = tmp_path / ".install.lock"
    result = run_bash(_package_lock_functions(path, marker) + "\n" + commands, marker)
    assert result.returncode == expected_status, result.stderr
    if expected_marker is None:
        assert not marker.exists()
    else:
        assert marker.read_text() == expected_marker


@pytest.mark.parametrize("path", PACKAGE_LOCK_SCRIPTS)
def test_direct_package_lock_contention(tmp_path, path):
    marker = tmp_path / ".install.lock"
    helpers = _package_lock_functions(path, marker)
    first = subprocess.Popen(
        [
            "bash", "-c", helpers + '\n_setLock\nprintf ready >"$1"\nread -r release',
            "test", str(tmp_path / "ready"),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        assert _wait_for_marker(tmp_path, "ready").exists()
        assert marker.read_text() == "Same package\n"
        second = run_bash(helpers + "\n_setLock", marker)
        assert second.returncode == 1, second.stderr
        assert marker.read_text() == "Same package\n"
        _, stderr = first.communicate("release\n", timeout=10)
        assert first.returncode == 0, stderr
        assert not marker.exists()
    finally:
        if first.poll() is None:
            first.terminate()
            first.communicate(timeout=10)


def _operation_sandbox(tmp_path):
    """Sandbox box + clean_log + lock helpers against tmp paths."""
    log = tmp_path / "srv/dashboard/db/output.log"
    write_file(log, "")
    install = tmp_path / "install"
    install.mkdir()
    quickbox = tmp_path / "quickbox"
    for helper in ("qbUpdateLib", "qbUpdateTimer", "qbUpdateStep"):
        write_file(
            quickbox / f"system/update/{helper}",
            (REPO / f"packages/system/update/{helper}").read_text(),
        )
    clean = (REPO / "packages/system/auxiliary/clean_log").read_text().replace("/srv/dashboard/db/output.log", str(log))
    write_file(quickbox / "system/auxiliary/clean_log", clean)
    box = (REPO / "packages/system/box").read_text().replace("/install/.", str(install) + "/.")
    box = box.replace("/usr/local/bin/quickbox/", str(quickbox) + "/")
    box_path = write_file(quickbox / "system/box", box)
    env = dict(
        os.environ,
        TERM="xterm",
        QUICKBOX_OPERATION_LOCK=str(tmp_path / "operation.lock"),
        QUICKBOX_UPDATE_CORE_LOCK=str(tmp_path / "core.lock"),
    )
    return log, install, quickbox, box_path, env


def _wait_for_marker(install, name=".install.lock"):
    marker = install / name
    deadline = time.monotonic() + 5
    while not marker.exists() and time.monotonic() < deadline:
        time.sleep(0.05)
    return marker


def test_package_operation_lock(tmp_path):
    log, install, quickbox, box_path, env = _operation_sandbox(tmp_path)
    app = quickbox / "package/install"
    write_file(
        app / "installpackage-a",
        f'''#!/bin/sh
printf 'a: started\\n' >>"{log}"
printf A >"{install}/.install.lock"
sleep 2
printf 'a: finished\\n' >>"{log}"
rm -f "{install}/.install.lock"
''',
        True,
    )
    write_file(app / "installpackage-b", f'#!/bin/sh\nprintf "b: started\\n" >>"{log}"\n', True)
    write_file(app / "installpackage-fail", "#!/bin/sh\nexit 23\n", True)

    def run(name):
        return subprocess.run(["bash", str(box_path), "install", name], env=env, text=True, capture_output=True)

    first = subprocess.Popen(
        ["bash", str(box_path), "install", "a"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    try:
        marker = _wait_for_marker(install)
        assert marker.read_text() == "A"
        assert run("b").returncode == 75
        assert "a: started" in log.read_text() and "b: started" not in log.read_text()
        assert marker.read_text() == "A"
        assert first.wait(timeout=10) == 0
        assert "a: finished" in log.read_text()
        assert run("b").returncode == 0
        assert "b: started" in log.read_text() and "a: finished" not in log.read_text()
        marker.write_text("Stale")
        with log.open("a") as output:
            output.write("keep this line\n")
        assert run("b").returncode == 75
        assert marker.read_text() == "Stale"
        assert "keep this line" in log.read_text()
        marker.unlink()
        assert run("fail").returncode == 23
    finally:
        if first.poll() is None:
            first.terminate()
            first.wait(timeout=10)


def test_clean_log_rejects_truncating_an_active_operation_log(tmp_path):
    """`box clean log` coordinates with the operation lock package runs hold."""
    log, install, quickbox, box_path, env = _operation_sandbox(tmp_path)
    write_file(log, "stale content\n")
    write_file(
        quickbox / "package/install/installpackage-a",
        f'''#!/bin/sh
printf 'a: started\\n' >>"{log}"
printf A >"{install}/.install.lock"
sleep 2
printf 'a: finished\\n' >>"{log}"
rm -f "{install}/.install.lock"
''',
        True,
    )
    first = subprocess.Popen(
        ["bash", str(box_path), "install", "a"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    try:
        marker = _wait_for_marker(install)
        assert marker.read_text() == "A"
        # The initial reset re-flocks the inherited operation lock and truncates.
        assert "stale content" not in log.read_text() and "a: started" in log.read_text()
        clean = subprocess.run(["bash", str(box_path), "clean", "log"], env=env, text=True, capture_output=True)
        assert clean.returncode == 75
        assert "Another QuickBox operation is running" in clean.stderr
        assert "a: started" in log.read_text()
        assert first.wait(timeout=10) == 0
    finally:
        if first.poll() is None:
            first.terminate()
            first.wait(timeout=10)
    assert "a: finished" in log.read_text()
