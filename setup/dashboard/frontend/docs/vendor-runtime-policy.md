# Vendor Runtime Policy

## Loading Strategy

- Third-party browser dependencies are loaded from npm packages via `src/vendor/index.ts`.
- The dashboard shell loads only:
  - `/vendor-jquery.css`
  - `/vendor-ui.css`
  - `/vendor-misc.css`
  - `/dashboard-client.js`
  - `/skins/quick.css`
- Direct `/lib/*` script/link tags are forbidden in frontend shell templates.
- Backend-served `/js/quick.js` and `/js/dashboard.js` are no longer runtime entries for the split frontend. Their behavior is owned by frontend modules under `src/runtime`.

## Vendor UMD Boundary

Some npm packages still ship UMD plugin builds that register against browser jQuery during module evaluation. `src/vendor/jquery.ts` exposes jQuery only for that vendor registration boundary:

- `window.$`
- `window.jQuery`

Frontend feature code must import dependencies explicitly from `src/vendor/index.ts` or npm modules. Do not add business-runtime globals as a compatibility layer.

## Rollback Plan

If plugin compatibility regression appears after deployment:

1. Revert the migration commit(s) that introduced `src/vendor/index.ts` and shell asset replacement.
2. Restore previous shell references to `/lib/*`, `/js/quick.js`, and `/js/dashboard.js` only as part of a full migration rollback.
3. Re-run dashboard workspace tests (`build`, `type-check`, `test`).
4. Re-deploy backend with reverted frontend shell.

Rollback scope is limited to frontend asset loading and does not require backend API rollback.
