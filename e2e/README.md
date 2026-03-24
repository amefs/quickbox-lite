# QuickBox Lite E2E Testing

Docker-based end-to-end tests for the PHP dashboard and WebSocket server.

## Overview

The E2E stack is started by Docker Compose and includes:

| Service | Role |
|---------|------|
| `nginx` | Serves the dashboard, static assets, and proxies `/ws` |
| `php` | Runs the PHP dashboard against seeded test data |
| `ws` | Runs the dashboard WebSocket server in mock mode |
| `dashboard-init` | Seeds an install-like dashboard volume before tests |
| `playwright` | Optional containerized Playwright runner |

The default mock profile is `partial-running`: some apps are installed, some are running, some are stopped, and `qbittorrent` is included.

## Prerequisites

- Docker Desktop or Docker Engine with `docker compose`
- Node.js 18+
- npm

## Recommended Workflow

From `e2e/`:

```bash
npm install
npx playwright install chromium
npm run e2e
```

`npm run e2e` does the full cycle:

1. Starts the Docker test stack
2. Waits for the mock dashboard to become ready
3. Runs Playwright against `http://127.0.0.1:8880`
4. Tears the stack down with `docker compose down -v`

This is the default path. Do not manually pre-install WS dependencies or manually prepare the dashboard volume.

## Useful Commands

Run tests without teardown management:

```bash
npm test
```

Start the stack for local debugging:

```bash
npm run docker:up
```

Stop and remove the stack:

```bash
npm run docker:down
```

Follow logs while debugging:

```bash
npm run docker:logs
```

Run Playwright inside Docker:

```bash
npm run e2e:docker
```

## Environment Behavior

The Docker environment is intentionally install-like rather than blank:

- dashboard files are copied into a writable volume before startup
- theme assets are seeded so CSS loads correctly
- database files such as `master.txt`, `interface.txt`, and `locale.php` are pre-created
- install lock files are seeded to simulate a partially installed system
- WS mock data provides CPU, memory, disk, network, vnstat, package, and service state

Tests may switch mock profiles at runtime through the WS test API, but this is handled by the test suite and usually does not need manual intervention.

Available profiles are defined in `../setup/dashboard/ws/src/testing/mockProfiles.ts`.

## Test Suites

- `tests/dashboard.spec.ts`: page load, widgets, service badges, screenshots
- `tests/interaction.spec.ts`: language switching, package UI, service controls
- `tests/debug-console.spec.ts`: WS debug console and API checks

## File Layout

```text
e2e/
├── docker-compose.yml
├── package.json
├── playwright.config.ts
├── docker/
│   ├── Dockerfile.php
│   ├── nginx.conf
│   ├── php-entrypoint.sh
│   └── mock/
└── tests/
    ├── dashboard.spec.ts
    ├── debug-console.spec.ts
    └── interaction.spec.ts
```
