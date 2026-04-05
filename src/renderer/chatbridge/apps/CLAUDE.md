# ChatBridge Apps

Self-contained HTML apps loaded in iframes by the ChatBridge system.

## Structure

Each app is a directory containing `index.html` (and optionally `__tests__/`):

- `chess/` — Chess game with AI move suggestions
- `weather/` — Weather display with location lookup
- `spotify/` — Spotify playback control (currently disabled)
- `rubiks/` — Rubik's cube visualization

## Build Pipeline

These files are the **single source of truth** for app HTML. They are:
- Copied to `release/app/dist/renderer/apps/` at build time by the `chatbridgeAppsPlugin()` in `electron.vite.config.ts`
- Served at `/apps/{name}/index.html` in dev mode by the same plugin's `configureServer` hook

Do NOT place copies in `src/renderer/public/apps/` — that directory was removed.

## App Protocol

Each app includes `bridge-sdk.js` and communicates with the host via PostMessage.
Apps must handle messages defined in the bridge protocol (see `../bridge.ts`).
App tool schemas are registered in `../registry/apps.json`.
