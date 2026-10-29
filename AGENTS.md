# QuickBox Lite repository guidance

QuickBox Lite is a GPL-3.0-or-later project combining Bash system and package management scripts, a Node.js/TypeScript dashboard, React widgets, and automated tests. Follow the conventions of the files being changed and keep changes focused on the affected module.

## Repository map

- `onekey.sh`, `setup.sh`: installation entry points.
- `packages/package/{install,remove,update}/`: service lifecycle scripts; see `packages/package/README.md`.
- `packages/system/`: system commands, update logic, and auxiliary scripts.
- `setup/dashboard/`: dashboard assets, client JavaScript, and translations.
- `setup/dashboard/ws/`: Node dashboard and WebSocket service. `src/server.tsx` is the entry point; `src/widgets/`, `src/handlers/`, `src/controllers/`, `src/utils/`, and `config/` contain the application. Tests are in `tests/`.
- `e2e/`: Playwright dashboard tests; see `e2e/README.md`.
- `tests/` and `scripts/`: system and deployment tests, repository checks, and development tooling. See `tests/deployment/README.md` for deployment tests.
- `setup/dashboard/lang/`: dashboard JSON translations managed by `localazy.json`; `setup/lang/` contains shell installer translations.

## Conventions

- Follow nearby naming and formatting conventions; dashboard source files commonly use kebab-case names. The WebSocket service uses strict TypeScript, ES modules, React JSX, and four-space indentation; its ESLint and TypeScript configurations are authoritative.
- Prefer explicit types for exported interfaces and asynchronous operations, and avoid unnecessary `any`. Use PascalCase for types and components and camelCase for functions and variables.
- Preserve existing SPDX license headers and use the appropriate `GPL-3.0-or-later` header for new source files where consistent with the surrounding code.
- Keep service and package definitions consistent with their consumers, including `setup/dashboard/ws/config/packages.json` when package behavior changes.
- Update relevant documentation and translations when behavior or user-facing text changes. Add or update tests when they are needed to cover changed behavior.
- Shell scripts can affect real services and installations; inspect existing lifecycle and rollback behavior before changing them. Use the sandbox or deployment tests appropriate to the change.

## Verification

Run the checks relevant to the files changed. Node-based dashboard and E2E workflows use Node.js 24. Install dependencies in the relevant directory when needed; see the E2E README for browser and Docker prerequisites.

From `setup/dashboard/ws/`:

```sh
npm run lint       # TypeScript and ESLint
npm test           # Mocha
npm run build      # Vite builds dist/server.js
```

The dashboard bundle `setup/dashboard/ws/dist/server.js` is tracked; rebuild it when source changes affect the bundle and include the updated artifact. CI checks that it matches the sources. Development commands are `npm run dev:server`, `npm run dev:client`, and `npm run dev:dashboard`.

From `setup/dashboard/`, run `npm run lint` for dashboard JavaScript.

From `e2e/`, run `npm run typecheck` and `npm test` for Playwright against the host mock server. `npm run e2e` also exercises the Nginx proxy in Docker; `npm run test:headed` runs interactively. Reports are written to `e2e/playwright-report/`.

From the repository root, relevant shell and Python checks include:

```sh
bash scripts/check-system-script-syntax.sh
python3 scripts/lint-package-scripts.py
python3 scripts/lint-repo-files.py
uv run --locked flake8
uv run --locked pyright
uv run --locked pytest -q tests/lint
```

For system tests, select the relevant `tests/` directory. Run `python3 tests/run.py <path>` or `uv run --locked pytest <path>`: Linux runs locally, while other platforms automatically run system tests in Docker. Tests selected only under `tests/lint/` run on the host. Refer to `.github/workflows/linter.yml` and the test documentation for the current CI checks and prerequisites.
