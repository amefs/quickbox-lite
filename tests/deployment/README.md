# Dashboard deployment acceptance

The acceptance workflow separates environment preparation from application checks.
The shared image is built once per run, then reused by Linux and authentication
jobs. The native systemd job receives the same npm cache and compiled bundle.
The existing CI workflow owns the full WS unit suite; deployment acceptance
does not repeat it.

The Linux, systemd and authentication suites mutate `/srv`, `/etc/nginx`, `/etc/quickbox`, `/install` and managed
service files. Run them only in their disposable container or a fresh CI VM.
They never mount the host's deployment directories or Docker socket.

## CI stages and reports

The `CI` workflow runs system tests on pushes and pull requests alongside
TypeScript/unit, JavaScript, shell, and combined Python/package checks. Two system
test groups run in parallel. Dashboard acceptance starts as soon as the change
selection finishes, in parallel with the other checks; each job still reports its
own result. Both workflows use the same triggering commit, including the merge commit for a pull
request. Deployment acceptance runs for relevant pull requests; push events run
system tests and lint without repeating deployment acceptance. To run manually, select `CI` in
Actions and use **Run workflow**; this runs the checks and acceptance in parallel.

`.github/workflows/deployment.yml` exposes these groups as individual steps:

| Job | Application checks |
| --- | --- |
| Browser | Page rendering; widgets and WS data; PMC state and mock actions; locale; debug console; error dialogs |
| Build image | System tools; current and pinned baseline production dependencies; committed bundle; offline installation proof; reusable artifacts |
| Linux deployment | Fresh install/permissions/sudo; HTTP/TLS/Socket.IO; baseline/repeated upgrade; five injected failures and rollback; WS/CLI mutual exclusion |
| systemd | Real deployment; unit settings/automatic restart/port recovery; detached update across a WS service restart |
| Authentication | Basic Auth; WebKit single-login regression; Authelia; Vouch, each with its own step |

Each acceptance job writes a summary with passed, failed and skipped stages and
per-stage durations. System test groups run independently; stateful
deployment and authentication steps stop after a failure. Cleanup and summary
steps always run. Failures retain Linux/service logs or authentication
Compose logs and browser screenshots.

The browser interaction job starts alongside image preparation while the system
tests and lint run. It runs the full `e2e/tests` Playwright suite against the local
Node dashboard in mock mode, without Docker, nginx or application installation.
Package actions update mock state rather than installing software or changing
host services. npm dependencies and Chromium are cached. HTML reports and browser
test artifacts are uploaded on success or failure. Changes anywhere under `e2e/`,
including tests and Playwright configuration, select acceptance.

## External dependencies

Network access is allowed during preparation: pulling the Node 24 and provider
images, installing system packages, downloading locked npm dependencies, and
installing Chromium. Docker build layers and Chromium/npm downloads are cached.
The shared image includes current and fixed baseline production dependencies,
plus a minimal locked Socket.IO test client in `tests/deployment/package.json`.
It uses the committed bundle, so it does not install the WS development toolchain
or repeat the bundle build. The parallel WS check rebuilds the bundle and fails if
the committed file is stale.
CI transfers the image as an artifact rather than rebuilding it in each consumer.

Application installation and upgrade still run the real production `npm ci`.
The test environment sets `npm_config_offline=true`, disables audit/fund requests,
and uses the cache prepared earlier. A missing package fails the check; there is
no online fallback. The image build proves that current production dependencies
can be installed offline. Native systemd preparation installs only the small
test-client dependency tree from the transferred cache. The actual application installation then installs its
production dependencies offline. Neither step repeats the bundle build or fetches
baseline dependencies that systemd does not use.

Linux acceptance runs with Docker `--network=none`; loopback nginx/Node traffic
continues to work. Authentication services share a fixture network namespace,
with only fixture TLS port 18443 published on host loopback. The authentication
fixture disables Authelia's external NTP startup probe. Authentication and the VM
enforce npm's offline mode but do not block all networking. Dependency lifecycle scripts
are not disabled; offline npm alone does not sandbox arbitrary lifecycle scripts.

No acceptance phase runs a full OS `apt upgrade`, downloads ttyd, or fetches a
live QuickBox repository. Node package-manager/download decisions are tested with
sandbox command fixtures. The production Dashboard install body is executed
with nginx, Node and webconsole prerequisites already prepared. A full Seedbox
installation, distribution package upgrades and reboot remain outside this suite.

## Local Linux acceptance

```sh
bash tests/deployment/run-linux.sh
```

Requires Docker with BuildKit named contexts, Git, and the pinned baseline commit
`e0b522b8ccced7a07d0ae9cb575c052af6054d7e`. The wrapper exports that commit from
Git, uses the current production bundle with Node 24, and starts a disposable
Debian container. Build source changes before running local acceptance:

```sh
npm ci --prefix setup/dashboard/ws
npm run build --prefix setup/dashboard/ws
```

The CI CI checks that the committed bundle matches the sources. No ports are
published. Set `QUICKBOX_TEST_BASELINE` to test a different available commit.

For subsequent runs with unchanged dependency locks:

```sh
QUICKBOX_DEPLOYMENT_SKIP_BUILD=1 bash tests/deployment/run-linux.sh
```

This mounts the checkout read-only, checks the application, baseline and test-client
locks against the image, and copies current code and the selected baseline into
the container. It uses the locally built bundle without reinstalling development
tools. Lock changes fail and require an image rebuild. Set
`QUICKBOX_DEPLOYMENT_USE_IMAGE=1` instead to run the prepared image as-is, as CI
does; this deliberately tests the sources already included in that image. Reusing
that image does not export a baseline or require the old commit in the checkout;
the prepared image already contains it.

To expose separate phases while keeping one container:

```sh
export QUICKBOX_DEPLOYMENT_CONTAINER=quickbox-acceptance-local
export QUICKBOX_DEPLOYMENT_USE_IMAGE=1
trap 'bash tests/deployment/run-linux.sh --cleanup' EXIT
bash tests/deployment/run-linux.sh --start
for phase in install transports upgrade recovery mutex; do
  bash tests/deployment/run-linux.sh --phase "$phase" || exit 1
done
```

The phases check:

- The actual Dashboard install body, followed by health, real root/www-data
  permissions, `visudo`, allowed sudo execution and denial of unrelated commands.
- HTTP IPv4, HTTP IPv6 and HTTPS IPv4, both Socket.IO paths, polling and direct
  WebSocket handshakes through real nginx.
- Upgrade from the pinned old runtime, dependencies, vhost and service unit;
  repeated upgrade; secret and custom proxy-directive preservation.
- npm, restart, nginx test/reload and health failure recovery. Candidates differ
  from the live bundle and previous vhost bytes must be restored. The previous
  service must become usable again, not merely have its files restored.
- Real WS requests and CLI requests through production validation, sudo, detached
  launching and `flock`. Only the destructive update body is replaced with a
  sleeping fixture; the real `box update quickbox --only-core` dispatcher remains.

The container adapter starts real Node directly under the unit's configured user
and group, without a `runuser` intermediary. Acceptance verifies the running
process identity in both the container and native systemd environments. It does
not emulate systemd or claim systemd lifecycle coverage. `--only-mutex` remains
available for a focused install-and-concurrency run.

## Probe and theme completion

WebSocket health probes read and validate the Upgrade response, including the
server's `Sec-WebSocket-Accept`, then close immediately. Successful open sockets
no longer consume the five-second deadline. The deadline remains enforced for a
stalled handshake. A transient HTTP 400 during nginx reload is retried within the
same deadline; authentication rejection and invalid Upgrade headers fail immediately.
Host/Origin, Basic credentials, provider cookies, TLS and both
Socket.IO paths remain checked. Session cookies with expiry zero remain usable;
expired cookies are rejected.

Theme selection returns after the synchronous file copy, marker update and nginx
reload succeed, without a fixed five-second pause. Deployment callers still run
the full post-activation health check. Sandbox tests cover both themes, reload
failure, handshake rejection, delayed/stalled responses and cookie selection.
After an upgrade, the updater permits retries of the complete health check within
a five-second activation window while nginx replaces its workers. A persistent
failure still rolls back; standalone health probes retain immediate authentication
failure verdicts.

## Native systemd acceptance

The standard Ubuntu VM job runs `run.py --systemd --phase install`, then
`--phase lifecycle`, then `--phase mutex`. It does not repeat Linux's transport,
baseline-upgrade and failure-recovery matrix. Finally it always invokes
`--phase cleanup`. `run.py --systemd` runs these same phases in one invocation
and cleans up automatically.

Assertions cover `User=www-data`, `PrivateTmp=yes`, `KillMode=process`, automatic
restart after killing Node, port collision and recovery, and an update surviving
a WS service restart with mutual exclusion and final state cleanup. A test
startup delay exercises readiness. Another drop-in shortens `RestartSec` without
changing the application's other lifecycle settings.

## Real authentication providers

```sh
npm ci --prefix e2e
(cd e2e && npx playwright install chromium)
bash tests/deployment/run-auth.sh
```

This uses real Authelia 4.39.28 and Vouch 0.50.0 containers. Authelia validates a
fixture file-backed account; Vouch completes an authorization-code exchange with
a local identity-provider fixture. Production auth migration and provider nginx
location snippets are used. No external accounts or secrets are required.

Playwright checks login, HTTP access, polling, WebSockets, anonymous rejection,
and tampered/expired cookies. The root health checker verifies backend HTTP,
polling and WebSockets plus nginx readiness, independently of login or cookie
state. It must also pass before login and after a session is tampered with.
The current root-page assertion checks only
that the body is nonempty; the separate Browser job runs
the full `e2e/tests` application interaction suite with its own mock server.

A separate WebKit Basic Auth regression starts fresh iPhone browser contexts at
`/`, `/ws`, `/ws/` and `/ws/?locale=zh`. It requires exactly one initial 401
challenge across page loading, API calls, refresh and three reconnects by counting
nginx responses, so automatic credential replies cannot hide repeated prompts.
The legacy page entry points redirect to `/` before authentication, preserving
queries and establishing the root credential scope before parallel API requests.
Basic-authenticated Apple WebKit clients keep Socket.IO on authenticated polling
because upgrading to WebSocket can trigger another authentication challenge.
Other clients and cookie-based providers retain WebSocket upgrades. The server's
WebSocket authentication remains enforced; credentials are never placed in page
runtime configuration.

A local CONNECT proxy preserves the fixture HTTPS origin and cookie domains
without editing `/etc/hosts`. Certificate verification is disabled only in test
contexts for the self-signed fixture certificate.

The local wrapper prepares and tears down its Compose project and fixture storage.
Set `QUICKBOX_AUTH_ARTIFACTS` to retain diagnostics, and
`QUICKBOX_AUTH_SKIP_BUILD=1` to reuse a prepared image. Rebuild it when production
sources change.

CI uses `run-auth.sh --prepare`, then `--provider basic`, `--provider authelia`
and `--provider vouch`, then always `--cleanup`. These commands require a stable
`QUICKBOX_AUTH_FIXTURES` directory and `QUICKBOX_AUTH_PROJECT` name across steps.
The fixture directory must start empty. Provider images are fetched in preparation;
starting the services does not pull images.

## Harness checks

```sh
python3 -m unittest discover -s tests/deployment -p 'test_*.py' -v
python3 tests/run.py
```

Python tooling (`flake8`, `pyright`, `prettytable` for the benchmark helpers) is
managed by uv; `Pipfile` is gone and `uv.lock` replaces `Pipfile.lock`:

```sh
uv sync                 # create .venv from uv.lock
uv run flake8           # every tracked .py in the repository
uv run pyright          # type-check, same rules Pylance applies in the editor
uv run flake8 tests/    # narrow to one subtree when iterating
```

`.python-version`, `pyproject.toml` and `pyrightconfig.json` pin 3.14 for the
repository tooling in `scripts/` and `tests/`. Scripts under `packages/system`
run on the target host instead: `installpackage-deluge` calls the same file with
`python2` or `python3` depending on the Deluge version, and `setup.sh` only
guarantees whichever single interpreter the distro ships. They are still part of
the type-check: the Python 2/3 shim uses a `sys.version_info` branch instead of
an undefined name, and `typings/deluge/config.pyi` declares the module the host
provides, so pyright covers these files without any suppression.

`.flake8` owns the lint scope: it excludes `.venv`, `node_modules`, `vendor`,
build outputs and tool caches, so a bare `uv run flake8` lints only project
sources and is what the `python-linter` job runs. The config carries no
`ignore`, no `per-file-ignores` and no `# noqa` markers — a new warning is
fixed at the source instead of being suppressed. `pyrightconfig.json` does the
same for type checking — Pylance reads that file too, so the editor and CI
cannot drift apart.

System tests use pytest and are grouped by responsibility under `tests`.
Python tests follow the repository-wide `.flake8` configuration, including the
120-character line limit.
The entry point runs tests directly on Linux and uses a disposable container on
other platforms. Direct pytest invocations also switch to Docker for system tests
on non-Linux hosts; selections entirely under `tests/lint` run on the host. The
runner builds `quickbox-system-tests:py3.14-pytest9.2` only when the image is
missing, then reuses it. The checkout is mounted read-only and each test run
removes its container. Set `QUICKBOX_SYSTEM_TEST_IMAGE` to use an existing
compatible image. Delete the cached image to rebuild it after changing the Dockerfile.

```sh
python3 tests/run.py
python3 tests/run.py tests/backups
python3 tests/run.py tests/backups/test_backup_retention.py::test_dry_run_removes_nothing
```

The Linux-specific tests in `tests/linux` cover GNU `getopt` and the
authentication lifecycle, which changes system paths. On Linux the latter runs
in a separate disposable container; on other platforms both run inside the test
container. The remaining tests use temporary paths and run directly on Linux.
Python tests invoke the production Bash scripts with temporary paths and controlled command stubs.

The deployment harness rejects later phases if their required install/upgrade
phase has not passed. The CI summary runner is `tests/deployment/report.py`.
