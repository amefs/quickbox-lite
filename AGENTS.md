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
- `setup/dashboard/lang/`: dashboard JSON translations; `setup/lang/` contains shell installer translations.

## Conventions

- Follow nearby naming and formatting conventions; dashboard source files commonly use kebab-case names. The WebSocket service uses strict TypeScript, ES modules, React JSX, and four-space indentation; its ESLint and TypeScript configurations are authoritative.
- Prefer explicit types for exported interfaces and asynchronous operations, and avoid unnecessary `any`. Use PascalCase for types and components and camelCase for functions and variables.
- Preserve existing SPDX license headers and use the appropriate `GPL-3.0-or-later` header for new source files where consistent with the surrounding code.
- Keep service and package definitions consistent with their consumers, including `setup/dashboard/ws/config/packages.json` when package behavior changes.
- Update relevant documentation and translations when behavior or user-facing text changes. Add or update tests when they are needed to cover changed behavior.
- Shell scripts can affect real services and installations; inspect existing lifecycle and rollback behavior before changing them. Use the sandbox or deployment tests appropriate to the change.

## Task execution

- Identify the requested outcome and the actual execution path before changing code. Use the command, entry point, environment, and failure details provided by the user; do not substitute a nearby workflow or infer a different problem.
- Keep changes limited to what is needed for the requested outcome. Check real callers and existing behavior before making optional robustness or consistency changes. Explain a proposed extra change when it is not required to meet the request.
- Preserve existing behavior, comments, and error reporting unless the task requires changing them. Write comments to describe current behavior or constraints, not the history or rationale for a change.
- For operational flows such as updates, installs, and rollbacks, inspect the full lifecycle before editing. Keep recovery behavior consistent with the requested user workflow; when retrying the original operation is the intended recovery path, make that operation safely repeatable instead of adding a separate recovery command.
- Treat authorization for commits, pushes, history rewrites, and deployments as specific to the stated branch, change, and conditions. Do not extend approval for one operation to a different operation.

## Failure analysis and verification

- When a pipeline or test fails, identify the exact run, commit, job, step, and diagnostic before proposing a fix. Separate workflow setup failures, test or fixture failures, product failures, environment limits, and external status checks; do not describe one category as another.
- Make tests follow the real invocation path and assert the user-visible or system-level result. Keep test and mock conventions consistent with existing code, and change production behavior as well as tests when the defect is in the application.
- Run the checks relevant to the changed behavior and report what passed, what failed, what was skipped, and what was not run. Do not claim a pipeline or end-to-end flow passed based only on a local partial check.
- Reuse the repository's Docker test image and temporary-container workflow on non-Linux hosts. Avoid rebuilding images without a relevant input change, retain reusable images, and remove only disposable test containers or artifacts created for the run.

## Assumptions and evidence

- Identify the assumptions behind a diagnosis before relying on them. Verify them against the actual invocation, runtime state, configuration, and available logs; label unverified assumptions as hypotheses.
- Trace the relevant operation through its system boundaries to find where behavior changes or fails. Keep adjacent layers distinct, and test the layer named by the request.
- Compare environments by the differences that can affect the result. Do not treat development, CI, containers, fixtures, and deployed systems as equivalent without checking their relevant state and inputs.
- Distinguish the operation's result from recovery, cleanup, and observation. A successful intermediate step does not prove end-to-end success, and missing evidence does not prove a particular cause.
- Confirm that evidence corresponds to the code and state being discussed. Source, generated output, cached artifacts, fixtures, and deployed versions can differ; state which one each check covers.

## Verification

Run the checks relevant to the files changed. Node-based dashboard and E2E workflows use Node.js 24. Install dependencies in the relevant directory when needed; see the E2E README for browser and Docker prerequisites.

From `setup/dashboard/ws/`:

```sh
npm run lint       # TypeScript and ESLint
npm test           # Mocha
npm run build      # Vite builds the files in dist/
```

The dashboard build artifacts in `setup/dashboard/ws/dist/` are tracked; rebuild them when source changes affect the bundle and include all updated artifacts. CI checks that they match the sources. Development commands are `npm run dev:server`, `npm run dev:client`, and `npm run dev:dashboard`.

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
