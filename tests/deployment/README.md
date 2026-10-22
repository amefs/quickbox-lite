# Dashboard deployment acceptance

These suites mutate `/srv`, `/etc/nginx`, `/etc/quickbox`, `/install` and managed
service files. Run them only in their disposable container or a fresh CI VM.
They never mount the host's deployment directories or Docker socket.

## Local Linux acceptance

```sh
bash tests/deployment/run-linux.sh
```

Requires Docker with BuildKit named contexts, Git, and the pinned baseline commit
`e0b522b8ccced7a07d0ae9cb575c052af6054d7e`. The wrapper exports that commit from
Git, builds the current production bundle with Node 22, and starts a disposable
Debian container. No ports are published. Package installation happens in the
image, not on the host. Set `QUICKBOX_TEST_BASELINE` to explicitly test a different
available commit.

For subsequent runs with unchanged dependency locks:

```sh
QUICKBOX_DEPLOYMENT_SKIP_BUILD=1 bash tests/deployment/run-linux.sh
```

This mounts the checkout read-only, checks both dependency locks against the
image, copies current code and the selected baseline into the disposable
container, and rebuilds the current bundle there. Lock changes explicitly fail
and require an image rebuild. This also avoids generating another image layer
for each source edit.

The suite executes the actual Dashboard installation body after preinstalling
its nginx/Node prerequisites. It then starts the pinned old runtime, dependencies,
nginx template and service unit, performs a first upgrade, and repeats the upgrade.
It checks:

- Production HTTP and both Socket.IO paths through real nginx; IPv4, IPv6, TLS,
  polling and direct WebSocket handshakes.
- Real root/www-data ownership, read/write restrictions, `visudo`, allowed sudo
  execution and denial of a command outside the managed authorization.
- Preservation of keys and custom proxy directives on repeated upgrades.
- Injected npm, restart, nginx test/reload and health failures. Commands return
  failures at controlled boundaries. Candidate bundles deliberately differ from
  the live bundle, and old vhost bytes must be restored; recovery must restore files **and** make
  the real previous service usable again.
- Two real WS update requests and a concurrent CLI request using production
  command validation, sudo, detached launcher and real core/runner `flock` locks.
  Only the destructive update body is replaced with a sleeping fixture; the actual
  `box update quickbox --only-core` dispatcher remains in the path.

The container adapter starts real Node processes under the unit's configured
user. It does **not** claim to validate systemd. It accepts only the Dashboard
service, and its adapter results are labeled separately.

## Native systemd acceptance

`.github/workflows/deployment.yml` has a separate standard Ubuntu VM job, with no
job-level container. It runs the same deployment suite with `--systemd`, replacing
the process adapter with real systemctl calls. Additional assertions cover:

- `User=www-data`, `PrivateTmp=yes`, and `KillMode=process` on the active unit.
- A killed Node process restarts automatically.
- An occupied Node port causes startup failure; releasing it permits recovery.
- A detached update survives a restart of the WS systemd service and retains
  mutual exclusion and final state cleanup.

A test drop-in shortens `RestartSec` to avoid waiting 42 seconds in every failure
case; the application unit's other lifecycle settings are unchanged. The full
Seedbox installer, distribution package-upgrade behavior and reboot are outside
this Dashboard-specific suite. Production release verification must retain those
boundaries rather than describing this as a full machine installation test.

## Real authentication providers

Install the existing browser runner once, then run:

```sh
npm ci --prefix e2e
(cd e2e && npx playwright install chromium)
bash tests/deployment/run-auth.sh
```

This uses real Authelia 4.39.28 and Vouch 0.50.0 containers. Authelia validates a
fixture file-backed account; Vouch completes an authorization-code exchange with
a small local identity-provider fixture. No external accounts or secrets are
required. Production auth migration and provider nginx location snippets are used.

Playwright checks real login, HTTP/widget access, polling, WebSockets, rejected
anonymous connections, and invalid/expired cookies. Valid and corrupted provider
cookies are also passed to the actual root health checker. The test-only IdP and
provider switch control files are not application features.

Only fixture TLS port 18443 is published, bound to host loopback. A local CONNECT
proxy forwards that one fixture authority so browser origins and cookie domains
remain real without editing the host's `/etc/hosts`. The TLS certificate is
self-signed; certificate verification is disabled only for these test contexts.

The wrapper tears down its Compose project and fixture storage on exit. Set
`QUICKBOX_AUTH_ARTIFACTS` to retain failure screenshots. After a successful image
build, `QUICKBOX_AUTH_SKIP_BUILD=1` allows rerunning browser fixtures without a
rebuild; rebuild whenever production sources change.

## CI and evidence

Pull requests affecting deployment, auth, templates or these tests run three
jobs: Linux container, native systemd VM, and authentication providers. Failures
retain service diagnostics or browser screenshots. None of these jobs uses
`NODE_ENV=test` for the deployed Dashboard or disables gateway/Origin checks.

The existing fast unit, browser and shell-sandbox suites remain useful and run
separately. This matrix supplements them with operating-system and deployment
behavior; it does not replace them with a single large end-to-end test.
