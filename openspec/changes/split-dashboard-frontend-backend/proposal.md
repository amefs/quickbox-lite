## Why

`setup/dashboard` currently mixes the dashboard shell, React SSR, REST endpoints, Socket.IO handlers, static assets, and legacy browser dependencies inside the `ws` service and dashboard root. This makes the migrated React code harder to evolve because the frontend is still shaped by a server-rendered HTML entrypoint, root-level static `lib` assets, and PHP-era dashboard layout assumptions.

Splitting the dashboard into explicit frontend and backend projects gives React a dedicated build/runtime boundary while keeping the dashboard fully functional after the split.

## What Changes

- Add `setup/dashboard/frontend` as the React-facing project that owns the dashboard HTML/app entry, browser-side code, frontend build configuration, and frontend tests.
- Add `setup/dashboard/backend` as the Node service project that owns REST routes, Socket.IO handlers, backend runtime config, command execution adapters, server-rendered widget output where still required, and backend tests.
- Add a dashboard-level shared area only for cross-project TypeScript API/runtime types and pure helpers that are imported by both projects.
- Move the current `setup/dashboard/ws` responsibilities into those two projects and make the split implementation the single dashboard runtime.
- Move runtime JSON config, command definitions, backend test bootstrap, mock profiles, server scripts, and the embedded i18n implementation to explicit owners in the split structure.
- Keep the current dashboard root static assets, including `img`, `lang`, `fonts`, `skins`, and legacy `lib` dependencies, as first-class assets for the split dashboard until a later asset cleanup change.
- Do not rewrite or normalize the two existing theme CSS files as part of this change. Theme switching must continue to work by selecting the existing compiled/hand-edited theme assets.
- Keep the old implementation untouched until the new frontend/backend pair has been implemented and compared against the existing rendered dashboard through dashboard-local tests; after completion, the split implementation is the only runtime.
- Update packaging, service, nginx/template, and developer scripts only after the new implementation passes the dashboard-local verification plan.
- Update dashboard developer documentation for the new frontend/backend/shared layout and commands.

## Capabilities

### New Capabilities

- `dashboard-frontend-backend-split`: Defines the dashboard split into frontend and backend projects, the required rendered output, REST/Socket.IO behavior, static assets, and theme switching.

### Modified Capabilities

- None.

## Impact

- Affected paths: `setup/dashboard/ws`, `setup/dashboard/frontend`, `setup/dashboard/backend`, optional `setup/dashboard/shared`, dashboard package/workspace files, dashboard config JSON, dashboard scripts, dashboard static assets, service templates, nginx dashboard proxy templates, and dashboard-local tests under the split projects.
- Runtime impact: the dashboard backend should continue serving the same externally visible dashboard routes and Socket.IO paths while the frontend becomes the source of the browser application.
- Build impact: dashboard build/test commands will need to run frontend and backend checks through dashboard-level workspace/orchestration commands.
- Asset impact: current CSS/theme assets and legacy browser libraries remain part of the split dashboard so the migrated UI renders like the existing dashboard before deeper CSS or dependency cleanup is attempted.
