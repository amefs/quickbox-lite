"""Check config semantics with extracted functions and the setup sandbox."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / "setup.sh").read_text()
PASSWORD = "ExamplePass123"
SANDBOX_SPEC = importlib.util.spec_from_file_location(
    "setup_config_sandbox", ROOT / "tests/setup/test_config.py"
)
assert SANDBOX_SPEC is not None
assert SANDBOX_SPEC.loader is not None
SANDBOX_MODULE = importlib.util.module_from_spec(SANDBOX_SPEC)
SANDBOX_SPEC.loader.exec_module(SANDBOX_MODULE)


def function(name):
    pattern = r"^function " + re.escape(name) + r"\(\) \{\n.*?^\}"
    match = re.search(pattern, SOURCE, re.M | re.S)
    assert match, name
    return match.group(0)


FUNCTION_NAMES = (
    "_validate_config_document",
    "_load_config",
    "_normalize_config",
    "_remove_app",
    "_apply_cli_overrides",
    "_generate_config",
    "_logcheck",
)
COMMON = "\n".join(function(name) for name in FUNCTION_NAMES) + r'''
_error(){ printf 'ERROR:%s\n' "$*" >&2; }
_info(){ :; }
_success(){ :; }
_warning(){ :; }
whiptail(){ return "${WHIPTAIL_RESULT:-1}"; }
mv(){
    if [[ $1 == -fT ]]; then
        command mv -f "$3" "$4"
    else
        command mv "$@"
    fi
}
_validate_username(){ return 0; }
_validate_password(){ return 0; }
_validate_port(){ return 0; }
_validate_timezone(){ return 0; }
_validate_domain(){ return 0; }
_validate_enum(){ return 0; }
'''

INITIAL_STATE = r'''
uilang=en; OUTTO=/root/log; hostname=; chport=4747
username=user; password=pass; ftp=1; ftp_ip=; dash_theme=smoked
timezone=; mirror=us; chsource=0; change_source=0; enable_bbr=0
denytracker=0; autoreboot=3; app_list=; rtgui=rutorrent
swap_path=/root/.swapfile; lecert_domain=; auth_provider=none
auth_domain=; config_auth_provider_explicit=0
qbit_ver=; de_ver=; qbit_libt_ver=; de_libt_ver=; rt_ver=; tr_ver=
authelia_auth_mode=password; ADMIN_EMAIL=; SMTP_HOST=; SMTP_PORT=587
SMTP_USERNAME=; SMTP_PASSWORD=; SMTP_SENDER=
OIDC_AUTH_URL=; OIDC_TOKEN_URL=; OIDC_USERINFO_URL=; OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=; OIDC_END_SESSION_ENDPOINT=; OIDC_USER=; OIDC_USER_MAP=
EMAIL_DOMAINS=
'''


def run(script, *args):
    with tempfile.TemporaryDirectory(prefix="quickbox-semantics-") as tmp:
        harness = Path(tmp) / "harness.sh"
        harness.write_text(COMMON + "\n" + script + "\n" + "\n".join(args))
        return subprocess.run(
            ["bash", str(harness)], text=True, capture_output=True, timeout=10
        )


def load_config(data, extra=""):
    with tempfile.TemporaryDirectory(prefix="quickbox-config-") as tmp:
        config = Path(tmp) / "input.json"
        config.write_text(data)
        script = INITIAL_STATE + f'\n_load_config {str(config)!r}\n' + extra + r'''
printf '%s\n' \
    "OUTTO=$OUTTO" "FTP=$ftp" "CHPORT=$chport" "MIRROR=$mirror" \
    "CHANGE_SOURCE=$change_source" "CHSOURCE=$chsource" \
    "AUTH=$auth_provider" "PACKAGES=$app_list" "QBIT=$qbit_ver"
'''
        harness = Path(tmp) / "harness.sh"
        harness.write_text(COMMON + "\n" + script)
        return subprocess.run(
            ["bash", str(harness)], text=True, capture_output=True, timeout=10
        )


def test_log_false_and_strict_types():
    script = 'OUTTO=/root/log; _logcheck; printf "OUTTO=%s\\n" "$OUTTO"'
    logcheck = run(script, "WHIPTAIL_RESULT=1")
    assert logcheck.returncode == 0
    assert logcheck.stdout.strip() == "OUTTO=/dev/null 2>&1"

    result = load_config('{"log":false,"ftp":false}')
    assert result.returncode == 0, result.stderr
    assert "OUTTO=/dev/null 2>&1" in result.stdout.splitlines() and "FTP=0" in result.stdout

    with SANDBOX_MODULE.Sandbox() as box:
        marker = "_prepare_runtime || exit 1"
        assert marker in box.source
        box.source = box.source.replace(marker, 'printf "OUTTO=%s\\n" "$OUTTO"\nexit 0', 1)
        result = box.run("--no-log")
        assert result.returncode == 0 and result.stdout.strip() == "OUTTO=/dev/null 2>&1"

    invalid_configs = (
        "[]",
        "null",
        "",
        "{} {}",
        '{"ftp":"false"}',
        '{"packages":"qbittorrent"}',
        '{"authelia":[]}',
        '{"vouch":{"oidc_client_id":false}}',
    )
    for data in invalid_configs:
        invalid = load_config(data)
        assert invalid.returncode != 0, (data, invalid.stdout, invalid.stderr)

    for data in ('{"ftp":null,"log":null}', '{}'):
        defaults = load_config(data)
        assert defaults.returncode == 0 and "FTP=0" in defaults.stdout


def test_mirror_legacy_and_explicit_us_round_trip():
    cases = (
        ('{"mirror":""}', "false"),
        ('{"mirror":"us"}', "false"),
        ('{"mirror":"de"}', "true"),
        ('{"mirror":"us","change_source":true}', "true"),
    )
    for data, expected in cases:
        result = load_config(data)
        assert result.returncode == 0, result.stderr
        assert f"CHANGE_SOURCE={expected}" in result.stdout
        expected_flag = 1 if expected == "true" else 0
        assert f"CHSOURCE={expected_flag}" in result.stdout


def test_versions_and_default_ssh_port_load():
    versions = {
        "ssh_port": "default",
        "qbittorrent_version": "4.6.7",
        "deluge_version": "2.1",
        "qbit_libt_version": "2.0",
        "de_libt_version": "1.2",
        "rtorrent_version": "0.9",
        "transmission_version": "4.0",
    }
    result = load_config(json.dumps(versions))
    assert result.returncode == 0, result.stderr
    assert "CHPORT=default" in result.stdout and "QBIT=4.6.7" in result.stdout

    numeric = load_config('{"ssh_port":4747}')
    assert numeric.returncode == 0 and "CHPORT=4747" in numeric.stdout

    override = load_config(
        '{"qbittorrent_version":"old"}',
        'declare -A _cli_override=([qbit_ver]=new); _apply_cli_overrides',
    )
    assert override.returncode == 0 and "QBIT=new" in override.stdout


def test_auth_provider_normalization_and_conflicts():
    cases = (
        ('{"auth_provider":"authelia","packages":[]}', 0, "authelia"),
        ('{"packages":["authelia"]}', 0, "authelia"),
        ('{"auth_provider":"none","packages":["authelia"]}', 1, ""),
        ('{"auth_provider":"authelia","packages":["vouchproxy"]}', 1, ""),
        ('{"packages":["authelia","vouchproxy"]}', 1, ""),
        ('{"auth_provider":"authelia","packages":["authelia","authelia"]}',
         0, "authelia"),
    )
    for data, expected_status, provider in cases:
        result = load_config(data, "_normalize_config || exit 9")
        expected_returncode = 0 if expected_status == 0 else 9
        assert result.returncode == expected_returncode, (
            data, result.stdout, result.stderr
        )
        if provider:
            assert f"AUTH={provider}" in result.stdout
            assert provider in result.stdout.split("PACKAGES=")[1]

    input_config = '{"auth_provider":"authelia","packages":["authelia","transmission"]}'
    override_cases = (("vouchproxy", "vouchproxy"), ("none", "none"))
    for cli_provider, expected_provider in override_cases:
        override = load_config(
            input_config,
            "declare -A _cli_override=([auth_provider]="
            + cli_provider
            + "); loaded_auth_provider=authelia; "
            "config_auth_provider_explicit=1; _apply_cli_overrides; "
            "_normalize_config || exit 9",
        )
        assert override.returncode == 0, (override.stdout, override.stderr)
        assert f"AUTH={expected_provider}" in override.stdout
        assert "authelia" not in override.stdout.split("PACKAGES=")[1]
        if cli_provider == "vouchproxy":
            assert "vouchproxy" in override.stdout.split("PACKAGES=")[1]

    legacy = load_config(
        '{"packages":["authelia","transmission"]}',
        "declare -A _cli_override=([auth_provider]=vouchproxy); "
        "loaded_auth_provider=authelia; _apply_cli_overrides; "
        "_normalize_config || exit 9",
    )
    assert legacy.returncode == 0, (legacy.stdout, legacy.stderr)
    assert "AUTH=vouchproxy" in legacy.stdout
    conflict = load_config(
        '{"packages":["authelia","vouchproxy"]}',
        "declare -A _cli_override=([auth_provider]=none); _apply_cli_overrides; "
        "_normalize_config || exit 9",
    )
    assert conflict.returncode == 9


def test_invalid_values_fail_before_host_changes():
    for invalid in ({"theme": ""}, {"rtorrent_gui": ""}, {"lang": ""},
                    {"packages": ["qbittorrent transmission"]},
                    {"qbittorrent_version": "4.6.7;echo unsafe"}):
        with SANDBOX_MODULE.Sandbox() as box:
            config = {"username": "configuser", "password": PASSWORD, **invalid}
            source = box.root / "invalid.json"
            source.write_text(json.dumps(config))
            result = box.run("--config", str(source), "--generate-config", "--config-output", str(box.output))
            assert result.returncode != 0, (invalid, result.stdout, result.stderr)
            assert not box.output.exists()
            box.unchanged()


def test_editing_auth_provider_updates_package_list():
    source = (ROOT / "setup.sh").read_text().split("# OPT GENERATOR", 1)[0]
    for selected in ("none", "vouchproxy"):
        script = source + r'''
_trim_value(){ printf '%s' "$1"; }
_ensure_auth_domain(){ :; }
_askvouch_config(){ :; }
whiptail(){ printf '%s' "$SELECTED" >&2; }
auth_provider=authelia
app_list='authelia transmission'
_askauthprovider
_normalize_config || exit 1
printf '%s\n%s\n' "$auth_provider" "$app_list"
'''
        result = subprocess.run(["bash", "-c", script], env=dict(os.environ, SELECTED=selected, TERM="xterm"),
                                capture_output=True, text=True, timeout=5)
        assert result.returncode == 0, (result.stdout, result.stderr)
        lines = result.stdout.splitlines()
        assert lines[0] == selected and "authelia" not in lines[1]
        assert ("vouchproxy" in lines[1]) == (selected == "vouchproxy")


def test_generate_preserves_sentinel_and_version_fields():
    with tempfile.TemporaryDirectory(prefix="quickbox-generate-") as tmp:
        output = Path(tmp) / "out.json"
        state = r'''
uilang=en; OUTTO=/dev/null; hostname=box; chport=default
username=configuser; password=ExamplePass123; ftp=0; ftp_ip=
dash_theme=smoked; timezone=; mirror=us; chsource=1
change_source=true; cdn=github; auth_provider=none; auth_domain=
authelia_auth_mode=password; ADMIN_EMAIL=; SMTP_HOST=; SMTP_PORT=587
SMTP_USERNAME=; SMTP_PASSWORD=; SMTP_SENDER=; OIDC_AUTH_URL=
OIDC_TOKEN_URL=; OIDC_USERINFO_URL=; OIDC_CLIENT_ID=; OIDC_CLIENT_SECRET=
OIDC_END_SESSION_ENDPOINT=; OIDC_USER=; OIDC_USER_MAP=; EMAIL_DOMAINS=
denytracker=0; enable_bbr=0; swap_path=/root/.swapfile; autoreboot=3
lecert_domain=; rtgui=rutorrent; app_list=; qbit_ver=4.6.7; de_ver=2.1
qbit_libt_ver=2.0; de_libt_ver=1.2; rt_ver=0.9; tr_ver=4.0
'''
        script = state + f"\nconfig_output_file={str(output)!r}\n_generate_config\n"
        result = run(script)
        assert result.returncode == 0, (result.stdout, result.stderr)
        config = json.loads(output.read_text())
        assert config["ssh_port"] == "default"
        assert config["change_source"] is True
        assert config["qbittorrent_version"] == "4.6.7"
        assert config["transmission_version"] == "4.0"
        assert stat_mode(output) == 0o600


def test_full_cli_entry_logs_mirror_versions_and_auth_override():
    with SANDBOX_MODULE.Sandbox() as box:
        result = box.generate(
            "--no-log", "--no-ftp", "--source", "us",
            "--qbittorrent-version", "4.6.7",
        )
        assert result.returncode == 0, (result.stdout, result.stderr)
        generated = json.loads(box.output.read_text())
        assert generated["log"] is False and generated["ftp"] is False
        assert generated["mirror"] == "us"
        assert generated["change_source"] is True
        assert generated["qbittorrent_version"] == "4.6.7"
        box.unchanged()

    with SANDBOX_MODULE.Sandbox() as box:
        source = box.root / "auth-input.json"
        source.write_text(json.dumps({
            "username": "configuser",
            "password": PASSWORD,
            "auth_provider": "authelia",
            "packages": ["authelia", "transmission"],
        }))
        result = box.run(
            "--config", str(source), "--generate-config",
            "--auth-provider", "vouchproxy", "--skip-summary",
            "--config-output", str(box.output),
        )
        assert result.returncode == 0, (result.stdout, result.stderr)
        config = json.loads(box.output.read_text())
        assert config["auth_provider"] == "vouchproxy"
        assert "authelia" not in config["packages"]
        assert "vouchproxy" in config["packages"]
        box.unchanged()


def stat_mode(path):
    return path.stat().st_mode & 0o777
