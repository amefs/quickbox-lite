#!/usr/bin/env python3
"""Regression tests for package scaffold linting and safe option parsing."""

import importlib.util
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("package_lint", REPO / "scripts/lint-package-scripts.py")
assert SPEC is not None and SPEC.loader is not None
LINT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LINT)
TEMPLATES = {action: (LINT.PACKAGE / "templates" / (action + ".sh.template")).read_text() for action in LINT.ROLES}


class PackageLintTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="quickbox-package-lint-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for action, source in TEMPLATES.items():
            (self.root / action).mkdir()
            self.script(action).write_text(source)

    def script(self, action="install"):
        return self.root / action / (action + "package-example")

    def mutate(self, old, new, action="install"):
        path = self.script(action)
        source = path.read_text()
        self.assertIn(old, source)
        path.write_text(source.replace(old, new, 1))

    def add_option(self, value=False):
        path = self.script()
        source = path.read_text()
        source = source.replace("-l help,log:", "-l help,log:," + ("force:" if value else "force"), 1)
        body = '\t\tFORCE="$2"\n\t\tshift\n' if value else "\t\tFORCE=1\n"
        source = source.replace("\t--)\n", "\t--force)\n" + body + "\t\t;;\n\t--)\n", 1)
        source = source.replace(
            '\techo "-h, --help', '\techo "--force                  force the operation"\n\techo "-h, --help', 1
        )
        path.write_text(source)

    def test_templates_and_repository_pass(self):
        self.assertEqual(LINT.lint(self.root), ([], 3))
        errors, count = LINT.lint(LINT.PACKAGE)
        self.assertEqual(errors, [])
        self.assertGreater(count, 0)

    def test_invalid_scaffolds_are_rejected(self):
        mutations = [
            ("#!/bin/bash", "#!/bin/sh", "[header]"),
            ("# SPDX-License-Identifier: GPL-3.0-or-later", "# no license", "[header]"),
            ("# INSTALL FUNCTIONS", "# REMOVE FUNCTIONS", "[sections]"),
            ("_norm=$(tput sgr0)", "_norm=custom", "[helpers]"),
            ('APP_NAME="example"', "APP_NAME=example", "[metadata]"),
            ('APP_LOCK=".${APP_NAME}.lock"', "APP_LOCK=.$APP_NAME.lock", "[metadata]"),
            ('APP_NAME="example"', 'APP_NAME="example"\nAPP_NAME="other"', "[metadata]"),
            ("function _usage() {", "_usage() {", "[format]"),
            ("function _installApp() {", "function _installApp(){", "[format]"),
            ("function _installInfo() {", "function _unexpectedInfo() {", "[functions]"),
            ("\n_installApp\n", "\n_missingApp\n", "[lifecycle]"),
            ("\n_lockCheck\n_setLock\n", "\n_setLock\n_lockCheck\n", "[lifecycle]"),
            ("\n_lockCleanup\n", "\n# _lockCleanup\n", "[lifecycle]"),
            ("\n_installApp\n", "\n_installApp\ntouch unexpected\n", "[lifecycle]"),
            ("rm -f /install/.install.lock", ":", "[locks]"),
            ("\t\texit 0\n", "\t\texit 1\n", "[options]"),
            ('eval set -- "${ARGS}"', "set -- $ARGS", "[options]"),
            ('OUTTO="$2"', "OUTTO=$2", "[options]"),
            ("-l help,log:", "-l help,log:,unused", "[options]"),
            ("-l help,log:", "-l help,log", "[options]"),
            ("-l help,log:", "-l help,log:,help", "[options]"),
            ("-l help,log:", "-l help,log::", "[options]"),
            ("\t\tshift\n", "\t\t:\n", "[options]"),
            ("while true; do", "while true", "[syntax]"),
        ]
        for old, new, expected in mutations:
            with self.subTest(old=old, new=new):
                self.script().write_text(TEMPLATES["install"])
                self.mutate(old, new)
                errors, _ = LINT.lint(self.root)
                self.assertTrue(any(expected in error for error in errors), errors)

    def test_duplicate_function_is_rejected(self):
        self.mutate("function _installApp() {", "function _installApp() {\n\t:\n}\n\nfunction _installApp() {")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("duplicate function" in error for error in errors), errors)

    def test_nonstandard_function_declarations_are_rejected(self):
        for replacement in ["function _installApp()\n{", "function _installApp {"]:
            with self.subTest(replacement=replacement):
                self.script().write_text(TEMPLATES["install"])
                self.mutate("function _installApp() {", replacement)
                errors, _ = LINT.lint(self.root)
                self.assertTrue(
                    any("[format]" in error and "function declarations" in error for error in errors), errors
                )

    def test_unknown_section_title_is_rejected(self):
        self.mutate("# HELP FUNCTIONS", "# HELPERS")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("unknown section title: HELPERS" in error for error in errors), errors)

    def test_separator_width_is_rejected(self):
        self.mutate(LINT.SEPARATOR + "\n# HELP FUNCTIONS", "#" * 79 + "\n# HELP FUNCTIONS")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("exactly 80 '#'" in error for error in errors), errors)

    def test_option_branch_rules(self):
        self.add_option()
        self.mutate("\t\tFORCE=1\n", "\t\tFORCE=1\n\t\tshift\n")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("flag option must not shift" in error for error in errors), errors)

        self.script().write_text(TEMPLATES["install"])
        self.add_option(value=True)
        self.mutate('\t\tFORCE="$2"\n', '\t\tFORCE="$1"\n')
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("value option must read $2" in error for error in errors), errors)

        self.script().write_text(TEMPLATES["install"])
        self.add_option(value=True)
        self.mutate('\t\tFORCE="$2"\n\t\tshift\n', '\t\tFORCE="$2"\n\t\t:\n')
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("value option must shift its argument once" in error for error in errors), errors)

    def test_usage_lists_every_option(self):
        self.add_option()
        self.mutate('\techo "--force                  force the operation"\n', "")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("document --force in _usage" in error for error in errors), errors)

    def test_app_lock_functions_manage_the_lock(self):
        self.mutate('\ttouch "/install/${APP_LOCK}"\n', "\t:\n")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("_installAppLock must create the package lock" in error for error in errors), errors)

        install = self.script("install")
        install.write_text(TEMPLATES["install"])
        self.mutate('\trm -f "/install/${APP_LOCK}"\n', "\t:\n", action="remove")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("_removeAppLock must remove the package lock" in error for error in errors), errors)

    def test_app_lock_must_agree_between_actions(self):
        self.mutate('APP_LOCK=".${APP_NAME}.lock"', 'APP_LOCK=".${username}.${APP_NAME}.lock"', action="remove")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("APP_LOCK must agree across lifecycle" in error for error in errors), errors)

    def test_stray_section_titles_are_rejected(self):
        for title in ["CORE VARIABLE", "HELP FUNCTIONS", "UPDATE FUNCTIONS"]:
            with self.subTest(title=title):
                self.script().write_text(TEMPLATES["install"])
                self.mutate(
                    LINT.SEPARATOR + "\n# HELP FUNCTIONS", "# " + title + "\n\n" + LINT.SEPARATOR + "\n# HELP FUNCTIONS"
                )
                errors, _ = LINT.lint(self.root)
                self.assertTrue(
                    any("[sections]" in error and "stray or duplicate" in error for error in errors), errors
                )

    def test_license_header_divider_is_allowed(self):
        source = TEMPLATES["install"]
        boundary = source.index(LINT.SEPARATOR + "\n# HELP FUNCTIONS")
        header = source[:boundary].rstrip() + "\n" + LINT.SEPARATOR + "\n\n"
        self.script().write_text(header + source[boundary:])
        self.assertEqual(LINT.lint(self.root), ([], 3))

    def test_metadata_must_agree_between_actions(self):
        self.mutate('APP_NAME="example"', 'APP_NAME="other"', action="remove")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("agree across lifecycle" in error for error in errors), errors)

    def test_header_requires_aligned_and_nonempty_fields(self):
        self.mutate("# GitHub:           ", "# GitHub:   ")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("align its value at column 20" in error for error in errors), errors)

        self.script().write_text(TEMPLATES["install"])
        self.mutate("# Author:           <author>\n", "")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("missing required header field: Author" in error for error in errors), errors)

        self.script().write_text(TEMPLATES["install"])
        self.mutate("# Author:           <author>\n", "# Author:           \n")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("Author: must not be empty" in error for error in errors), errors)

    def test_header_rejects_unknown_fields_and_bad_order(self):
        self.mutate("# Author:           <author>\n", "# Author:           <author>\n# URL:              \n")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("unknown header field: URL" in error for error in errors), errors)

        self.script().write_text(TEMPLATES["install"])
        self.mutate("# Author:           <author>\n", "# Maintainer:       Example\n# Author:           <author>\n")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("header fields must follow this order" in error for error in errors), errors)

    def test_header_requires_blank_separators(self):
        self.mutate("#\n# SPDX-License-Identifier", "# SPDX-License-Identifier")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("blank # line before the SPDX identifier" in error for error in errors), errors)

        self.script().write_text(TEMPLATES["install"])
        self.mutate("#!/bin/bash\n", "#!/bin/bash\n# shellcheck disable=SC2034\n")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("blank # line after the shebang" in error for error in errors), errors)

    def test_header_agrees_between_actions(self):
        self.mutate("# Author:           <author>", "# Author:           Other", action="remove")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("[header] Author must agree across lifecycle scripts" in error for error in errors), errors)

    def test_inventory_cannot_silently_skip_files(self):
        self.script("remove").unlink()
        (self.root / "install/not-a-package.sh").write_text("#!/bin/bash\n")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("has no remover" in error for error in errors), errors)
        self.assertTrue(any("expected installpackage-" in error for error in errors), errors)

    def test_unreadable_encoding_is_a_lint_failure(self):
        self.script().write_bytes(b"\xff")
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("[read]" in error for error in errors), errors)

    def test_empty_tree_fails(self):
        for action in LINT.ROLES:
            self.script(action).unlink()
        errors, _ = LINT.lint(self.root)
        self.assertTrue(any("no package lifecycle scripts" in error for error in errors), errors)

    def test_line_endings(self):
        for source in [TEMPLATES["install"].rstrip("\n"), TEMPLATES["install"].replace("\n", "\r\n")]:
            with self.subTest(crlf="\r" in source):
                self.script().write_bytes(source.encode())
                errors, _ = LINT.lint(self.root)
                self.assertTrue(any("[format]" in error for error in errors), errors)

    def test_heredoc_payload_is_opaque(self):
        # Includes the same traps as the generated mktorrent wrapper and auth
        # updater Python payloads: duplicate functions, section names and getopt.
        payload = "\n".join(
            [
                "\tcat <<'FIRST' <<-SECOND",
                LINT.SEPARATOR,
                "# OPT GENERATOR",
                LINT.SEPARATOR,
                "function _usage() {",
                "}",
                'if ! ARGS=$(getopt -a -o broken -l broken -- "$@"); then',
                "FIRST",
                "\tfunction _installApp() {",
                "\t}",
                "\tSECOND",
                "",
            ]
        )
        self.mutate("function _installApp() {\n", "function _installApp() {\n" + payload)
        self.assertEqual(LINT.lint(self.root), ([], 3))

    def test_lint_never_runs_package_code(self):
        marker = self.root / "must-not-exist"
        self.mutate(
            "function _installApp() {\n", "function _installApp() {\n\ttouch " + shlex.quote(str(marker)) + "\n"
        )
        result = subprocess.run(
            ["python3", str(REPO / "scripts/lint-package-scripts.py"), "--root", str(self.root)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(marker.exists())

    def run_option_fragment(self, action, normalized, fail=False):
        block = LINT.section_bodies(TEMPLATES[action])["OPT GENERATOR"]
        # Stub only getopt's normalization result. This checks eval/quoting and
        # loop behavior on macOS as well as Linux, without running package code.
        driver = (
            """getopt() { printf '%s\\n' "$NORMALIZED"; return "$GETOPT_STATUS"; }
_usage() { printf 'usage\\n'; }
OUTTO=default
"""
            + block
            + "\nprintf 'log=<%s>\\n' \"$OUTTO\"\n"
        )
        return subprocess.run(
            ["bash", "-c", driver],
            capture_output=True,
            text=True,
            env={**os.environ, "NORMALIZED": normalized, "GETOPT_STATUS": "1" if fail else "0"},
        )

    def test_option_fragments_preserve_paths_and_exit_codes(self):
        path = str(self.root / "a b'c-$(touch injected).log")
        for action in LINT.ROLES:
            with self.subTest(action=action):
                result = self.run_option_fragment(action, "-l " + shlex.quote(path) + " --")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, f"log=<{path}>\n")
                self.assertEqual(self.run_option_fragment(action, "--help --").returncode, 0)
                self.assertEqual(self.run_option_fragment(action, "", fail=True).returncode, 1)
