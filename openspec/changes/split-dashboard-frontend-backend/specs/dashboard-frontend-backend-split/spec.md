## ADDED Requirements

### Requirement: Dashboard projects are split by runtime responsibility

The dashboard implementation SHALL contain separate `setup/dashboard/frontend` and `setup/dashboard/backend` projects. The frontend project SHALL own browser application code, frontend build configuration, and frontend tests. The backend project SHALL own Express routes, Socket.IO handlers, command execution adapters, backend runtime configuration, and backend tests.

#### Scenario: Frontend project owns browser app

- **WHEN** a developer looks for the dashboard React app entrypoint and browser build configuration
- **THEN** those files are located under `setup/dashboard/frontend`

#### Scenario: Backend project owns server runtime

- **WHEN** a developer looks for the dashboard Express app, REST routes, Socket.IO handlers, and command-backed operations
- **THEN** those files are located under `setup/dashboard/backend`

### Requirement: Public dashboard routes remain functional

The migrated dashboard SHALL provide the externally visible route behavior required for `/`, `/ws`, `/socket.io`, `/ws/socket.io`, `/node/*`, `/db/output.log`, `/debug/*` when debug routes are enabled, and `/test/*` when test mode is enabled.

#### Scenario: Dashboard root loads after split

- **WHEN** a user opens `/` through the dashboard proxy
- **THEN** the dashboard page loads with the same core layout, title, and panels as the pre-split implementation

#### Scenario: Dashboard ws path loads after split

- **WHEN** a user opens `/ws` through the dashboard proxy
- **THEN** the dashboard page loads and realtime updates connect through the `/ws` Socket.IO path

#### Scenario: Widget endpoints remain available

- **WHEN** the frontend or existing tests request current `/node/*` widget endpoints
- **THEN** the backend returns the data or rendered output required by the split frontend

### Requirement: Frontend rendering matches the current dashboard contract

The migrated frontend SHALL render the same dashboard structure as the current server-rendered implementation before runtime templates are switched to the new projects. This SHALL be verified through dashboard-local route and HTML contract tests that run on Windows. The contract includes header, sidebar menus, dashboard panels, service controls, package management center, modals, locale-dependent text, runtime config, static asset references, script order, and widget placeholders or populated states.

#### Scenario: Dashboard shell contract matches current behavior

- **WHEN** the old implementation and the new frontend/backend implementation render `/` and `/ws`
- **THEN** dashboard-local tests assert the same required title, runtime config, locale behavior, core panel IDs, widget containers, modal IDs, script order, and static asset references

#### Scenario: Widget and route contracts match current behavior

- **WHEN** backend route, controller, handler, and widget tests are run for the old implementation and the split implementation
- **THEN** both implementations satisfy the same route responses, widget output shapes, action validation, locale handling, and Socket.IO message behavior

### Requirement: Backend API and Socket.IO behavior remains functional

The backend SHALL provide REST and Socket.IO behavior required by the migrated dashboard, including widget HTML responses where still used, JSON responses, output log reads, service status updates, package/plugin actions, locale handling, and error handling semantics.

#### Scenario: Socket.IO widget request succeeds

- **WHEN** the frontend sends a current widget request over Socket.IO
- **THEN** the backend responds with the success shape and response payload required by the split frontend

#### Scenario: Command-backed action validation remains enforced

- **WHEN** a theme, package, service, or plugin action receives invalid input
- **THEN** the backend rejects it with an error response instead of executing a command

### Requirement: Legacy static assets remain available

The migrated dashboard SHALL keep existing static assets available from their current public paths, including `/skins`, `/lib`, `/fonts`, `/img`, `/js`, and `/lang`. The migration MUST NOT require rewriting legacy CSS, theme CSS, or static library assets.

#### Scenario: Static asset path resolves

- **WHEN** the dashboard page references a current CSS, JavaScript, font, image, or language asset path
- **THEN** the asset resolves from the same public URL as before the split

#### Scenario: Legacy browser script order is preserved

- **WHEN** the frontend loads legacy browser libraries needed by the dashboard
- **THEN** the scripts are loaded in an order matching the current rendered HTML

### Requirement: Theme switching remains functional without CSS rewrite

The migrated dashboard SHALL support the existing `defaulted` and `smoked` themes through the current theme selection flow. The migration MUST NOT rewrite, normalize, regenerate, or reformat the existing theme CSS files.

#### Scenario: User switches to defaulted theme

- **WHEN** a user confirms the `defaulted` theme selection
- **THEN** the backend applies the existing `themeSelect-defaulted` flow and the dashboard continues serving the selected theme CSS

#### Scenario: User switches to smoked theme

- **WHEN** a user confirms the `smoked` theme selection
- **THEN** the backend applies the existing `themeSelect-smoked` flow and the dashboard continues serving the selected theme CSS

### Requirement: Runtime entrypoint switches only after parity verification

The migration SHALL keep the old implementation unchanged until the new frontend/backend implementation has passed build, test, route, Socket.IO, theme-switching, and rendered-output checks. Runtime templates and install/update references SHALL be switched only after those checks pass, and the final result SHALL use the split implementation as the only active dashboard runtime.

#### Scenario: Old implementation remains reference only during migration

- **WHEN** the new frontend/backend projects are being implemented and tested
- **THEN** the existing `setup/dashboard/ws` implementation remains unchanged only as the comparison baseline

#### Scenario: Service template is switched after verification

- **WHEN** parity verification has passed for the new frontend/backend implementation
- **THEN** service and nginx templates can be updated to use the new backend entrypoint and frontend build output

#### Scenario: No legacy runtime remains active after split

- **WHEN** the migration is complete
- **THEN** the dashboard has no active alternate legacy server, legacy entrypoint, or legacy runtime path
