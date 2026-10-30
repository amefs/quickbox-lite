"""Exercise install failure propagation and swap safety with isolated stubs."""
import os
from pathlib import Path
import re
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[2]
SOURCE = (REPO / "setup.sh").read_text()


def function(name):
    pattern = r"^function " + re.escape(name) + r"\(\) \{\n.*?^\}"
    match = re.search(pattern, SOURCE, re.M | re.S)
    assert match, name
    return match.group(0)


def run_bash(source, env=None):
    prefix = "quickbox-install-safety-"
    with tempfile.TemporaryDirectory(prefix=prefix) as temporary:
        script = Path(temporary) / "probe.sh"
        script.write_text(source)
        merged = dict(os.environ, TERM="xterm")
        merged.setdefault("PATH", "/usr/bin:/bin")
        if env:
            merged.update({str(key): str(value) for key, value in env.items()})
        return subprocess.run(["bash", str(script)], env=merged, text=True,
                              capture_output=True, timeout=15)


def startinstall_probe(failing_step="", gauge_rc=0):
    names = (
        "_validate_loaded_config", "_checkroot", "_checkdistro", "_checkovz",
        "_checkkernel", "_check_domain_dns", "_init", "_apply_locale",
        "_apply_timezone", "_apply_swap", "_chhostname", "_changeport",
        "_chsource", "_dependency", "_genadmin", "_insdashboard", "_insapps",
        "_denytracker", "_setvsftpd", "_insbbr", "_fixbcm",
    )
    stubs = []
    for name in names:
        stubs.append(f"function {name}() {{ [[ $FAIL_AT != {name} ]]; }}")
    return "\n".join([
        "_error() { printf 'ERROR:%s\\n' \"$*\"; }",
        function("_optional_failure"),
        "sleep() { :; }",
        "lsb_release() { [[ $1 == -is ]] && echo Debian || echo bookworm; }",
        "dpkg() { echo amd64; }",
        "_validate_loaded_config() { return 0; }",
        "_checkroot() { return 0; }\n"
        "_checkdistro() { return 0; }\n_checkovz() { return 0; }",
        "_checkkernel() { return 0; }\n_check_domain_dns() { return 0; }",
        "_init() { return 0; }\n_apply_locale() { return 0; }\n"
        "_apply_timezone() { return 0; }",
        "_apply_swap() { return 0; }\n_chhostname() { return 0; }\n"
        "_changeport() { return 0; }",
        "_chsource() { return 0; }\n"
        "_dependency() { [[ $FAIL_AT != _dependency ]]; }",
        "_genadmin() { return 0; }\n"
        "_insdashboard() { [[ $FAIL_AT != _insdashboard ]]; }",
        "_insapps() { [[ $FAIL_AT != _insapps ]]; }\n"
        "_denytracker() { return 0; }",
        "_setvsftpd() { return 0; }\n_insbbr() { return 0; }\n"
        "_fixbcm() { return 0; }",
        "whiptail() { if [[ $* == *--gauge* ]]; then cat >/dev/null; "
        "return \"$GAUGE_RC\"; fi; return 1; }",
        "reboot() { echo reboot-called >>\"$EVENTS\"; }",
        "systemctl() { return 0; }\napt-get() { return 0; }",
        "export FAIL_AT=" + failing_step,
        "export GAUGE_RC=" + str(gauge_rc),
        "function touch() { command touch \"$@\"; }",
        "function _map_cdn_option() { echo --with-github; }",
        "app_list=; [[ $FAIL_AT == _insapps ]] && app_list=mktorrent; "
        "hostname=; chport=default; chsource=0; denytracker=0; ftp=0; "
        "enable_bbr=0; lecert_domain=; autoreboot=1",
        "INFO_TEXT_DONE=Done; OUTTO=\"$LOGFILE\"; starttime=$(date +%s)",
        function("_startinstall"),
        "_startinstall",
    ])


def test_dependency_dashboard_and_apps_failure_propagate_without_reboot():
    for failed in ("_dependency", "_insdashboard", "_insapps"):
        prefix = "quickbox-startinstall-"
        with tempfile.TemporaryDirectory(prefix=prefix) as root:
            event = Path(root) / "events"
            log = Path(root) / "install.log"
            install_dir = Path(root) / "install"
            install_dir.mkdir()
            script = startinstall_probe(failed).replace(
                "/install", str(install_dir)
            )
            result = run_bash(script, {"EVENTS": event, "LOGFILE": log})
            assert result.returncode != 0, (
                failed, result.stdout, result.stderr
            )
            install_log = log.read_text() if log.exists() else ""
            assert "Install finished" not in install_log
            events = event.read_text() if event.exists() else ""
            assert "reboot-called" not in events
            assert not (install_dir / ".system.lock").exists()


def test_no_log_uses_real_null_device_without_preventing_commands():
    with tempfile.TemporaryDirectory(prefix="quickbox-no-log-install-") as root:
        install_dir = Path(root) / "install"
        install_dir.mkdir()
        events = Path(root) / "events"
        script = startinstall_probe().replace("/install", str(install_dir))
        script = script.replace(
            "_dependency() { [[ $FAIL_AT != _dependency ]]; }",
            '''_dependency() {
    bash -c 'printf executed >>"$EVENTS"; echo output; echo error >&2' >>"$OUTTO" 2>&1
}
''',
        )
        script = script.replace("autoreboot=1", "autoreboot=3")
        result = run_bash(script, {"EVENTS": events, "LOGFILE": "/dev/null 2>&1"})
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert events.read_text() == "executed"
        assert "output" not in result.stdout and "error" not in result.stderr
        assert not (install_dir / ".system.lock").exists()
        assert not any(path.name.endswith(".log") for path in Path(root).iterdir())


def test_no_log_passes_null_device_to_real_app_driver():
    with tempfile.TemporaryDirectory(prefix="quickbox-no-log-driver-") as root:
        base = Path(root)
        install_dir = base / "install"
        install_dir.mkdir()
        packages = base / "quickbox/package/install"
        packages.mkdir(parents=True)
        child = packages / "installpackage-ffmpeg"
        child.write_text('''#!/bin/bash
printf '%s\\n' "$2" >>"$EVENTS"
{ echo app-output; echo app-error >&2; } >>"$2" 2>&1
''')
        driver = base / "ffmpeg.sh"
        source = (REPO / "setup/scripts/ffmpeg.sh").read_text()
        driver.write_text(source.replace("/usr/local/bin/quickbox/", str(base / "quickbox") + "/"))
        events = base / "events"
        script = startinstall_probe().replace("/install", str(install_dir))
        script = script.replace("app_list=;", "app_list=ffmpeg;")
        script = script.replace("autoreboot=1", "autoreboot=3")
        script = script.replace(
            "_insapps() { [[ $FAIL_AT != _insapps ]]; }",
            '_insapps() { bash "$DRIVER" "$OUTTO" >/dev/null 2>&1; }',
        )
        result = run_bash(script, {"EVENTS": events, "LOGFILE": "/dev/null 2>&1", "DRIVER": driver})
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert events.read_text().strip() == "/dev/null"
        assert "app-output" not in result.stdout and "app-error" not in result.stderr
        assert not any(path.name.endswith(".log") for path in base.iterdir())


def test_progress_ui_failure_is_reported_without_overriding_worker_success():
    prefix = "quickbox-startinstall-ui-"
    with tempfile.TemporaryDirectory(prefix=prefix) as root:
        event = Path(root) / "events"
        log = Path(root) / "install.log"
        install_dir = Path(root) / "install"
        install_dir.mkdir()
        script = startinstall_probe(gauge_rc=17).replace(
            "/install", str(install_dir)
        )
        result = run_bash(script, {"EVENTS": event, "LOGFILE": log})
        assert result.returncode == 0
        assert "progress UI failed" in result.stderr
        assert "Install finished" in log.read_text()
        assert "reboot-called" in event.read_text()
        assert not (install_dir / ".system.lock").exists()


def test_selected_app_child_failure_does_not_report_done():
    with tempfile.TemporaryDirectory(prefix="quickbox-app-child-") as root:
        scripts = Path(root) / "scripts"
        scripts.mkdir()
        child = scripts / "mktorrent.sh"
        child.write_text("#!/bin/bash\nexit 45\n")
        child.chmod(0o755)
        source = "\n".join([
            "_map_cdn_option() { echo --with-github; }",
            "app_list=mktorrent; local_setup_script=\"$SCRIPTS/\"; "
            "OUTTO=/dev/null; INFO_TEXT_INSTALLAPP_5=Mktorrent; "
            "INFO_TEXT_DONE=Done; INFO_TEXT_SKIP=Skip; cdn=github",
            function("_insapps"),
            "_insapps",
        ])
        result = run_bash(source, {"SCRIPTS": scripts})
        assert result.returncode != 0
        assert "Done" not in result.stdout
        assert "mktorrent" in result.stderr


def test_independent_app_failure_does_not_skip_the_next_app():
    with tempfile.TemporaryDirectory(prefix="quickbox-app-continue-") as root:
        scripts = Path(root) / "scripts"
        scripts.mkdir()
        (scripts / "mktorrent.sh").write_text("#!/bin/bash\nexit 45\n")
        (scripts / "ffmpeg.sh").write_text("#!/bin/bash\necho ffmpeg >>\"$EVENTS\"\n")
        events = Path(root) / "events"
        script = "\n".join([
            "_map_cdn_option() { echo --with-github; }; sleep() { :; }",
            "app_list='mktorrent ffmpeg'; local_setup_script=\"$SCRIPTS/\"; "
            "OUTTO=/dev/null; INFO_TEXT_DONE=Done; INFO_TEXT_SKIP=Skip; cdn=github",
            function("_insapps"),
            "_insapps",
        ])
        result = run_bash(script, {"SCRIPTS": scripts, "EVENTS": events})
        assert result.returncode != 0
        assert events.read_text().strip() == "ffmpeg"
        assert "mktorrent" in result.stderr


def test_existing_system_marker_is_not_removed_by_another_install():
    with tempfile.TemporaryDirectory(prefix="quickbox-existing-marker-") as root:
        install_dir = Path(root) / "install"
        install_dir.mkdir()
        marker = install_dir / ".system.lock"
        marker.write_text("another installation")
        script = startinstall_probe("_dependency").replace("/install", str(install_dir))
        result = run_bash(script, {"EVENTS": Path(root) / "events", "LOGFILE": Path(root) / "log"})
        assert result.returncode != 0
        assert marker.read_text() == "another installation"


def test_failed_application_still_allows_ftp_and_reports_incomplete_install():
    with tempfile.TemporaryDirectory(prefix="quickbox-optional-continue-") as root:
        install_dir = Path(root) / "install"
        install_dir.mkdir()
        events = Path(root) / "events"
        log = Path(root) / "log"
        script = startinstall_probe("_insapps").replace("/install", str(install_dir))
        script = script.replace("ftp=0;", "ftp=1;")
        script = script.replace("_setvsftpd() { return 0; }",
                                '_setvsftpd() { echo ftp >>"$EVENTS"; }')
        result = run_bash(script, {"EVENTS": events, "LOGFILE": log})
        assert result.returncode != 0
        assert events.read_text().splitlines() == ["ftp"]
        assert "Application installation failed" in result.stderr
        assert "Installation completed with failures" in result.stderr
        assert not (install_dir / ".system.lock").exists()
        assert not log.exists() or "Install finished" not in log.read_text()


def test_locale_failure_does_not_block_core_installation():
    with tempfile.TemporaryDirectory(prefix="quickbox-locale-continue-") as root:
        install_dir = Path(root) / "install"
        install_dir.mkdir()
        events = Path(root) / "events"
        script = startinstall_probe().replace("/install", str(install_dir))
        script = script.replace("_apply_locale() { return 0; }", "_apply_locale() { return 1; }")
        script = script.replace("_genadmin() { return 0; }", '_genadmin() { echo account >>"$EVENTS"; }')
        result = run_bash(script, {"EVENTS": events, "LOGFILE": Path(root) / "log"})
        assert result.returncode != 0
        assert events.read_text().splitlines() == ["account"]
        assert "System locale could not be configured" in result.stderr
        assert not (install_dir / ".system.lock").exists()


def test_swap_failure_does_not_block_core_installation():
    with tempfile.TemporaryDirectory(prefix="quickbox-swap-continue-") as root:
        install_dir = Path(root) / "install"
        install_dir.mkdir()
        events = Path(root) / "events"
        script = startinstall_probe().replace("/install", str(install_dir))
        script = script.replace("_apply_swap() { return 0; }", "_apply_swap() { return 1; }")
        script = script.replace("_genadmin() { return 0; }", '_genadmin() { echo account >>"$EVENTS"; }')
        result = run_bash(script, {"EVENTS": events, "LOGFILE": Path(root) / "log"})
        assert result.returncode != 0
        assert events.read_text().splitlines() == ["account"]
        assert "Swap could not be configured" in result.stderr
        assert not (install_dir / ".system.lock").exists()


def test_dependency_apt_failure_is_explicit_and_keeps_auth_override():
    with tempfile.TemporaryDirectory(prefix="quickbox-apt-") as root:
        bin_dir = Path(root) / "bin"
        bin_dir.mkdir()
        events = Path(root) / "events"
        apt = bin_dir / "apt-get"
        apt.write_text(
            "#!/bin/bash\nprintf '%s\\n' \"$*\" >>\"$EVENTS\"\nexit 42\n"
        )
        apt.chmod(0o755)
        ui = bin_dir / "whiptail"
        ui.write_text("#!/bin/bash\nexit 0\n")
        ui.chmod(0o755)
        source = "OUTTO=/dev/null\nCODENAME=bookworm\n"
        source += function("_dependency") + "\n_dependency"
        result = run_bash(
            source, {"PATH": str(bin_dir) + ":/usr/bin:/bin",
                     "EVENTS": events}
        )
        assert result.returncode != 0
        calls = events.read_text().splitlines()
        assert len(calls) == 2
        assert all("--allow-unauthenticated" in call for call in calls)


def test_optional_dependency_failure_does_not_stop_other_dependencies():
    script = '''
OUTTO=/dev/null; CODENAME=bookworm; optional_failures=()
apt-get(){
    printf '%s\\n' "$*" >>"$EVENTS"
    [[ " $* " != *" htop "* ]]
}
''' + function("_optional_failure") + "\n" + function("_dependency") + '''
_dependency || exit 1
printf '%s\\n' "${optional_failures[@]}"
'''
    with tempfile.TemporaryDirectory(prefix="quickbox-optional-dependency-") as root:
        events = Path(root) / "events"
        result = run_bash(script, {"EVENTS": events})
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert "Optional package htop" in result.stderr
        assert "screenfetch" in events.read_text()


def swap_probe(root, body):
    swap_function = function("_apply_swap").replace(
        "/etc/fstab", '"$FSTAB_FILE"'
    )
    swap_function = swap_function.replace("/proc/swaps", '"$SWAPS_FILE"')
    return "\n".join([
        "_error() { echo \"$*\"; }",
        "free() { printf 'Mem: 1024 0 0 0 0 0\\n'; }",
        "whiptail() { cat >/dev/null; return \"${GAUGE_RC:-0}\"; }",
        "sleep() { return 0; }",
        "INFO_TEXT_DONE=Done; INFO_TITLE_SWAPON=Swap; "
        "INFO_TEXT_SWAPON_0=swap; swap_path=\"$SWAP_PATH\"",
        swap_function,
        body,
    ])


def test_swap_refuses_arbitrary_files_and_symlinks_without_modification():
    with tempfile.TemporaryDirectory(prefix="quickbox-swap-protect-") as root:
        directory = Path(root) / "target"
        directory.mkdir()
        fstab = Path(root) / "fstab"
        fstab.write_text("# existing\n")
        swaps = Path(root) / "swaps"
        swaps.write_text("Filename Type Size Used Priority\n")
        existing = directory / "existing"
        existing.write_text("keep this data\n")
        link = directory / "link"
        link.symlink_to(existing)
        env = {"SWAP_PATH": existing, "FSTAB_FILE": fstab, "SWAPS_FILE": swaps}
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode != 0
        assert existing.read_text() == "keep this data\n"
        env["SWAP_PATH"] = link
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode != 0 and link.is_symlink()


def test_active_swap_still_requires_a_regular_file_and_valid_probes():
    with tempfile.TemporaryDirectory(prefix="quickbox-swap-active-") as root:
        directory = Path(root) / "target"
        directory.mkdir()
        fstab = Path(root) / "fstab"
        swaps = Path(root) / "swaps"
        path = directory / "active.swap"
        path.write_text("active swap payload\n")
        fstab.write_text(f"{path} none swap sw 0 0\n")
        swaps.write_text(
            f"Filename Type Size Used Priority\n{path} file 1 0 -1\n"
        )
        env = {"SWAP_PATH": path, "FSTAB_FILE": fstab, "SWAPS_FILE": swaps}
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode == 0
        assert fstab.read_text() == f"{path} none swap sw 0 0\n"

        link = directory / "active-link"
        link.symlink_to(path)
        swaps.write_text(
            f"Filename Type Size Used Priority\n{link} file 1 0 -1\n"
        )
        env["SWAP_PATH"] = link
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode != 0

        env["SWAP_PATH"] = directory / "new.swap"
        env["SWAPS_FILE"] = directory  # readable directory, not a swap table
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode != 0

        env["SWAPS_FILE"] = swaps
        directory.chmod(0o777)
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode != 0
        directory.chmod(0o755)

        source = swap_probe(root, "_apply_swap").replace(
            "free() { printf 'Mem: 1024 0 0 0 0 0\\n'; }",
            "free() { return 3; }",
        )
        result = run_bash(source, env)
        assert result.returncode != 0


def test_active_swap_does_not_require_creation_tools():
    with tempfile.TemporaryDirectory(prefix="quickbox-swap-active-tools-") as root:
        target = Path(root) / "target"
        target.mkdir()
        swap = target / "active.swap"
        swap.write_text("existing swap")
        fstab = Path(root) / "fstab"
        fstab.write_text(f"{swap} none swap sw 0 0\n")
        swaps = Path(root) / "swaps"
        swaps.write_text(f"Filename Type Size Used Priority\n{swap} file 1 0 -1\n")
        script = swap_probe(root, '''
command(){
    if [[ $1 == -v && $2 == mkswap ]]; then return 1; fi
    builtin command "$@"
}
_apply_swap
''')
        result = run_bash(script, {"SWAP_PATH": swap, "FSTAB_FILE": fstab, "SWAPS_FILE": swaps})
        assert result.returncode == 0, (result.stdout, result.stderr)


def test_swap_creation_is_restrictive_idempotent_and_cleans_failed_new_file():
    with tempfile.TemporaryDirectory(prefix="quickbox-swap-create-") as root:
        directory = Path(root) / "target"
        directory.mkdir()
        fstab = Path(root) / "fstab"
        fstab.write_text("# existing\n")
        swaps = Path(root) / "swaps"
        swaps.write_text("Filename Type Size Used Priority\n")
        bin_dir = Path(root) / "bin"
        bin_dir.mkdir()

        def stub(name, text):
            path = bin_dir / name
            path.write_text("#!/bin/bash\n" + text + "\n")
            path.chmod(0o755)
        stub(
            "df", "echo 'Filesystem 1024-blocks Used Available Capacity "
            "Mounted on'; "
            "echo '/dev/test 9000000 1 8999999 1% /'"
        )
        stub(
            "blkid", '[[ -n "$VALID_SWAP_FILE" && "$*" == '
            '*"$VALID_SWAP_FILE"* ]] && { echo swap; exit 0; }; exit 2'
        )
        stub(
            "dd", 'for arg in "$@"; do [[ $arg == of=* ]] && '
            'target=${arg#of=}; done; printf data >"$target"; exit 0'
        )
        stub("mkswap", 'printf swap >>"$1"; exit 0')
        stub("swapon", '''
printf '%s\n' "$*" >>"$EVENTS"
if [[ ${SWAPON_RC:-0} != 0 ]]; then exit "$SWAPON_RC"; fi
if [[ $1 != --show* ]]; then printf '%s file 1 0 -1\n' "$1" >>"$SWAPS_FILE"; fi
''')
        swap = directory / "new.swap"
        env = {"PATH": str(bin_dir) + ":/usr/bin:/bin", "SWAP_PATH": swap,
               "FSTAB_FILE": fstab, "SWAPS_FILE": swaps,
               "EVENTS": Path(root) / "events"}
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode == 0, (result.stdout, result.stderr)
        assert swap.exists() and swap.stat().st_mode & 0o777 == 0o600
        assert fstab.read_text().count(f"{swap} swap swap defaults 0 0") == 1
        # Already active and recorded: no format or activation is repeated.
        calls_before = Path(root, "events").read_text().splitlines()
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode == 0
        assert Path(root, "events").read_text().splitlines() == calls_before
        # A newly created file is removed if activation fails.
        swaps.write_text("Filename Type Size Used Priority\n")
        failed_swap = directory / "failed.swap"
        env.update({"SWAP_PATH": failed_swap, "SWAPON_RC": "37"})
        result = run_bash(swap_probe(root, "_apply_swap"), env)
        assert result.returncode != 0 and not failed_swap.exists()


def test_existing_swap_permissions_are_secured_before_use():
    with tempfile.TemporaryDirectory(prefix="quickbox-swap-existing-") as root:
        directory = Path(root) / "target"
        directory.mkdir()
        swap = directory / "existing.swap"
        swap.write_text("existing swap payload")
        fstab = Path(root) / "fstab"
        swaps = Path(root) / "swaps"
        events = Path(root) / "events"
        env = {"SWAP_PATH": swap, "FSTAB_FILE": fstab, "SWAPS_FILE": swaps,
               "EVENTS": events}
        stubs = '''
blkid(){ echo swap; }
swapon(){ echo activated >>"$EVENTS"; }
dd(){ echo unexpected-dd >>"$EVENTS"; return 1; }
mkswap(){ echo unexpected-mkswap >>"$EVENTS"; return 1; }
'''
        for active in (False, True):
            for mode in (0o644, 0o666):
                swap.chmod(mode)
                fstab.write_text("")
                swaps.write_text("Filename Type Size Used Priority\n" +
                                 (f"{swap} file 1 0 -1\n" if active else ""))
                events.write_text("")
                result = run_bash(swap_probe(root, stubs + "\n_apply_swap"), env)
                assert result.returncode == 0, (result.stdout, result.stderr)
                assert swap.stat().st_mode & 0o777 == 0o600
                assert swap.read_text() == "existing swap payload"
                assert events.read_text().splitlines() == ([] if active else ["activated"])
                assert fstab.read_text().count(f"{swap} swap swap defaults 0 0") == 1

        # Simulate an unexpected owner and a failed chmod without requiring root.
        for active in (False, True):
            for failure in ("owner", "chmod"):
                swap.chmod(0o666)
                fstab.write_text("")
                swaps.write_text("Filename Type Size Used Priority\n" +
                                 (f"{swap} file 1 0 -1\n" if active else ""))
                events.write_text("")
                failure_stub = ('''stat(){ if [[ ${!#} == "$SWAP_PATH" ]]; then echo "999999";
                                   else command stat "$@"; fi; }''' if failure == "owner"
                                else "chmod(){ return 42; }")
                result = run_bash(swap_probe(root, stubs + failure_stub + "\n_apply_swap"), env)
                assert result.returncode != 0, (failure, active, result.stdout, result.stderr)
                assert not events.read_text() and not fstab.read_text()
                assert swap.read_text() == "existing swap payload"


def test_php_lock_recovery_and_auth_override_are_restored():
    php = function("_addPHP")
    assert "--allow-unauthenticated" in php
    assert "/var/lib/dpkg/updates/0*" in php
    assert "dpkg --configure -a" in php
    assert "apt-get install -f" in php


def test_kernel_locale_and_account_failures_stop_their_steps():
    with tempfile.TemporaryDirectory(prefix="quickbox-critical-helpers-") as temporary:
        root = Path(temporary)
        events = root / "events"
        env = {"EVENTS": events}
        kernel = '''
_errorcolor(){ :; }; _defaultcolor(){ :; }; whiptail(){ :; }
uname(){ case "$1" in -a) echo grsec;; -m) echo x86_64;; *) echo version;; esac; }
apt-get(){ echo apt >>"$EVENTS"; return 42; }
update-grub(){ echo grub >>"$EVENTS"; }
DISTRO=Ubuntu
''' + function("_checkkernel") + "\n_checkkernel\n"
        result = run_bash(kernel, env)
        assert result.returncode != 0
        assert events.read_text().splitlines() == ["apt"]

        events.unlink()
        locale = function("_apply_locale").replace("/etc/default/locale", str(root / "missing/locale"))
        script = 'uilang=en; dpkg-reconfigure(){ echo locale >>"$EVENTS"; };\n' + locale + "\n_apply_locale\n"
        result = run_bash(script, env)
        assert result.returncode != 0 and not events.exists()

        (root / "root").mkdir()
        account = function("_genadmin")
        for prefix in ("/root/", "/etc/", "/home/"):
            account = account.replace(prefix, str(root) + prefix)
        script = '''
_skel(){ :; }; _lshell(){ :; }; openssl(){ printf generated; }; useradd(){ :; }
chpasswd(){ echo chpasswd >>"$EVENTS"; return 42; }
username=configuser; password=ExamplePass123; OUTTO=/dev/null
''' + account + "\n_genadmin\n"
        result = run_bash(script, env)
        assert result.returncode != 0 and events.read_text().splitlines() == ["chpasswd"]
        assert not (root / "etc/htpasswd").exists()

        events.unlink()
        script = script.replace("_lshell(){ :; }", "_lshell(){ return 1; }")
        script = script.replace("username=configuser;", '_optional_failure(){ echo lshell >>"$EVENTS"; }\n'
                                "username=configuser;")
        result = run_bash(script, env)
        assert result.returncode != 0
        assert events.read_text().splitlines() == ["lshell", "chpasswd"]


def test_ftp_reports_service_start_status_and_continues_after_setup_errors():
    with tempfile.TemporaryDirectory(prefix="quickbox-ftp-setup-") as temporary:
        root = Path(temporary)
        (root / "etc").mkdir()
        (root / "root").mkdir()
        events = root / "events"
        ftp = function("_setvsftpd").replace("/etc/", str(root / "etc") + "/")
        ftp = ftp.replace("/root/", str(root / "root") + "/")
        script = '''
OUTTO=/dev/null; local_setup_template=/fixture/; ftp_ip=192.0.2.1
apt-get(){ echo apt >>"$EVENTS"; [[ $FAIL_AT != apt ]]; }
cp(){ echo cp >>"$EVENTS"; }
openssl(){ echo openssl >>"$EVENTS"; [[ $FAIL_AT != openssl ]]; }
sed(){ echo sed >>"$EVENTS"; return 9; }
iptables(){ echo iptables >>"$EVENTS"; return 9; }
systemctl(){ echo "systemctl $*" >>"$EVENTS"; [[ $FAIL_AT != start || $1 != start ]]; }
''' + ftp + "\n_setvsftpd\n"
        for failure in ("", "apt", "openssl", "start"):
            events.write_text("")
            result = run_bash(script, {"EVENTS": events, "FAIL_AT": failure})
            calls = events.read_text().splitlines()
            assert (result.returncode == 0) == (failure != "start"), (failure, calls, result.stderr)
            assert calls.count("sed") == 2 and "iptables" in calls
            assert "systemctl start vsftpd" in calls


def test_nginx_config_and_ttyd_download_failures_are_reported():
    with tempfile.TemporaryDirectory(prefix="quickbox-dashboard-helpers-") as temporary:
        events = Path(temporary) / "events"
        env = {"EVENTS": events}
        nginx = '''
rm(){ :; }; cp(){ echo cp >>"$EVENTS"; return 42; }
mkdir(){ echo unexpected >>"$EVENTS"; return 1; }
OUTTO=/dev/null; local_setup_template=/fixture/
''' + function("_insngx") + "\n_insngx\n"
        result = run_bash(nginx, env)
        assert result.returncode != 0 and events.read_text().splitlines() == ["cp"]
        events.unlink()
        bin_dir = Path(temporary) / "bin"
        bin_dir.mkdir()
        cp_stub = bin_dir / "cp"
        cp_stub.write_text("#!/bin/bash\nexit 0\n")
        cp_stub.chmod(0o755)
        console_function = "function _webconsole() {" + SOURCE.split("function _webconsole() {", 1)[1].split(
            "\nfunction _insdashboard()", 1
        )[0]
        console = '''
chmod(){ :; }; cp(){ :; }; arch(){ echo x86_64; }
curl(){ echo curl >>"$EVENTS"; return 42; }
wget(){ echo unexpected >>"$EVENTS"; return 1; }
OUTTO=/dev/null; local_setup_template=/fixture/
''' + console_function + "\n_webconsole\n"
        result = run_bash(console, dict(env, PATH=str(bin_dir) + ":" + os.environ["PATH"]))
        assert result.returncode != 0 and events.exists(), (result.stdout, result.stderr)
        assert events.read_text().splitlines() == ["curl"]
