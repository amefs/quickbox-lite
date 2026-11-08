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


@pytest.mark.parametrize(
    ("alias", "script"),
    [
        ("da", "lang_da"), ("dansk", "lang_da"), ("danish", "lang_da"),
        ("de", "lang_de"), ("en", "lang_en"), ("en-us", "lang_en"),
        ("es", "lang_es"), ("fr", "lang_fr"),
        ("zh", "lang_zh"), ("zh-cn", "lang_zh"),
    ],
)
def test_box_language_alias_selects_the_matching_script(tmp_path, alias, script):
    lang_dir = tmp_path / "lang"
    lang_dir.mkdir()
    for name in ("lang_da", "lang_de", "lang_en", "lang_es", "lang_fr", "lang_zh"):
        status = 0 if name == script else 7
        write_file(lang_dir / f"langSelect-{name}", f"#!/bin/sh\nexit {status}\n", executable=True)
    box = (
        (REPO / "packages/system/box")
        .read_text()
        .replace("/usr/local/bin/quickbox/system/lang/", str(lang_dir) + "/")
    )
    result = run_bash(box, "lang", alias)
    assert result.returncode == 0
