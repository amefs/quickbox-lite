#!/usr/bin/env python3
"""Run qbEnsureWsGateway against temporary paths and inject unsafe setup state."""
import os
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
HELPER = ROOT / "packages/system/auxiliary/qbEnsureWsGateway"

with tempfile.TemporaryDirectory(prefix="quickbox-gateway-") as temporary:
    root = pathlib.Path(temporary)
    env = os.environ.copy()
    env.update(
        QUICKBOX_ALLOW_NON_ROOT="1",
        QUICKBOX_WS_SECRET_FILE=str(root / "etc/quickbox/ws.secret"),
        QUICKBOX_WS_SNIPPET_FILE=str(root / "etc/nginx/snippets/quickbox-ws-gateway.conf"),
        QUICKBOX_DASHBOARD_DB_DIR=str(root / "db"),
        QUICKBOX_WS_SERVICE_USER=subprocess.check_output(["id", "-gn"], text=True).strip(),
    )
    result = subprocess.run(
        ["bash", "-c", 'umask 000; bash "$1"', "bash", str(HELPER)],
        env=env, capture_output=True, text=True,
    )
    assert result.returncode == 0, (result.returncode, result.stdout, result.stderr)
    secret = root / "etc/quickbox/ws.secret"
    snippet = root / "etc/nginx/snippets/quickbox-ws-gateway.conf"
    assert secret.stat().st_mode & 0o777 == 0o640
    assert snippet.stat().st_mode & 0o777 == 0o600

    (root / "outside").mkdir()
    (root / "unsafe").symlink_to(root / "outside", target_is_directory=True)
    env["QUICKBOX_WS_SNIPPET_FILE"] = str(root / "unsafe/snippet.conf")
    result = subprocess.run(["bash", str(HELPER)], env=env, capture_output=True, text=True)
    assert result.returncode != 0, "symlinked parent directory must be rejected"

print("gateway helper sandbox checks passed")
