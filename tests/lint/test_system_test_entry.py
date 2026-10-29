"""Verify pytest routes system tests to Linux without redirecting lint tests."""

from pathlib import Path
from types import SimpleNamespace

from tests import conftest


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


def pytest_unexpected_call():
    raise AssertionError("lint-only tests must remain on the host")
