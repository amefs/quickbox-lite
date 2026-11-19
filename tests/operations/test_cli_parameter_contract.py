"""Portable checks for box update argument forwarding."""

import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


class UpdateDispatcherContract(unittest.TestCase):
    """`box update quickbox` must forward the options qbUpdate documents."""

    def parse_arguments(self, *arguments):
        source = (REPO / "packages/system/qbUpdate").read_text()
        block = re.search(r"^function _parseUpdateArgs\(\) \{\n.*?^\}\n", source, re.S | re.M)
        assert block is not None, "qbUpdate no longer defines _parseUpdateArgs"
        driver = (
            "core=0\nfrom_checkout=0\nQB_UPDATE_VERBOSE=0\n" + block.group(0) + '\n_parseUpdateArgs "$@"\nstatus=$?\n'
            'printf "status=%s core=%s checkout=%s verbose=%s\\n" '
            '"$status" "$core" "$from_checkout" "${QB_UPDATE_VERBOSE:-0}"\n'
        )
        result = subprocess.run(["bash", "-c", driver, "qbUpdate", *arguments], capture_output=True, text=True)
        return result.returncode, result.stdout

    def test_box_forwards_updater_arguments(self):
        with tempfile.TemporaryDirectory(prefix="quickbox-box-forward-") as root:
            root_path = Path(root)
            quickbox = root_path / "usr/local/bin/quickbox/system"
            quickbox.mkdir(parents=True)
            (quickbox / "auxiliary").mkdir()
            forwarded = root_path / "forwarded.txt"
            updater = quickbox / "qbUpdate"
            updater.write_text(f'printf "%s\\n" "$@" >>"{forwarded}"\n')
            updater.chmod(0o755)
            source = (REPO / "packages/system/box").read_text()
            source = source.replace("/usr/local/bin/quickbox", str(quickbox.parent))
            driver = root_path / "box.sh"
            driver.write_text(source)
            driver.chmod(0o755)
            result = subprocess.run(
                ["bash", str(driver), "update", "quickbox", "--only-core", "--verbose"],
                capture_output=True,
                text=True,
                env=dict(os.environ, QUICKBOX_OPERATION_LOCK=str(root_path / "op.lock")),
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(forwarded.read_text().splitlines(), ["--only-core", "--verbose"])

    def test_documented_options_are_consumed(self):
        cases = {
            ("--only-core",): "status=0 core=1 checkout=0 verbose=0",
            ("--from-checkout",): "status=0 core=1 checkout=1 verbose=0",
            ("--verbose",): "status=0 core=0 checkout=0 verbose=1",
            ("-v",): "status=0 core=0 checkout=0 verbose=1",
        }
        for arguments, expected in cases.items():
            with self.subTest(arguments=arguments):
                status, output = self.parse_arguments(*arguments)
                self.assertEqual(status, 0)
                self.assertIn(expected, output)

    def test_unknown_updater_option_is_rejected(self):
        status, output = self.parse_arguments("--only-core-copy")
        self.assertEqual(status, 0)
        self.assertIn("status=2", output)

    def test_usage_lists_the_forwarded_options(self):
        source = (REPO / "packages/system/box").read_text()
        block = re.search(r"^function _help\(\) \{\n.*?^\}\n", source, re.S | re.M)
        assert block is not None, "box no longer defines _help"
        result = subprocess.run(["bash", "-c", block.group(0) + "\n_help"], capture_output=True, text=True)
        for flag in ("--only-core", "--branch", "--verbose"):
            with self.subTest(flag=flag):
                self.assertIn(flag, result.stdout + result.stderr)
