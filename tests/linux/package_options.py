#!/usr/bin/env python3
"""Check package CLI options using GNU getopt in a Linux container.

Only each script's option parser runs; reporting and usage helpers are stubbed.
"""

import importlib.util
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PACKAGE = REPO / "packages/package"
SPEC = importlib.util.spec_from_file_location("package_lint", REPO / "scripts/lint-package-scripts.py")
assert SPEC is not None and SPEC.loader is not None
LINT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LINT)

# `_usage` and the reporters are stubbed; only the option parser runs.
STUBS = """_usage() { printf 'usage\\n'; }
_warning() { printf 'warning: %s\\n' "$*"; }
_info() { printf 'info: %s\\n' "$*"; }
OUTTO=/dev/null
"""


def scripts(action):
    return sorted((PACKAGE / action).glob(action + "package-[a-z0-9-]*"))


ALL_SCRIPTS = [(action, path) for action in ("install", "update", "remove") for path in scripts(action)]


def parse_option_block(path):
    """Return the OPT GENERATOR block of a package script."""
    bodies = LINT.section_bodies(path.read_text())
    return bodies["OPT GENERATOR"]


def run_options(path, *arguments, epilogue=""):
    """Run the option block with stubbed helpers and real getopt."""
    driver = STUBS + parse_option_block(path) + '\nprintf "parsed\\n"\n' + epilogue
    return subprocess.run(["bash", "-c", driver, "cli-contract", *arguments], capture_output=True, text=True)


class PackageOptionContract(unittest.TestCase):
    def test_help_is_available_everywhere(self):
        for action, path in ALL_SCRIPTS:
            for flag in ("-h", "--help"):
                with self.subTest(script=path.name, flag=flag):
                    result = run_options(path, flag)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn("usage", result.stdout)

    def test_unknown_option_fails_instead_of_being_ignored(self):
        for action, path in ALL_SCRIPTS:
            with self.subTest(script=path.name):
                result = run_options(path, "--definitely-not-an-option")
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn("usage", result.stdout)
                self.assertNotIn("parsed", result.stdout)

    def test_deprecated_static_flag_still_parses(self):
        for action in ("install", "update"):
            path = PACKAGE / action / (action + "package-qbittorrent")
            for flag in ("-s", "--static"):
                with self.subTest(script=path.name, flag=flag):
                    result = run_options(path, flag)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn("parsed", result.stdout)
                    self.assertIn("deprecated", result.stdout)
                    self.assertIn("warning:", result.stdout)

    def test_value_options_still_consume_their_argument(self):
        for action in ("install", "update"):
            path = PACKAGE / action / (action + "package-qbittorrent")
            with self.subTest(script=path.name):
                result = run_options(
                    path,
                    "--qb",
                    "4.6.7",
                    "--lt",
                    "1.2.19",
                    epilogue='printf "qb=<%s> lt=<%s>\\n" "$qbitversion" "$libtversion"\n',
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("qb=<4.6.7>", result.stdout)
                self.assertIn("lt=<1.2.19>", result.stdout)

    def test_removed_dead_options_are_rejected(self):
        # These were accepted by getopt but had no handler, so they never did
        # anything. Failing loudly is the contract now.
        cases = [
            ("install", "installpackage-docker", "-u", "admin"),
            ("install", "installpackage-docker", "--user", "admin"),
            ("remove", "removepackage-transmission", "-u", "admin"),
            ("update", "updatepackage-transmission", "--user", "admin"),
            ("install", "installpackage-qbclientblocker", "--old"),
        ]
        for action, name, *arguments in cases:
            path = PACKAGE / action / name
            with self.subTest(script=name, arguments=arguments):
                result = run_options(path, *arguments)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertNotIn("parsed", result.stdout)

    def test_misspelled_github_option_is_not_accepted(self):
        path = PACKAGE / "install/installpackage-rtorrent"
        self.assertEqual(run_options(path, "--with-github").returncode, 0)
        self.assertEqual(run_options(path, "--with-geithub").returncode, 1)


if __name__ == "__main__":
    unittest.main()
