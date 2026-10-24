# Dashboard deployment acceptance

The acceptance workflow separates environment preparation from application checks.
The shared image is built once per run, then reused by Linux and authentication
jobs. The native systemd job receives the same npm cache and compiled bundle.
The existing Linter workflow owns the full WS unit suite; deployment acceptance
does not repeat it.

The Linux, systemd and authentication suites mutate `/srv`, `/etc/nginx`, `/etc/quickbox`, `/install` and managed
service files. Run them only in their disposable container or a fresh CI VM.
They never mount the host's deployment directories or Docker socket.

## CI stages and reports

The `Linter` workflow is the entry point. Its TypeScript/unit, JavaScript, shell,
package-script and Python checks must all pass before it calls this reusable
acceptance workflow. Both workflows use the same triggering commit, including
the same merge commit for a pull request. Acceptance is selected for pull requests
that change application/deployment/test paths or the CI definitions. Push events
run lint without also repeating acceptance. To run manually, select `Linter` in
Actions and use **Run workflow**; this runs lint followed by acceptance.

`.github/workflows/deployment.yml` exposes these groups as individual steps:

| Job | Application checks |
| --- | --- |
| Update and recovery sandboxes | Node runtime policy; staging/gateway/health/update; backup/configuration restore; repository revert/reinstall; progress/arguments |
| Dashboard browser interactions | Page rendering; widgets and WS data; PMC state and mock actions; locale; debug console; error dialogs |
| Prepare application image and offline dependencies | System tools; current and pinned baseline production dependencies; verified bundle; offline installation proof; reusable artifacts |
| Linux application deployment | Fresh install/permissions/sudo; HTTP/TLS/Socket.IO; baseline/repeated upgrade; five injected failures and rollback; WS/CLI mutual exclusion |
| Native systemd lifecycle | Real deployment; unit settings/automatic restart/port recovery; detached update across a WS service restart |
| Application authentication | Basic Auth; Authelia; Vouch, each with its own step |

Each acceptance job writes a summary with passed, failed and skipped stages and
per-stage durations. Details such as sandbox scripts and rollback failure types
are grouped in the logs. Independent sandbox groups continue after a failure;
stateful deployment and authentication steps stop after a failure. Cleanup and
summary steps always run. Failures retain Linux/service logs or authentication
Compose logs and browser screenshots.

The browser interaction job starts alongside the sandboxes and image preparation
after lint passes. It runs the full `e2e/tests` Playwright suite against the local
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
It uses the committed bundle already rebuilt and verified by Linter, so it does
not install the WS development toolchain or repeat the bundle build.
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

The CI Linter checks that the committed bundle matches the sources. No ports are
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
and tampered/expired cookies. Valid and corrupted provider cookies are also sent
to the actual root health checker. The current root-page assertion checks only
that the body is nonempty; the separate Dashboard browser interactions job runs
the full `e2e/tests` application interaction suite with its own mock server.

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
bash tests/system/run-dashboard-sandboxes.sh
```

The sandbox wrapper also accepts `runtime`, `dashboard`, `backups`, `repository`
or `progress` to run one group. All sandbox mutations stay in temporary paths.
The deployment harness rejects later phases if their required install/upgrade
phase has not passed. The CI summary runner is `tests/deployment/report.py`.
