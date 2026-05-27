## ADDED Requirements

### Requirement: Frontend dependencies SHALL be loaded from npm modules
Dashboard frontend MUST load historical lib dependencies through npm-managed modules and frontend build outputs, rather than runtime `/lib/*` script or stylesheet tags.

#### Scenario: Dashboard shell no longer references /lib scripts
- **WHEN** the dashboard HTML shell is rendered from the split frontend/backend runtime
- **THEN** the HTML SHALL NOT include `<script src="/lib/...">` entries
- **THEN** third-party JS dependencies SHALL be provided by frontend-built assets

#### Scenario: Dashboard shell no longer references /lib stylesheets
- **WHEN** the dashboard HTML shell is rendered
- **THEN** the HTML SHALL NOT include `<link href="/lib/...">` stylesheet entries
- **THEN** required third-party styles SHALL be included from frontend build outputs

### Requirement: Frontend runtime logic SHALL be owned by frontend modules
The frontend module entrypoint MUST own dashboard behavior that was previously executed by `/js/quick.js` and `/js/dashboard.js`. The dashboard shell MUST NOT load those files as post-bootstrap runtime scripts.

#### Scenario: Dashboard shell uses a single frontend runtime entry
- **WHEN** the dashboard HTML shell is rendered from the split frontend/backend runtime
- **THEN** it SHALL load `/dashboard-client.js` as the browser runtime entry
- **THEN** it SHALL NOT load `/js/quick.js` or `/js/dashboard.js` script tags

#### Scenario: Dashboard interactions are initialized from modules
- **WHEN** the dashboard client initializes
- **THEN** menu toggles, dropdown behavior, modals, dashboard config controls, Socket.IO updates, service toggles, package table pagination, and widget refresh behavior SHALL be initialized from frontend module code
- **THEN** no interaction SHALL require a backend-served legacy script to run after the frontend bundle

#### Scenario: Third-party libraries are imported explicitly by feature modules
- **WHEN** a frontend module uses jQuery-dependent behavior or utility libraries
- **THEN** the module SHALL import its dependencies from npm-managed packages or local frontend modules
- **THEN** the feature SHALL NOT rely on new implicit global bridges introduced by this migration

### Requirement: Version governance SHALL follow workspace package baselines
Frontend migration MUST use approved dependency versions from dashboard workspace governance to avoid unmanaged drift.

#### Scenario: Dependencies match workspace baseline
- **WHEN** dependency manifests are reviewed for the migration
- **THEN** frontend third-party library versions SHALL align with `setup/dashboard/package.json` baseline definitions
- **THEN** no ad-hoc CDN or manual `/lib` copy dependency SHALL be introduced

### Requirement: Test suites SHALL enforce removal of /lib direct references
Automated tests MUST validate that frontend shell output and runtime behavior no longer depend on direct `/lib` references.

#### Scenario: Shell contract validates no /lib direct references
- **WHEN** dashboard shell tests are executed
- **THEN** assertions SHALL fail if `/lib` script or stylesheet references appear in rendered HTML

#### Scenario: Runtime smoke checks validate migrated dependencies
- **WHEN** split runtime tests execute widget/dashboard interactions
- **THEN** core interactions depending on migrated libraries SHALL succeed
- **THEN** regressions caused by module initialization order or missing imports SHALL be detected by tests

#### Scenario: Browser-rendered icons and font assets remain visible
- **WHEN** the split dashboard is opened in a real browser through the backend route or the Vite proxy route
- **THEN** Font Awesome icon elements used by the header, sidebar, panels, and buttons SHALL render with a FontAwesome font family and non-empty glyph content
- **THEN** font files emitted from npm-managed stylesheets SHALL resolve with successful HTTP responses

#### Scenario: Browser-rendered pagination controls remain usable
- **WHEN** the split dashboard initializes table widgets that depend on DataTables or equivalent pagination behavior
- **THEN** pagination controls SHALL be created without JavaScript errors
- **THEN** clicking pagination controls SHALL change the visible page or disabled/active pagination state as expected

#### Scenario: Browser initialization has no failed dashboard API calls
- **WHEN** the split dashboard is opened in a real browser
- **THEN** required dashboard resources, widget endpoints, and Socket.IO requests SHALL resolve without 4xx/5xx responses caused by the frontend/backend split
- **THEN** the console SHALL NOT contain dependency bootstrap errors, missing import errors, plugin initialization errors, or failed dynamic import errors
