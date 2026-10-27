"""Concurrent package operations preserve the active lock and log."""

import os
import subprocess
import time

from tests.support import REPO, write_file


def test_package_operation_lock(tmp_path):
    log = tmp_path / "srv/dashboard/db/output.log"
    write_file(log, "")
    install = tmp_path / "install"
    install.mkdir()
    quickbox = tmp_path / "quickbox"
    write_file(quickbox / "system/update/qbUpdateLib", (REPO / "packages/system/update/qbUpdateLib").read_text())
    clean = (REPO / "packages/system/auxiliary/clean_log").read_text().replace("/srv/dashboard/db/output.log", str(log))
    write_file(quickbox / "system/auxiliary/clean_log", clean)
    box = (REPO / "packages/system/box").read_text().replace("/install/.", str(install) + "/.")
    box = box.replace("/usr/local/bin/quickbox/", str(quickbox) + "/")
    box_path = write_file(quickbox / "system/box", box)
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
    env = dict(
        os.environ,
        TERM="xterm",
        QUICKBOX_OPERATION_LOCK=str(tmp_path / "operation.lock"),
        QUICKBOX_UPDATE_CORE_LOCK=str(tmp_path / "core.lock"),
    )

    def run(name):
        return subprocess.run(["bash", str(box_path), "install", name], env=env, text=True, capture_output=True)

    first = subprocess.Popen(
        ["bash", str(box_path), "install", "a"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    try:
        marker = install / ".install.lock"
        deadline = time.monotonic() + 5
        while not marker.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
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
