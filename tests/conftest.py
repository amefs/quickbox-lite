"""Run Linux system tests in Docker when pytest starts on another OS."""

from pathlib import Path
import subprocess
import sys


TESTS_ROOT = Path(__file__).resolve().parent


def pytest_cmdline_main(config):
    if sys.platform.startswith("linux"):
        return

    lint_root = TESTS_ROOT / "lint"
    targets = [Path(target.split("::", 1)[0]).resolve() for target in config.args]
    if targets and all(path.is_relative_to(lint_root) for path in targets):
        return

    arguments = list(config.invocation_params.args)
    for target in config.args:
        if target not in arguments:
            continue
        path, separator, node = target.partition("::")
        try:
            relative = Path(path).resolve().relative_to(TESTS_ROOT.parent)
        except ValueError:
            continue
        arguments[arguments.index(target)] = f"/repo/{relative}{separator}{node}"

    print("Running system tests in Linux Docker container...", flush=True)
    return subprocess.call([sys.executable, str(TESTS_ROOT / "run.py"), *arguments])
