#!/usr/bin/env python3
"""Run system tests locally on Linux and in a reusable image elsewhere."""

import os
from pathlib import Path
import subprocess
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IMAGE = "quickbox-system-tests:py3.14-pytest9.2-jq"


def main():
    arguments = sys.argv[1:] or ["tests"]
    if sys.platform.startswith("linux"):
        return subprocess.call(["uv", "run", "--locked", "pytest", *arguments], cwd=REPO_ROOT)

    image = os.environ.get("QUICKBOX_SYSTEM_TEST_IMAGE", DEFAULT_IMAGE)
    if (
        subprocess.call(["docker", "image", "inspect", image], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        != 0
    ):
        if image != DEFAULT_IMAGE:
            print(f"Container image is unavailable: {image}", file=sys.stderr)
            return 1
        subprocess.run(["docker", "build", "-t", image, str(REPO_ROOT / "tests/container")], check=True)

    return subprocess.call(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--volume",
            f"{REPO_ROOT}:/repo:ro",
            "--tmpfs",
            "/test-tmp:mode=700,exec",
            "--workdir",
            "/repo",
            "--env",
            "TMPDIR=/test-tmp",
            "--env",
            "QUICKBOX_IN_SYSTEM_CONTAINER=1",
            "--env",
            "TERM=xterm",
            "--env",
            "GIT_CONFIG_COUNT=1",
            "--env",
            "GIT_CONFIG_KEY_0=safe.directory",
            "--env",
            "GIT_CONFIG_VALUE_0=/repo",
            image,
            "python3",
            "-m",
            "pytest",
            "-o",
            "cache_dir=/tmp/pytest-cache",
            *arguments,
        ]
    )


if __name__ == "__main__":
    sys.exit(main())
