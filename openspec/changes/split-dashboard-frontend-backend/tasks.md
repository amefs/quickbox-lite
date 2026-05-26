## 1. Baseline Inventory And Decisions

- [x] 1.1 Map current `setup/dashboard/ws/src`, `ws/config`, `ws/scripts`, `ws/src/vendor`, `ws/src/testing`, and `ws/tests` files into backend-owned, frontend-owned, shared, static-asset, script, config, vendor, and test-only groups.
- [x] 1.2 Record current public routes, Socket.IO paths, static asset paths, dashboard shell HTML contract, and response contracts covered by `setup/dashboard/ws/tests`.
- [x] 1.3 Confirm dashboard package strategy: npm workspaces rooted at `setup/dashboard` with `frontend`, `backend`, and `shared` when shared code is extracted.
- [x] 1.4 Confirm build tooling before scaffolding: Vite for `frontend`; current TypeScript/tsx/Mocha/supertest and service-friendly production build approach for `backend`.
- [x] 1.5 Define dependency ownership rules for shared dependencies such as React, lodash, Socket.IO, test libraries, and browser-only static libraries.
- [x] 1.6 Define shared module rules: only cross-project API/runtime types and pure helpers go under `setup/dashboard/shared`.
- [x] 1.7 Define config and vendor ownership: `ws/config` and `vendor/i18n` move under `backend`; frontend consumes locale/runtime data through boot config, static `lang` assets, and backend endpoints.
- [x] 1.8 Define the frontend/backend API contract for boot runtime config, REST response shapes, Socket.IO message envelopes, widget output, locale behavior, command actions, and validation errors.
- [x] 1.9 Run the current `ws` implementation tests on Windows and record the passing baseline for build, type-check, router, controller, handler, widget, script, and dev-server tests.
- [x] 1.10 Add any missing baseline assertions needed for theme option rendering, `/node/theme` command validation, static asset route resolution, and dashboard shell script order before changing runtime entrypoints.

## 2. Workspace And Shared Setup

- [x] 2.1 Update `setup/dashboard/package.json` and lockfile for npm workspace orchestration without changing runtime entrypoints.
- [x] 2.2 Add dashboard-level scripts for workspace build, type-check, lint, tests, and isolated dev/test startup.
- [x] 2.3 Create `setup/dashboard/shared` only if at least one type/helper is imported by both frontend and backend.
- [x] 2.4 Move or create shared API/runtime types for frontend boot config, REST responses, Socket.IO messages, widget payloads, and action results.
- [x] 2.5 Add type-check coverage that proves `frontend` and `backend` import shared types from `shared` instead of each other's source trees.

## 3. Backend Project

- [x] 3.1 Create `setup/dashboard/backend` package, TypeScript config, lint config, build config, and test scripts based on the decided backend tooling.
- [x] 3.2 Copy backend runtime modules from `ws` into `backend` without deleting or modifying the old `ws` implementation during construction.
- [x] 3.3 Reorganize copied backend files inside `backend`; do not delete source files from `ws` in this step.
- [x] 3.4 Move Express app creation, static asset serving, REST routes, debug/test routes, and command-backed controller logic into `backend`.
- [x] 3.5 Move Socket.IO setup and handlers into `backend`, keeping `/socket.io` and `/ws/socket.io` working for the split runtime.
- [x] 3.6 Move `ws/config/*.json` into backend-owned runtime config paths and update readers/tests accordingly.
- [x] 3.7 Move `vendor/i18n` into backend-owned source and expose only runtime locale data needed by the frontend contract.
- [x] 3.8 Move `src/testing` bootstrap, mock adapter/profiles, and server-side test helpers into backend-owned test support paths.
- [x] 3.9 Move backend/dev-server scripts from `ws/scripts` into backend or dashboard-level scripts according to the script ownership decision.
- [x] 3.10 Keep backend-owned React SSR widget components in `backend` when they render server-side widget HTML; move only browser app shell code to `frontend`.
- [x] 3.11 Preserve existing validation behavior for theme, package, service, plugin, locale, and output-log requests.
- [x] 3.12 Port backend unit/controller/widget/handler/script tests from `ws/tests` to `backend/tests` and update imports only as needed.
- [x] 3.13 Build and type-check `backend`, then run backend tests on Windows.

## 4. Frontend Project

- [x] 4.1 Create `setup/dashboard/frontend` package, Vite config, TypeScript config, lint config, and test scripts.
- [x] 4.2 Implement the frontend side of the boot/runtime contract for base path, locale, translated boot labels, theme/language lists, asset roots, backend endpoint paths, and Socket.IO paths.
- [x] 4.3 Move the dashboard document/app shell and React browser entrypoint into `frontend` while preserving the current visible layout.
- [x] 4.4 Ensure frontend code does not import backend source files; cross-project imports must use `shared` types/helpers or backend endpoints.
- [x] 4.5 Keep legacy browser dependencies loaded in the same effective order as the current rendered HTML.
- [x] 4.6 Keep current widget placeholder and populated-state DOM IDs/classes needed by existing JavaScript and dashboard-local tests.
- [x] 4.7 Add or port frontend tests for dashboard shell rendering, runtime config handling, menu rendering, modals, script order, static asset references, and theme option UI.
- [x] 4.8 Build and type-check `frontend`, then run frontend tests on Windows.

## 5. Static Assets And Themes

- [x] 5.1 Keep root dashboard static assets available at `/skins`, `/lib`, `/fonts`, `/img`, `/js`, and `/lang`.
- [x] 5.2 Ensure frontend output references dashboard static assets without bundling or rewriting `defaulted` and `smoked` theme CSS.
- [x] 5.3 Verify representative CSS, JS, image, favicon, font, and language asset URLs resolve through the new backend after backend static routing is implemented.
- [x] 5.4 Verify `defaulted` theme switching invokes the existing theme selection command path and serves the selected CSS.
- [x] 5.5 Verify `smoked` theme switching invokes the existing theme selection command path and serves the selected CSS.

## 6. Integration And Parity

- [x] 6.1 Add an isolated dev/test runner that starts the new backend and serves the new frontend after both projects build independently.
- [x] 6.2 Run migrated dashboard-local Mocha/tsx tests against the new frontend/backend pair on Windows.
- [x] 6.3 Compare old and new `/` and `/ws` rendered HTML contracts for required title, runtime config, locale behavior, panel IDs, widget containers, modal IDs, script order, and static asset references.
- [x] 6.4 Verify root `/`, `/ws`, `/node/*`, `/db/output.log`, Socket.IO widget updates, debug routes, and test routes work through the split runtime.
- [x] 6.5 Fix any route, HTML contract, widget output, theme action, or static asset mismatch before runtime entrypoint switching.

## 7. Runtime Switch And Documentation

- [x] 7.1 Update systemd service templates to start the new backend output after parity verification passes.
- [x] 7.2 Update nginx/dashboard proxy templates only as needed to serve the new frontend/backend outputs while preserving public URLs.
- [x] 7.3 Update install/update packaging references from `ws` to the new frontend/backend outputs.
- [x] 7.4 Keep the old `setup/dashboard/ws` runtime as a comparison baseline only; ensure new frontend/backend/shared projects and runtime/deployment references do not import or start it.
- [x] 7.5 Update dashboard README/developer documentation with the new `frontend`, `backend`, and `shared` layout, workspace scripts, dev/test startup, and Windows-local verification commands.

## 8. Final Verification

- [x] 8.1 Run dashboard-level workspace build, type-check, lint, and tests.
- [x] 8.2 Run backend build, type-check, lint, and tests.
- [x] 8.3 Run frontend build, type-check, lint, and tests.
- [x] 8.4 Run dashboard-local route/render/controller/handler/widget/script tests against the switched runtime on Windows.
- [x] 8.5 Re-test both theme switching flows after the runtime switch.
- [x] 8.6 Confirm no existing theme CSS files were rewritten, normalized, or reformatted by this change.
