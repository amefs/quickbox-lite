# Dashboard deployment acceptance

The acceptance workflow separates environment preparation from application checks.
The shared image is built once per run, then reused by Linux and authentication
jobs. The native systemd job receives the same npm cache and compiled bundle.
The existing Linter workflow owns the full WS unit suite; deployment acceptance
does not repeat it.

These suites mutate `/srv`, `/etc/nginx`, `/etc/quickbox`, `/install` and managed
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
| Prepare application image and offline dependencies | System tools; current and pinned baseline dependencies; bundle build; offline installation proof; reusable artifacts |
| Linux application deployment | Fresh install/permissions/sudo; HTTP/TLS/Socket.IO; baseline/repeated upgrade; five injected failures and rollback; WS/CLI mutual exclusion |
| Native systemd lifecycle | Real deployment; unit settings/automatic restart/port recovery; detached update across a WS service restart |
| Application authentication | Basic Auth; Authelia; Vouch, each with its own step |

Each acceptance job writes a summary with passed, failed and skipped stages and
per-stage durations. Details such as sandbox scripts and rollback failure types
are grouped in the logs. Independent sandbox groups continue after a failure;
stateful deployment and authentication steps stop after a failure. Cleanup and
summary steps always run. Failures retain Linux/service logs or authentication
Compose logs and browser screenshots.

## External dependencies

Network access is allowed during preparation: pulling the Node 24 and provider
images, installing system packages, downloading locked npm dependencies, and
installing Chromium. Docker build layers and Chromium/npm downloads are cached.
The shared image includes both the current and fixed baseline npm dependencies.
CI transfers the image as an artifact rather than rebuilding it in each consumer.

Application installation and upgrade still run the real production `npm ci`.
The test environment sets `npm_config_offline=true`, disables audit/fund requests,
and uses the cache prepared earlier. A missing package fails the check; there is
no online fallback. The image build proves that current production dependencies
can be installed offline. Native systemd preparation also installs the current
WS dependencies offline from the transferred cache, without repeating the bundle
build or fetching baseline dependencies it does not use.

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
Git, builds the current production bundle with Node 24, and starts a disposable
Debian container. No ports are published. Set `QUICKBOX_TEST_BASELINE` to test a
different available commit.

For subsequent runs with unchanged dependency locks:

```sh
QUICKBOX_DEPLOYMENT_SKIP_BUILD=1 bash tests/deployment/run-linux.sh
```

This mounts the checkout read-only, checks both locks against the image, copies
current code and the selected baseline into the container, and rebuilds the
bundle there. Lock changes fail and require an image rebuild. Set
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

The container adapter starts real Node under the unit's configured user. It does
not emulate systemd or claim systemd lifecycle coverage. `--only-mutex` remains
available for a focused install-and-concurrency run.

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
that the body is nonempty; the full `e2e/tests` application interaction suite is
separate and uses its own mock server.

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
