"""Language selectors and CLI status propagation."""

import os

import pytest

from tests.support import REPO, run_bash, write_file

LANG = REPO / "packages/system/lang"


@pytest.mark.parametrize(("language", "status", "expected"), [("en", 17, 17), ("en", 0, 0), ("klingon", 0, 1)])
def test_box_language_status(tmp_path, language, status, expected):
    selector = tmp_path / "lang/langSelect-lang_en"
    write_file(selector, f"#!/bin/sh\nexit {status}\n", executable=True)
    box = (
        (REPO / "packages/system/box")
        .read_text()
        .replace("/usr/local/bin/quickbox/system/lang/", str(selector.parent) + "/")
    )
    result = run_bash(box, "lang", language)
    assert result.returncode == expected


@pytest.mark.parametrize("selector", sorted(LANG.glob("langSelect-*")), ids=lambda p: p.name)
def test_selector_persists_language_and_reports_failures(tmp_path, selector):
    install = tmp_path / "install"
    install.mkdir()
    (install / ".lang_fr.lock").touch()
    write_file(tmp_path / "nginx", '#!/bin/sh\nexit "${NGINX_EXIT:-0}"\n', executable=True)
    script = selector.read_text().replace("/install/", str(install) + "/")

    def run(code=0):
        return run_bash(
            "sleep() { :; }; " + script,
            env={"PATH": str(tmp_path) + os.pathsep + os.environ["PATH"], "NGINX_EXIT": str(code)},
        )

    assert run().returncode == 0
    assert len(list(install.glob(".lang_*"))) == 1
    result = run(1)
    assert result.returncode == 0
    assert "nginx reload failed" in result.stderr
    install.rename(tmp_path / "moved")
    assert run().returncode != 0


def test_all_language_aliases_are_available():
    box = (REPO / "packages/system/box").read_text()
    for alias in ("da", "de", "en", "es", "fr", "zh"):
        assert f'"{alias}"' in box
