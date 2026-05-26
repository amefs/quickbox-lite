# QuickBox Lite dashboard

This  is a modified version of QuickBox CE dashboard. Most of the features are preserved: such as Package management center, service controller, network status chart...

The Realtime CPU/Network Graph are removed. Data refresh rate is slightly reduced to save computing resources. You can install Netdata to get more System information instead.

## Layout

- `frontend`: React dashboard shell, browser runtime contract, Vite build, and frontend tests.
- `backend`: Express routes, Socket.IO handlers, command-backed controllers, backend config, backend-rendered widget fragments, and backend tests.
- `shared`: TypeScript API/runtime types shared by frontend and backend.
- root `skins`, `lib`, `fonts`, `img`, `js`, and `lang`: static dashboard assets served at their existing public URLs.

## Development

Run commands from `setup/dashboard`:

```bash
npm install
npm run build
npm run type-check
npm run lint
npm test
npm run dev:dashboard
```

`npm run dev:dashboard` builds `frontend` and `backend` independently, then starts `backend/dist/server.js`. The production service template also starts `/srv/dashboard/backend/dist/server.js` with `/srv/dashboard` as the working directory.

On Windows, use the same commands with `npm.cmd`, for example:

```powershell
npm.cmd run build
npm.cmd run type-check
npm.cmd run lint
npm.cmd test
```
