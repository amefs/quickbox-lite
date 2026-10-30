"""Authentication installer checks. Run only in a disposable Linux container."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path("/repo")
VOUCH_ARGS = [
    "--domain",
    "qb.example.com",
    "--auth-url",
    "https://idp.example.com/auth",
    "--token-url",
    "https://idp.example.com/token",
    "--userinfo-url",
    "https://idp.example.com/userinfo",
    "--client-id",
    "cid",
    "--client-secret",
    "csecret",
]


def write(path, text, executable=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    if executable:
        path.chmod(0o755)


class AuthenticationLifecycle(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.bin = Path(self.temporary.name) / "bin"
        write(
            self.bin / "nginx",
            '#!/bin/sh\ncase "$*" in -t) exit "${NGINX_TEST_EXIT:-0}";; *) exit "${NGINX_RELOAD_EXIT:-0}";; esac\n',
            True,
        )
        write(self.bin / "systemctl", '#!/bin/sh\nexit "${SYSTEMCTL_EXIT:-0}"\n', True)
        write(
            self.bin / "docker",
            """#!/bin/sh
case "$*" in
*"hash generate"*) printf 'Digest: $argon2id$v=19$m=65536,t=3,p=4$stub\\n'; exit "${DOCKER_EXIT:-0}" ;;
esac
exit "${DOCKER_EXIT:-0}"
""",
            True,
        )
        for path in ["/opt/authelia", "/opt/vouch-proxy", "/etc/nginx/apps", "/etc/nginx/conf.d", "/install"]:
            shutil.rmtree(path, ignore_errors=True)
        for path in ["/opt", "/etc/nginx/apps", "/etc/nginx/conf.d", "/install", "/srv/dashboard/db"]:
            Path(path).mkdir(parents=True, exist_ok=True)
        write("/install/.docker.lock", "")
        write("/root/.admin.info", "admin:secretpass\n")
        write(
            "/usr/local/bin/quickbox/system/auxiliary/qbAuthMigrate", '#!/bin/sh\nexit "${AUTHMIGRATE_EXIT:-0}"\n', True
        )
        write("/srv/dashboard/db/output.log", "")

    def install(self, name, args, **variables):
        env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"], TERM="xterm", **variables)
        return subprocess.run(
            [
                "bash",
                str(REPO / "packages/package/install" / ("installpackage-" + name)),
                "-l",
                "/srv/dashboard/db/output.log",
                *args,
            ],
            env=env,
            text=True,
            capture_output=True,
        )

    def assert_result(self, result, name, success):
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        self.assertEqual(Path("/install/." + name + ".lock").exists(), success)
        self.assertFalse(Path("/install/.install.lock").exists())

    def test_authelia_missing_nginx_directory(self):
        shutil.rmtree("/etc/nginx/conf.d")
        self.assert_result(self.install("authelia", ["--domain", "qb.example.com"]), "authelia", False)

    def test_authelia_nginx_test_failure(self):
        self.assert_result(
            self.install("authelia", ["--domain", "qb.example.com"], NGINX_TEST_EXIT="1"), "authelia", False
        )

    def test_authelia_migration_failure(self):
        self.assert_result(
            self.install("authelia", ["--domain", "qb.example.com"], AUTHMIGRATE_EXIT="1"), "authelia", False
        )

    def test_authelia_success(self):
        self.assert_result(self.install("authelia", ["--domain", "qb.example.com"]), "authelia", True)
        self.assertIn("qb.example.com", Path("/opt/authelia/configuration.yml").read_text())

    def test_vouch_missing_nginx_directory(self):
        shutil.rmtree("/etc/nginx/apps")
        self.assert_result(self.install("vouchproxy", VOUCH_ARGS), "vouchproxy", False)

    def test_vouch_success_and_reinstall(self):
        self.assert_result(self.install("vouchproxy", VOUCH_ARGS), "vouchproxy", True)
        self.assertNotEqual(self.install("vouchproxy", VOUCH_ARGS).returncode, 0)


if __name__ == "__main__":
    if os.environ.get("QUICKBOX_IN_SYSTEM_CONTAINER") != "1":
        raise SystemExit("Run authentication lifecycle tests in a disposable container")
    unittest.main(verbosity=2)
