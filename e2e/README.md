# QuickBox Lite E2E Testing

## Continuous integration

After all lint checks pass, `Linter` calls the acceptance workflow, whose  
**Dashboard browser interactions** job runs this full suite with `npm test`.  
The job uses the local mock Node server and Chromium; it requires no Docker,  
nginx, application package installation or host service changes. Package actions  
only change mock state. It runs in parallel with deployment image preparation.  
Changes to tests, scripts or configuration under `e2e/` select acceptance.

The job summary records preparation and test durations. The  
`dashboard-panel-browser-report` artifact includes the HTML report, screenshots  
and any failure traces, retained for seven days.

The E2E suite runs Playwright and the mock Node dashboard on the host. The optional  
`npm run e2e` path also runs Nginx in Docker, so requests pass through the same  
`/ws` rewrite used by the deployed panel without copying the dashboard or database  
into containers.

## Prerequisites

- Node.js 24 and npm
- Docker Engine or Docker Desktop with `docker compose` only for `npm run e2e`
- Chromium installed for Playwright (`npx playwright install chromium`)
- Node dashboard dependencies installed from `setup/dashboard/ws`

Install dependencies once:

```sh
cd setup/dashboard/ws && npm ci
cd ../../../e2e && npm ci && npx playwright install chromium
```

## Run tests

From `e2e/`, `npm test` starts the mock Node dashboard on `127.0.0.1:8575` and runs Playwright directly against it. It does not require Docker.

`npm run e2e` starts the same Node mock server on the host, starts a temporary Nginx container, waits for Nginx to reach Node, runs the full Playwright suite, then stops only the Nginx Compose project and mock server it started. This path verifies the Nginx `/ws` rewrite and WebSocket proxy.

Use `npm run test:headed`, `npm run test:debug`, and `npm run test:report` for headed runs, debugging, and the HTML report.

## External targets and ports

Set `E2E_BASE_URL` to run Playwright against an existing target. The test runner then starts no local services and leaves them untouched. Set `WS_BASE_URL` if the WS/API path uses a different URL; otherwise it defaults to `${E2E_BASE_URL}/ws`.

The local defaults are Nginx at `127.0.0.1:8880` and the Node mock server at port `8575`. Set `E2E_PORT` or `TEST_WS_PORT` to change them. `MOCK_PROFILE` selects the initial profile; the tests can switch profiles through the test API.

During `npm run e2e`, the host Node process listens on `0.0.0.0:TEST_WS_PORT` so the Nginx container can reach it through `host.docker.internal`. Docker Compose maps that name with `host-gateway` for Linux engines; Docker Desktop provides the host name on macOS. The Node port is not published by Docker, but the host listener is reachable on host network interfaces while the test runs. The Nginx port is bound to loopback only. Plain `npm test` binds the Node server to loopback.

The current workflow does not read `e2e/.env.compose`.

## Test environment

The Node test server runs with `NODE_ENV=test`, `MOCK_ENABLED=1`, and `MOCK_PROFILE=partial-running` by default. It creates a temporary database directory with test user and interface seeds, uses the existing mock profiles for system information, and deletes that directory when it exits. Dashboard static assets are served directly from `setup/dashboard`; Nginx proxies requests to Node, including `/debug/assets/*` and Socket.IO.

Available profiles are defined in `../setup/dashboard/ws/src/testing/mock-profiles.ts`.

## Test suites

- `tests/dashboard.spec.ts`: page load, widgets, service badges, and screenshots
- `tests/dashboard-state.spec.ts`: PMC search/sort/pagination, layout and HTTP/WS ordering
- `tests/debug-console.spec.ts`: WS debug console and API checks
- `tests/header.spec.ts`: header controls at narrow viewports and long branch names
- `tests/interaction.spec.ts`: language switching, package UI, and service controls
- `tests/log-panel.spec.ts`: log viewer sizing and escaping
- `tests/running-task.spec.ts`: running-task banner, log view and abort
- `tests/side-panels.spec.ts`: right column card layout
- `tests/sidebar.spec.ts`: sidebar behaviour across breakpoints

Shared fixtures live in `tests/support/helpers.ts`. Every spec resets the mock  
profile in `beforeEach`, so no test depends on the profile a previously executed  
file left behind.

`npm run typecheck` runs `tsc --noEmit` over the specs and `playwright.config.ts`;  
CI runs it before the suite so a type regression fails the job instead of being  
transpiled away.
