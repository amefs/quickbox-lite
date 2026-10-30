"""Verify pytest routes system tests to Linux without redirecting lint tests."""

from pathlib import Path, PureWindowsPath
from types import SimpleNamespace

from tests import conftest
from tests import run


def test_system_tests_are_forwarded_to_container(monkeypatch):
    monkeypatch.setattr(conftest.sys, "platform", "darwin")
    calls = []
    monkeypatch.setattr(conftest.subprocess, "call", lambda args: calls.append(args) or 7)
    target = "tests/backups/test_backup_retention.py::test_dry_run_removes_nothing"
    config = SimpleNamespace(args=[target], invocation_params=SimpleNamespace(args=("-q", target)))
    monkeypatch.chdir(conftest.TESTS_ROOT.parent)

    assert conftest.pytest_cmdline_main(config) == 7
    assert calls[0][-2:] == ["-q", "/repo/" + target]


def test_lint_only_runs_on_host(monkeypatch):
    monkeypatch.setattr(conftest.sys, "platform", "darwin")
    target = str(Path(conftest.TESTS_ROOT) / "lint")
    config = SimpleNamespace(args=[target], invocation_params=SimpleNamespace(args=(target,)))
    monkeypatch.setattr(conftest.subprocess, "call", lambda args: pytest_unexpected_call())
    assert conftest.pytest_cmdline_main(config) is None


def test_windows_node_id_uses_container_path(monkeypatch):
    class WindowsPath(PureWindowsPath):
        def resolve(self):
            return self

    monkeypatch.setattr(conftest.sys, "platform", "win32")
    monkeypatch.setattr(conftest, "Path", WindowsPath)
    monkeypatch.setattr(conftest, "TESTS_ROOT", WindowsPath(r"C:\work\repo\tests"))
    calls = []
    monkeypatch.setattr(conftest.subprocess, "call", lambda args: calls.append(args) or 0)
    target = r"C:\work\repo\tests\backups\test_backup.py::test_case[param]"
    config = SimpleNamespace(args=[target], invocation_params=SimpleNamespace(args=("-q", target)))

    assert conftest.pytest_cmdline_main(config) == 0
    assert calls[0][-2:] == ["-q", "/repo/tests/backups/test_backup.py::test_case[param]"]


def test_direct_runner_converts_windows_paths(monkeypatch):
    class WindowsPath(PureWindowsPath):
        def resolve(self):
            return self

        def exists(self):
            return True

    monkeypatch.setattr(run, "Path", WindowsPath)
    monkeypatch.setattr(run, "REPO_ROOT", WindowsPath(r"C:\work\repo"))
    target = r"C:\work\repo\tests\backups\test_backup.py::test_case[param]"
    assert run.container_arguments(["-q", target, "/repo/tests/lint"]) == [
        "-q", "/repo/tests/backups/test_backup.py::test_case[param]", "/repo/tests/lint"
    ]


def pytest_unexpected_call():
    raise AssertionError("lint-only tests must remain on the host")
