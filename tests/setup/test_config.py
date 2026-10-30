"""Exercise setup with machine paths redirected and destructive commands stubbed."""
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile


REPO = Path(__file__).resolve().parents[2]
SOURCE = (REPO / "setup.sh").read_text()
PASSWORD = "ExamplePass123"


def function(name):
    match = re.search(r"^function " + re.escape(name) + r"\(\) \{\n.*?^\}", SOURCE, re.M | re.S)
    assert match, name
    return match.group(0)


class Sandbox:
    def __init__(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="quickbox-setup-")
        self.root = Path(self.temporary.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.events = self.root / "events"
        self.events.touch()
        self.output = self.root / "config.json"
        self.script = self.root / "setup.sh"
        self.source = SOURCE
        for prefix in ("/etc/", "/root/", "/usr/local/bin/", "/install"):
            self.source = self.source.replace(prefix, str(self.root) + prefix)
        self.protected = {}
        for name in ("etc/locale.gen", "etc/default/locale", "etc/fstab", "etc/localtime",
                     "etc/timezone", "root/.swapfile"):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("existing host state\n")
            self.protected[path] = path.read_bytes()
        shutil.copytree(REPO / "setup/lang", self.root / "setup/lang")
        for name in ("apt-get", "systemctl", "service", "dpkg-reconfigure", "locale-gen", "dd",
                     "mkswap", "swapon", "update-grub", "reboot", "lsb_release", "dpkg", "curl"):
            self.command(name, 'printf "%s\\n" "' + name + ' $*" >>"$EVENTS"\nexit "$ALLOW_MUTATION"\n')
        self.command("ip", "exit 1\n")
        self.command("free", 'printf "Mem: 1024 0 0 0 0 0\\n"\n')
        self.command("sleep", "exit 0\n")
        self.command("whiptail", '''import os, sys
a = sys.argv[1:]
title = a[a.index('--title') + 1] if '--title' in a else ''
with open(os.environ['EVENTS'], 'a') as f:
    f.write('ui ' + title + '\\n')
if '--gauge' in a:
    sys.stdin.read()
    sys.exit(0)
if '--yesno' in a:
    if title in ('Configuration Summary', '配置摘要', 'Install Info', '安装信息'):
        sys.exit(int(os.environ.get('CANCEL_SUMMARY', '0')))
    if title in ('Timezone', '时区'):
        sys.exit(0)
    if title in ('Domain', '域名') and os.environ.get('TUI_DOMAIN'):
        sys.exit(0)
    sys.exit(1)
value = ''
if '--menu' in a:
    value = os.environ.get('TUI_LANGUAGE', 'English')
elif '--passwordbox' in a:
    value = 'ExamplePass123'
elif '--radiolist' in a:
    if title in ('SSH Port', 'SSH 端口'): value = '4747'
    elif title in ('Theme', '主题'): value = 'smoked'
    elif title in ('Auth Provider', '认证提供方'): value = os.environ.get('TUI_AUTH', 'none')
    elif title == 'Authelia Mode': value = 'password'
    elif title == 'BBR': value = '0'
elif '--inputbox' in a:
    if title in ('Create a Admin account', '创建管理账户'): value = 'configuser'
    elif title in ('Timezone', '时区'): value = 'Asia/Shanghai'
    elif title in ('Swap File', '交换文件'): value = '/target-only/swapfile'
    elif title in ('Setup Domain', '设置域名'): value = os.environ.get('TUI_DOMAIN', '')
    elif title == 'Info' and os.environ.get('TUI_AUTH'): value = 'box.local'
    else: value = 'box.example'
os.write(2, value.encode())
''', python=True)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.temporary.cleanup()

    def command(self, name, body, python=False):
        path = self.bin / name
        path.write_text((f"#!{sys.executable}\n" if python else "#!/bin/bash\n") + body)
        path.chmod(0o755)

    def run(self, *args, **overrides):
        self.script.write_text(self.source)
        env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                   TERM="xterm", EVENTS=str(self.events), ALLOW_MUTATION="97")
        env.update(overrides)
        return subprocess.run(["bash", str(self.script), *args], env=env, text=True,
                              capture_output=True, timeout=10)

    def generate(self, *args, **overrides):
        return self.run("--generate-config", "-u", "configuser", "-p", PASSWORD,
                        "--config-output", str(self.output), *args, **overrides)

    def unchanged(self):
        for path, content in self.protected.items():
            assert path.read_bytes() == content and not path.is_symlink(), path
        forbidden = [line for line in self.events.read_text().splitlines() if not line.startswith("ui ")]
        assert not forbidden, forbidden


def success(result):
    assert result.returncode == 0, (result.returncode, result.stdout, result.stderr)


def test_cli_generation_never_enters_installation():
    with Sandbox() as box:
        success(box.generate("--reboot", "--skip-summary", "--domain", "other-server.example",
                             "--hostname", "box.example", "--ftp-ip", "192.0.2.10"))
        config = json.loads(box.output.read_text())
        assert config["autoreboot"] is True and config["lecert_domain"] == "other-server.example"
        assert config["ftp_ip"] == "192.0.2.10"
        box.unchanged()


def test_timezone_argument_order_and_language():
    for language in ("en", "zh"):
        for first in (True, False):
            with Sandbox() as box:
                args = ["--generate-config", "--tz", "Asia/Shanghai"]
                if first:
                    args = ["--tz", "Asia/Shanghai", "--generate-config"]
                success(box.run(*args, "--lang", language, "-u", "configuser", "-p", PASSWORD,
                                "--config-output", str(box.output)))
                config = json.loads(box.output.read_text())
                assert config["lang"] == language and config["timezone"] == "Asia/Shanghai"
                box.unchanged()


def test_interactive_collection_is_read_only():
    for language in ("English", "Chinese Simpified"):
        with Sandbox() as box:
            success(box.run("--generate-config", "--config-output", str(box.output),
                            TUI_LANGUAGE=language, TUI_DOMAIN="other-server.example"))
            config = json.loads(box.output.read_text())
            assert config["timezone"] == "Asia/Shanghai"
            assert config["swap_path"] == "/target-only/swapfile"
            assert config["lecert_domain"] == "other-server.example"
            assert config["lang"] == ("en" if language == "English" else "zh")
            box.unchanged()


def test_loaded_config_preserves_target_settings_and_cli_overrides():
    with Sandbox() as box:
        input_file = box.root / "input.json"
        input_file.write_text(json.dumps({
            "username": "configuser", "password": PASSWORD,
            "swap_path": "/nonexistent-target/swap", "timezone": "Europe/Berlin",
            "packages": ["transmission"], "lecert_domain": "other-server.example",
        }))
        success(box.run("--config", str(input_file), "--generate-config", "--lang", "zh",
                        "--tz", "Asia/Shanghai", "--with-qbittorrent", "--skip-summary",
                        "--config-output", str(box.output)))
        config = json.loads(box.output.read_text())
        assert config["swap_path"] == "/nonexistent-target/swap"
        assert config["lang"] == "zh" and config["timezone"] == "Asia/Shanghai"
        assert config["packages"] == ["transmission", "qbittorrent"]
        box.unchanged()


def test_default_ssh_port_does_not_read_generator_host_config():
    with Sandbox() as box:
        source = box.root / "input.json"
        source.write_text(json.dumps({"username": "configuser", "password": PASSWORD, "ssh_port": "default"}))
        result = box.run("--config", str(source), "--generate-config", "--config-output", str(box.output))
        success(result)
        assert json.loads(box.output.read_text())["ssh_port"] == "default"
        assert "sshd_config" not in result.stderr
        box.unchanged()


def test_remote_config_only_downloads_requested_input():
    with Sandbox() as box:
        box.command("curl", '''printf 'download\\n' >>"$EVENTS"
while (($#)); do
    if [[ $1 == -o ]]; then
        printf '%s' '{"username":"configuser","password":"ExamplePass123"}' >"$2"
        exit 0
    fi
    shift
done
exit 96
''')
        success(box.run("--config", "https://example.invalid/config.json", "--generate-config",
                        "--config-output", str(box.output)))
        events = box.events.read_text().splitlines()
        assert events.count("download") == 1
        assert all(line == "download" or line.startswith("ui ") for line in events), events


def test_cancel_and_invalid_input_do_not_modify_host_or_output():
    for args, environment in (([], {"CANCEL_SUMMARY": "1"}), (["--tz", "../invalid"], {})):
        with Sandbox() as box:
            box.output.write_text("keep original\n")
            result = box.generate(*args, **environment)
            assert result.returncode != 0
            assert box.output.read_text() == "keep original\n"
            box.unchanged()
    with Sandbox() as box:
        bad = box.root / "bad.json"
        bad.write_text("{not json")
        result = box.run("--generate-config", "--config", str(bad))
        assert result.returncode != 0
        box.unchanged()


def test_output_is_private_and_replaced_only_on_success():
    with Sandbox() as box:
        box.output.write_text("old content\n")
        box.output.chmod(0o644)
        success(box.generate())
        assert stat.S_IMODE(box.output.stat().st_mode) == 0o600
        assert json.loads(box.output.read_text())["password"] == PASSWORD
        assert not list(box.root.glob(".quickbox-config.*"))
    with Sandbox() as box:
        box.output = box.root / "missing" / "output.json"
        result = box.generate()
        assert result.returncode != 0 and "Config file generated:" not in result.stdout
        box.unchanged()


def test_failed_serialization_or_rename_preserves_existing_output():
    real_jq = shutil.which("jq")
    assert real_jq
    for failure in ("jq", "mv"):
        with Sandbox() as box:
            box.output.write_text("keep original\n")
            if failure == "jq":
                box.command("jq", f'[[ $1 == -n ]] && exit 7\nexec "{real_jq}" "$@"\n')
            else:
                box.command("mv", "exit 8\n")
            result = box.generate()
            assert result.returncode != 0 and "Config file generated:" not in result.stdout
            assert box.output.read_text() == "keep original\n"
            assert not list(box.root.glob(".quickbox-config.*"))


def test_minimal_dependencies_and_failure_handling():
    cases = ((0, False, "", "jq"), (0, True, "", "jq"), (0, False, "", "whiptail"),
             (1000, False, "", "jq"), (0, False, "update", "jq"), (0, False, "install", "jq"),
             (0, False, "install-but-available", "jq"))
    for uid, remote, fail, missing in cases:
        with tempfile.TemporaryDirectory(prefix="quickbox-tools-") as temporary:
            state = Path(temporary) / "installed"
            script = function("_ensure_setup_tools").replace("$EUID", "$SIMULATED_UID") + r'''
_error(){ printf '%s\n' "$*" >&2; }; _info(){ :; }
command(){
    if [[ $1 == -v ]]; then
        case "$2" in
        jq|curl|whiptail)
            if [[ $2 == "$MISSING_TOOL" || ( $2 == curl && -n $config_file ) ]]; then
                [[ -f $STATE ]] && return 0 || return 1
            fi
            return 0;;
        apt-get) return 0;;
        esac
    fi
    builtin command "$@"
}
apt-get(){
    printf '%s\n' "$*"
    if [[ $FAIL == install-but-available && $1 == install ]]; then touch "$STATE"; return 9; fi
    [[ $FAIL == "$1" ]] && return 9
    [[ $1 != install ]] || touch "$STATE"
    return 0
}
_ensure_setup_tools
'''
            env = dict(os.environ, STATE=str(state), SIMULATED_UID=str(uid), FAIL=fail, MISSING_TOOL=missing,
                       config_gen_mode="1", config_file="https://example.invalid/config" if remote else "")
            result = subprocess.run(["bash", "-c", script], env=env, capture_output=True, text=True, timeout=5)
            if uid or fail == "install":
                assert result.returncode != 0
                assert not state.exists()
                if uid:
                    assert not result.stdout
            else:
                success(result)
                assert result.stdout.splitlines() == ["update", "install -y --no-install-recommends " + missing +
                                                      (" curl" if remote else "")]
                if fail == "update":
                    assert "trying available package indexes" in result.stderr
                if fail == "install-but-available":
                    assert "checking available tools" in result.stderr


def test_installation_applies_moved_settings_once_after_confirmation():
    for cancel, swap_failure in (("0", False), ("1", False), ("0", True)):
        with Sandbox() as box:
            swaps_file = box.root / "proc/swaps"
            swaps_file.parent.mkdir(parents=True)
            swaps_file.write_text("Filename Type Size Used Priority\n")
            box.source = box.source.replace("/proc/swaps", str(swaps_file))
            old_swap = str(box.root / "root/.swapfile")
            new_swap = str(box.root / "root/new.swap")
            box.source = box.source.replace('swap_path="' + old_swap + '"', 'swap_path="' + new_swap + '"')
            box.command("df", "echo 'Filesystem 1024-blocks Used Available Capacity Mounted on'\n"
                        "echo '/dev/test 9000000 1 8999999 1% /'\n")
            # Keep the real installation prelude; exclude unrelated dashboard/package deployment.
            prelude = (function("_startinstall").split("\t# record start time", 1)[0] +
                       "\t((${#optional_failures[@]} == 0))\n}\n")
            box.source = re.sub(r"^function _startinstall\(\) \{\n.*?^\}", lambda _: prelude,
                                box.source, count=1, flags=re.M | re.S)
            stubs = '''
_checkroot(){ echo checkroot >>"$EVENTS"; }
_checkdistro(){ echo checkdistro >>"$EVENTS"; }
_checkovz(){ echo checkovz >>"$EVENTS"; }
_checkkernel(){ echo checkkernel >>"$EVENTS"; }
_init(){ echo init >>"$EVENTS"; }
'''
            marker = "_prepare_runtime || exit 1\ntrap _cleanup_config_temp_file EXIT"
            assert marker in box.source
            box.source = box.source.replace(marker, stubs + "\n" + marker)
            if swap_failure:
                box.command("mkswap", 'echo mkswap_failed >>"$EVENTS"\nexit 97\n')
            result = box.run("-u", "configuser", "-p", PASSWORD, "--tz", "UTC",
                             CANCEL_SUMMARY=cancel, ALLOW_MUTATION="0")
            events = box.events.read_text().splitlines()
            if cancel == "1":
                assert result.returncode != 0
                box.unchanged()
            elif swap_failure:
                assert result.returncode != 0
                assert "mkswap_failed" in events
                assert not any(line.startswith("swapon ") for line in events)
                assert (box.root / "etc/fstab").read_text() == "existing host state\n"
            else:
                success(result)
                assert events.index("ui Install Info") < events.index("init")
                for step in ("checkroot", "checkdistro", "checkovz", "checkkernel", "init"):
                    assert events.count(step) == 1, events
                assert sum(line.startswith("dpkg-reconfigure locales") for line in events) == 1
                assert sum(line.startswith("dd ") for line in events) == 1
                assert sum(line.startswith("mkswap ") for line in events) == 1
                assert sum(line.startswith("swapon ") for line in events) == 1
                assert (box.root / "etc/localtime").is_symlink()
                assert (box.root / "etc/timezone").read_text() == "Etc/UTC\n"
                assert (box.root / "etc/fstab").read_text().count("swap defaults") == 1


def test_wrapper_rejects_only_actual_generation_options_before_setup():
    source = (REPO / "onekey.sh").read_text()
    for args in (("--generate-config",), ("--dev", "--generate-config"), ("--legacy", "--generate-config"),
                 ("--password", "--generate-config", "--generate-config"), ("--generate",),
                 ("-generate-config",)):
        with tempfile.TemporaryDirectory(prefix="quickbox-wrapper-") as temporary:
            path = Path(temporary) / "onekey.sh"
            path.write_text(source.replace('if [[ $1 == "--dev" ]]; then',
                                           'echo UNEXPECTED_SETUP\nexit 90\nif [[ $1 == "--dev" ]]; then', 1))
            result = subprocess.run(["bash", str(path), *args], capture_output=True, text=True, timeout=5)
            assert result.returncode == 1 and "UNEXPECTED_SETUP" not in result.stdout
            assert "local checkout" in result.stderr
    preflight = source.split('if [[ $1 == "--dev" ]]; then', 1)[0]
    for args in (("--password", "--generate-config"), ("--password=--generate-config",),
                 ("--pass", "--generate-config"), ("-rp", "--generate-config"),
                 ("-p--generate-config",), ("--", "--generate-config")):
        result = subprocess.run(["bash", "-c", preflight, "wrapper", *args],
                                capture_output=True, text=True, timeout=5)
        success(result)


def test_wrapper_option_spec_matches_setup():
    wrapper = (REPO / "onekey.sh").read_text()
    match = re.search(r"getopt -a -o (\S+) -l (\S+) --", SOURCE)
    assert match
    short, long = match.groups()
    assert f"short_options='{short}'" in wrapper
    assert f"long_options='{long}'" in wrapper


def test_dns_validation_is_retained_for_installation_host():
    for resolved, expected in (("192.0.2.10", 0), ("192.0.2.11", 1), ("", 1)):
        script = function("_check_domain_dns") + '''
_get_ip(){ ip=192.0.2.10; }
_error(){ :; }
curl(){ printf '%s' "$DNS_RESPONSE"; }
_check_domain_dns
'''
        answer = [{"type": 1, "data": resolved}] if resolved else []
        env = dict(os.environ, domain="box.example", lecert_domain="box.example", hostname="",
                   DNS_RESPONSE=json.dumps({"Answer": answer}))
        result = subprocess.run(["bash", "-c", script], env=env, capture_output=True, text=True, timeout=5)
        assert result.returncode == expected, result.stderr


def test_local_auth_domain_does_not_trigger_public_dns():
    script = "\n".join(function(name) for name in (
        "_trim_value", "_ensure_auth_domain", "_check_domain_dns"
    )) + '''
_error(){ :; }
_get_ip(){ echo unexpected-ip >>"$EVENTS"; return 1; }
curl(){ echo unexpected-dns >>"$EVENTS"; return 1; }
auth_domain=box.local; hostname=; domain=; lecert_domain=
_ensure_auth_domain
_check_domain_dns || exit 1
printf '%s\\n' "$domain"
'''
    with tempfile.TemporaryDirectory(prefix="quickbox-local-auth-") as root:
        events = Path(root) / "events"
        result = subprocess.run(["bash", "-c", script], env=dict(os.environ, EVENTS=str(events)),
                                capture_output=True, text=True, timeout=5)
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert result.stdout.strip() == "box.local"
        assert not events.exists()


def test_local_auth_interactive_and_config_install_reach_initialization():
    for from_config in (False, True):
        with Sandbox() as box:
            prelude = function("_startinstall").split("\t# record start time", 1)[0] + "}\n"
            box.source = re.sub(r"^function _startinstall\(\) \{\n.*?^\}", lambda _: prelude,
                                box.source, count=1, flags=re.M | re.S)
            stubs = '''
_checkroot(){ :; }; _checkdistro(){ :; }; _checkovz(){ :; }; _checkkernel(){ :; }
lsb_release(){ [[ $1 == -is ]] && echo Debian || echo bookworm; }
dpkg(){ echo amd64; }
_welcome(){ :; }
_init(){ echo init >>"$EVENTS"; }
_apply_locale(){ :; }; _apply_timezone(){ :; }; _apply_swap(){ :; }
'''
            marker = "_prepare_runtime || exit 1\ntrap _cleanup_config_temp_file EXIT"
            box.source = box.source.replace(marker, stubs + "\n" + marker)
            if from_config:
                config = box.root / "auth.json"
                config.write_text(json.dumps({"username": "configuser", "password": PASSWORD,
                                              "auth_provider": "authelia", "auth_domain": "box.local"}))
                args = ("--config", str(config))
            else:
                args = ()
            result = box.run(*args, TUI_AUTH="authelia")
            events = box.events.read_text().splitlines()
            assert result.returncode == 0, (from_config, result.stdout, result.stderr, events)
            assert "init" in events, events
            assert not any(line.startswith("curl ") for line in events), events
