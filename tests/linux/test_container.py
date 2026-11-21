"""Linux-specific system checks run against a disposable container."""

import os
from pathlib import Path
import shutil
import subprocess

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def linux_image():
    if os.environ.get("QUICKBOX_IN_SYSTEM_CONTAINER") == "1":
        return None
    if shutil.which("docker") is None:
        pytest.skip("Docker is unavailable")
    probe = subprocess.run(["docker", "info", "--format", "{{.ServerVersion}}"], capture_output=True, text=True)
    if probe.returncode != 0:
        pytest.skip("Docker daemon is unavailable")
    return os.environ.get("QUICKBOX_SYSTEM_TEST_IMAGE", "python:3.14-slim-bookworm")


@pytest.mark.parametrize(
    ("name", "command"),
    [
        ("package_options", ["python3", "/repo/tests/linux/package_options.py"]),
        ("auth_lifecycle", ["python3", "/repo/tests/linux/auth_lifecycle.py"]),
    ],
)
def test_linux_container(linux_image, name, command):
    if linux_image is None:
        subprocess.run(command, check=True, timeout=int(os.environ.get("QUICKBOX_SANDBOX_TIMEOUT", "300")))
        return
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--env",
            "QUICKBOX_IN_SYSTEM_CONTAINER=1",
            "--volume",
            f"{REPO_ROOT}:/repo:ro",
            linux_image,
            *command,
        ],
        check=True,
        timeout=int(os.environ.get("QUICKBOX_SANDBOX_TIMEOUT", "300")),
    )
