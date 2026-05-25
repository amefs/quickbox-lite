# Dashboard Frontend/Backend Split Contract

This document records the implementation contract for splitting `setup/dashboard/ws`
into a single active dashboard runtime made from `setup/dashboard/frontend` and
`setup/dashboard/backend`.

## Ownership Map

### Backend-Owned

- `ws/src/server.tsx`
- `ws/src/router.tsx`
- `ws/src/controllers/**`
- `ws/src/handlers/**`
- `ws/src/utils/**`
- `ws/src/plugins.ts`
- `ws/src/system-static.ts`
- `ws/src/info.ts`
- `ws/src/dashboard-config.ts`
- `ws/src/i18n.ts`
- `ws/src/widgets/**` when the file renders server-side widget HTML or returns
  command/system-backed widget data
- `ws/src/debug.tsx`
- `ws/src/vendor/i18n/**`
- `ws/src/testing/**`
- `ws/config/*.json`
- backend/dev-server scripts from `ws/scripts/**`
- backend tests ported from `ws/tests/**`

### Frontend-Owned

- Browser application entrypoint.
- Dashboard document/app shell currently in `ws/src/dashboard-page.tsx`.
- Client-side runtime bootstrap for base path, locale, endpoint paths, asset
  roots, and Socket.IO path selection.
- Frontend tests for shell rendering, runtime config, modal/theme option UI,
  static asset references, and script ordering.

### Shared-Owned

`setup/dashboard/shared` is allowed only for types and pure helpers imported by
both frontend and backend. Current planned shared files:

- `src/api-types.ts`: boot runtime config, REST responses, Socket.IO envelopes,
  widget request/response contracts, command action results.

Backend-only config, i18n implementation, testing helpers, command execution,
and system data utilities must not be placed in `shared`.

### Dashboard Root Static Assets

The root dashboard asset directories remain first-class runtime assets:

- `/skins` -> `setup/dashboard/skins`
- `/lib` -> `setup/dashboard/lib`
- `/fonts` -> `setup/dashboard/fonts`
- `/img` -> `setup/dashboard/img`
- `/js` -> `setup/dashboard/js`
- `/lang` -> `setup/dashboard/lang`

Theme CSS files are served as-is. This split must not rewrite, normalize,
regenerate, or reformat the existing `defaulted` or `smoked` theme CSS.

## Package And Tooling Decisions

- `setup/dashboard/package.json` is the npm workspace root.
- Workspaces are `frontend`, `backend`, and `shared` when shared code exists.
- Root scripts orchestrate workspace build, type-check, lint, test, and
  isolated dev/test startup.
- `frontend` uses Vite with TypeScript and React.
- `backend` keeps the current Node service direction: TypeScript, tsx for
  dev/tests, Mocha, supertest, Socket.IO, Express, and a production build that
  emits a service-friendly backend entrypoint.
- Browser-only legacy libraries remain dashboard root dependencies/static
  assets until a later asset cleanup change.
- `react` and `react-dom` are owned by the packages that compile React code:
  `frontend` for browser shell and `backend` for server-rendered widgets.
- Socket.IO server dependencies are backend-owned. Socket.IO browser usage is
  via the existing static client asset unless the frontend build intentionally
  imports a client package later.

## Frontend/Backend Contract

### Boot Runtime Config

The backend serves the frontend shell with a JSON-safe runtime config:

```ts
interface DashboardRuntimeConfig {
    basePath: "" | "/ws";
    locale: string;
    endpoints: {
        dashboardConfig: string;
        systemStatic: string;
        theme: string;
        plugins: string;
        plugin: string;
        outputLog: string;
        widgets: Record<string, string>;
    };
    socket: {
        path: "/socket.io" | "/ws/socket.io";
    };
    assets: {
        skins: "/skins";
        lib: "/lib";
        fonts: "/fonts";
        img: "/img";
        js: "/js";
        lang: "/lang";
    };
    messages: {
        enabled: string;
        disabled: string;
        refresh: string;
    };
}
```

### REST Routes

- `GET /` renders the dashboard shell.
- `GET /ws` and `GET /ws/` render the dashboard shell with `/ws` base path.
- `GET /set?lang=<locale>` normalizes locale for loopback/test requests.
- `GET /node/menu` returns `{ mainMenuHtml: string, showPluginTab: boolean }`.
- `GET /node/dashboard_config` returns username, version, branch, developer
  state, language options, theme options, and bandwidth page options.
- `GET /node/system_static` returns CPU metadata and network interfaces.
- `GET /node/load`, `/node/disk_data`, `/node/ram_stats`,
  `/node/removal_modals` return server-rendered widget HTML.
- `POST /node/theme` accepts `{ theme: string }` and returns
  `{ ok: true, theme: string }` for allowlisted themes.
- `GET /node/plugins` returns `{ plugins: { name: string; installed: boolean }[] }`.
- `POST /node/plugin` accepts `{ plugin: string, action: "install" | "remove" }`.
- `GET /db/output.log` returns `{ content, start, end, size }`.
- `/debug/*` exists only outside production.
- `/test/*` exists only in test mode.

Invalid command, plugin, theme, locale, and widget requests must be rejected
before command execution.

### Socket.IO Contract

The backend serves both default Socket.IO and `/ws/socket.io` paths.

Client message request:

```ts
interface DashboardSocketRequest {
    key: string;
    url: string;
    requestId?: string;
    locale?: string;
}
```

Server message response:

```ts
interface DashboardSocketResponse {
    key: string;
    requestId?: string;
    url: string;
    pathName: string;
    success: boolean;
    message: string;
    response: string | object;
}
```

Widget URL resolution remains allowlisted. Unknown or traversal-like routes
must fail instead of proxying arbitrary paths.

## Windows-Local Verification Plan

The repository-level Playwright e2e suite is not the migration gate for this
split. Verification is based on dashboard-local tests that run on Windows:

- Type-check and build current `ws` baseline before switching entrypoints.
- Port and run router/controller/handler/widget/script tests from
  `setup/dashboard/ws/tests`.
- Use supertest to assert `/` and `/ws` HTML contracts:
  title, `window.quickboxRuntime`, locale, panel IDs, widget containers,
  modal IDs, script order, and static asset references.
- Assert static asset routes for representative CSS, JS, font, image, favicon,
  language, and theme assets.
- Assert `/node/theme` validates theme names and calls the expected command
  path without rewriting theme CSS.
- Compare old and split route outputs through deterministic assertions before
  switching service and nginx templates.
