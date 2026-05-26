## Context

The current dashboard implementation lives under `setup/dashboard` with overlapping responsibilities:

- `setup/dashboard/ws` is a Node/TypeScript service that creates the Express app, Socket.IO servers, REST endpoints, and full dashboard HTML via React SSR.
- `setup/dashboard/ws/src/dashboard-page.tsx` renders the full document and wires browser libraries from `/lib`, `/js`, `/skins`, `/img`, `/fonts`, and `/lang`.
- `setup/dashboard/ws/src/router.tsx` serves both browser routes and backend routes such as `/node/*`, `/db/output.log`, `/debug/*`, and `/test/*`.
- `setup/dashboard/ws/src/handlers/message.ts` resolves Socket.IO widget requests to HTML fragments or JSON objects.
- `setup/dashboard/ws/config` contains runtime JSON config such as commands, packages, downloads, and menu data.
- `setup/dashboard/ws/src/shared`, `setup/dashboard/ws/src/vendor/i18n`, and `setup/dashboard/ws/src/testing` contain code that must be assigned explicit ownership during the split.
- `setup/dashboard/ws/scripts` contains dev-client/dev-server scripts and tests currently cover the dev-server behavior.
- Theme selection already exists through `/node/theme`, which runs `themeSelect-defaulted` or `themeSelect-smoked`; the CSS files are compiled assets with manual edits and are not a target for cleanup in this migration.

The desired end state is a dashboard root with two explicit projects and one active runtime:

- `setup/dashboard/frontend`: React/browser application and frontend build.
- `setup/dashboard/backend`: Node service, REST API, Socket.IO, command adapters, backend config, and backend tests.
- `setup/dashboard/shared`: narrow cross-project TypeScript API/runtime types and pure helpers only when both projects import them.

## Goals / Non-Goals

**Goals:**

- Split the dashboard into frontend and backend projects and make that split implementation the single working dashboard runtime.
- Make the frontend project the owner of the React app shell, browser entrypoint, client runtime config, and frontend tests.
- Make the backend project the owner of Express routes, Socket.IO handlers, system command execution, config loading, and backend tests.
- Assign `config`, `vendor/i18n`, `testing`, `scripts`, and shared modules to explicit locations before implementation work proceeds.
- Define the frontend/backend API contract for runtime config, REST responses, Socket.IO payloads, widget output, locale behavior, and command actions before moving the app shell.
- Use dashboard-level package/workspace orchestration so frontend/backend dependency and script ownership is clear.
- Keep current static assets available as part of the split dashboard at their existing public paths.
- Preserve theme switching with the existing `defaulted` and `smoked` assets without editing or regenerating their CSS.
- Compare the split implementation against the current SSR implementation before replacing service/template entrypoints, using dashboard-local tests that run on Windows.

**Non-Goals:**

- No redesign of the dashboard UI.
- No conversion of Bootstrap/jQuery/DataTables/Lobipanel behavior into React-native components in this change unless the split requires it.
- No theme CSS rewrite, minification cleanup, charset normalization, or visual restyling.
- No change to dashboard authentication policy, command semantics, or external package/plugin management behavior.
- No long-term parallel runtime, adapter layer, or alternate legacy entrypoint after the split is complete.

### Use npm workspaces for dashboard project orchestration

Use `setup/dashboard/package.json` as the workspace root for `frontend`, `backend`, and `shared` if shared code is extracted. Keep package-specific dependencies in the owning project and expose root scripts for build, type-check, lint, test, and dev/test startup.

Rationale: split packages need independent dependency ownership, but developers need one dashboard-level command surface. npm workspaces fit the existing npm/package-lock workflow without introducing a new package manager.

Alternative considered: maintain unrelated `package.json` files with no workspace relationship. That avoids root package changes but makes dependency updates and verification commands more error-prone.

### Choose build tools before moving code

Use Vite for the frontend because it gives the React app a browser-first build/dev boundary. Keep the backend close to the current Node service tooling: TypeScript, tsx for tests/dev, Mocha, supertest, and a production build that still emits a service-friendly backend entrypoint.

Rationale: the split is specifically intended to make the React side more natural while limiting backend churn. Tooling must be decided before `frontend` and `backend` package scaffolds are created.

Alternative considered: use webpack for both projects. That minimizes new dependencies, but it keeps the frontend shaped by the server-era build approach.

### Assign shared, config, vendor, testing, and scripts explicitly

Use these ownership rules:

- `backend` owns runtime JSON config from `ws/config` because commands, packages, downloads, menu resolution, and service state are backend/runtime concerns.
- `backend` owns `vendor/i18n` initially because current locale rendering and widget/server output depend on it.
- `frontend` receives locale/runtime data through the boot runtime config, static `lang` assets, and backend endpoints; it does not import backend i18n internals.
- `shared` contains only cross-project TypeScript API/runtime types and pure helpers that are imported by both frontend and backend.
- `backend/tests` owns test bootstrap, mock adapter/profiles, and server-side test helpers from `ws/src/testing`.
- `backend/scripts` owns backend/dev-server scripts, while frontend dev scripts live under `frontend`; dashboard root scripts orchestrate both.

Rationale: the current `ws` layout hides ownership boundaries. Assigning these directories before migration prevents frontend and backend from importing through each other's source trees.

Alternative considered: copy shared-looking files into both projects. That creates drift and obscures the API contract between the projects.

## Decisions

### Create sibling projects under `setup/dashboard`

Create `setup/dashboard/frontend` and `setup/dashboard/backend` as sibling projects instead of retaining `ws` as an active project.

Rationale: the dashboard root already owns static assets and install/runtime templates refer to `/srv/dashboard`. Sibling projects make ownership explicit while allowing frontend and backend tooling to evolve independently.

Alternative considered: keep `ws` active and layer the new projects beside it. That would lower short-term risk, but it creates a parallel runtime this change should avoid.

### Keep public user behavior stable while changing implementation ownership

The backend must expose the dashboard surface needed for the product to remain usable:

- `/` and `/ws` load the dashboard through nginx and the backend.
- `/socket.io` and `/ws/socket.io` support the dashboard's realtime widget updates.
- `/node/*`, `/db/output.log`, `/debug/*`, and `/test/*` provide the backend behavior currently used by the dashboard and tests.
- Static assets are served from `/skins`, `/lib`, `/fonts`, `/img`, `/js`, and `/lang`.

Rationale: splitting the projects should not make the dashboard unusable or force unrelated nginx/test churn. These routes are treated as the active dashboard API surface.

Alternative considered: introduce a new `/api/*` route namespace as part of the split. That can be done later, but adding it now combines project separation with an API migration that is not necessary for a functional split.

### Frontend/backend contract is defined before moving the app shell

Define the contract before moving implementation files:

- boot runtime config: base path, locale, selected message labels, theme list, language list, asset roots, and endpoint/socket paths,
- REST response shapes for dashboard config, system static data, theme action, plugin action, output log, and widget endpoints that return JSON,
- Socket.IO message payload and response envelope, including request id, path name, success flag, error message, and response payload,
- HTML widget output boundaries that remain backend-rendered during this split,
- route and validation behavior for invalid command, plugin, theme, locale, and widget requests.

Rationale: moving the React shell before the contract exists risks accidental imports from backend internals and unclear ownership of data fetching.

Alternative considered: infer the contract from migrated code after moving files. That is faster initially but leaves frontend/backend coupling undocumented.

### Frontend owns the app shell; backend owns data and command-backed rendering

Move the document/app shell and browser initialization from `dashboard-page.tsx` into the frontend project. Backend APIs and Socket.IO handlers remain responsible for system data, command-backed operations, and any server-rendered widget output that is still part of the current feature set.

Rationale: the key architectural correction is ownership. The frontend should no longer be authored inside the backend service, and backend modules should no longer own the browser document. Returning HTML for current widgets can remain an active backend feature if the frontend consumes it directly.

Alternative considered: convert every widget endpoint to typed JSON and React rendering in the same change. That is a larger frontend rewrite and is not required to make the split dashboard functional.

### Treat static assets as dashboard assets, not generated frontend code

Keep `lib`, `js`, `skins`, `img`, `fonts`, and `lang` at dashboard root and serve/reference them from the split runtime. The frontend build must not bundle or rewrite the two theme CSS files in this change.

Rationale: the CSS is effectively precompiled and hand-edited. Serving it as dashboard-owned static content preserves the real visual source of truth while frontend/backend ownership is corrected.

Alternative considered: import theme CSS into the frontend build. That makes the frontend package look tidier, but it risks changing URL resolution, font/image paths, ordering, and hand-edited CSS behavior.

### Verify with dashboard-local tests before switching

The repository-level Playwright e2e suite is not usable on Windows, so it must not be the migration gate. Implementation must first run the current `ws` implementation and the new frontend/backend implementation through dashboard-local checks derived from `setup/dashboard/ws/tests`, then compare:

- supertest route coverage for `/`, `/ws`, `/set`, `/node/*`, `/db/output.log`, `/debug/*`, and `/test/*`,
- dashboard shell HTML contract assertions for title, runtime config, locale, core panel IDs, widget containers, modal IDs, script order, and static asset references,
- controller tests for dashboard config, system static data, output log, theme, plugin, and removal modal routes,
- Socket.IO handler tests for message payload validation, locale handling, widget resolution, and unknown route rejection,
- widget tests for menu, service status/control, package management center, bandwidth tables, disk, memory, load, network status, output log, removal modals, and uptime,
- dev-server script tests for the split dashboard proxy/server configuration,
- static asset and theme route checks for `/skins`, `/lib`, `/fonts`, `/img`, `/js`, and `/lang`.

After those checks pass for both the old reference implementation and the split implementation, service templates, nginx templates, package scripts, and install/update references must point to the split implementation. The old `ws` implementation remains in the repository only as a comparison baseline; it must not remain an active runtime, alternate entrypoint, or deployment target.

Rationale: the request requires checking the two rendered experiences before migration completion, and dashboard-local tests are the reliable verification surface available on Windows.

Alternative considered: keep relying on the repository e2e suite. That is not acceptable as the primary gate because it is not usable on Windows for this work.

## Risks / Trade-offs

- Server-rendered widget HTML remains in backend routes -> Accept it as current backend behavior for this split; replace it with typed JSON in a later feature migration if needed.
- Shared code can become a dumping ground -> Restrict `shared` to imported-by-both API/runtime types and pure helpers; backend-only config/i18n/testing code stays in backend.
- Config ownership can leak backend internals into the frontend -> Frontend consumes config through runtime JSON or backend endpoints only.
- Browser libraries depend on global load order -> Preserve the required script order as part of the frontend entry until those libraries are deliberately removed.
- Static asset paths can break after moving React code -> Keep root public paths stable and add tests for representative CSS, JS, font, image, language, and theme assets.
- Theme switching may appear successful while serving stale CSS -> Verify both `/skins/quick.css` resolution and the theme action flow after switching themes.
- Two projects can duplicate package metadata or tooling -> Use npm workspaces and dashboard-level scripts that orchestrate frontend/backend build, type-check, lint, and tests.
- SSR and client rendering can diverge -> Compare deterministic HTML contracts, runtime config, core DOM IDs/classes, locale text, script order, and widget route output before switching templates.

## Migration Plan

1. Inventory current `ws` modules into backend-owned, frontend-owned, shared, static-asset, script, config, vendor, and test-only groups.
2. Decide and record workspace/build tooling, dependency ownership, shared module boundaries, config ownership, i18n ownership, testing ownership, and script ownership.
3. Define the frontend/backend runtime and API contract for boot config, locale, widget updates, REST endpoints, Socket.IO payloads, command actions, and validation errors.
4. Scaffold `setup/dashboard/backend` from backend runtime code while leaving `ws` untouched as the reference implementation during construction.
5. Scaffold `setup/dashboard/frontend` from the dashboard document/app shell and browser runtime.
6. Run backend unit/controller/widget tests against the new backend without changing service templates yet.
7. Run frontend checks and dashboard-local route/render tests against the new frontend/backend pair on an isolated dev/test entrypoint.
8. Compare current and new dashboard rendering with deterministic HTML contract assertions, route responses, widget outputs, and theme route/action checks.
9. Switch package scripts, service templates, nginx templates, and install/update references to the new backend/frontend outputs.
10. Keep the old `setup/dashboard/ws` runtime as a comparison baseline only once the split runtime passes final verification, with no active runtime or deployment references starting from it.

## Open Questions

- None. Implementation should follow the decisions above unless a discovered constraint makes one of them impossible.
