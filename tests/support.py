"""Helpers for running Bash entry points against temporary test paths."""

import os
from pathlib import Path
import re
import subprocess

REPO = Path(__file__).resolve().parents[1]


def bash_function(source, name):
    """Return the complete ``function name() { ... }`` definition from a script."""
    match = re.search(r"^function " + re.escape(name) + r"\(\) \{\n.*?^\}", source, re.M | re.S)
    assert match, name
    return match.group(0)


def write_file(path, text, executable=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    if executable:
        path.chmod(0o755)
    return path


def run_bash(script, *args, env=None, check=False, timeout=30):
    return subprocess.run(
        ["bash", "-c", script, "test", *map(str, args)],
        env={**os.environ, "TERM": "xterm", **(env or {})},
        text=True,
        capture_output=True,
        check=check,
        timeout=timeout,
    )


def functions_before_main(path):
    return (REPO / path).read_text().split("# MAIN PROCESS")[0]
