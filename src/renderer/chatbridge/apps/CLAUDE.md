# ChatBridge Apps

Self-contained HTML apps loaded in iframes by the ChatBridge system.

## Structure

Each app is a directory containing `index.html` (and optionally `__tests__/`):

- `chess/` — Chess game with AI move suggestions (Tier 2 internal)
- `weather/` — Weather display with location lookup (Tier 3 external_public)
- `nasa/` — NASA APOD, Mars photos, asteroids (Tier 3 external_public)
- `contract-test/` — Bridge protocol validation (Tier 2 internal)
- `google-books/` — Book search + reading list with Google OAuth (Tier 4 external_authenticated)
- `spotify/` — Spotify playback control (Tier 4, disabled, MOCK ONLY — not a real OAuth reference)
- `rubiks/` — Rubik's cube visualization (disabled)

## Build Pipeline

These files are the **single source of truth** for app HTML. They are:
- Copied to `release/app/dist/renderer/apps/` at build time by the `chatbridgeAppsPlugin()` in `electron.vite.config.ts`
- Served at `/apps/{name}/index.html` in dev mode by the same plugin's `configureServer` hook

Do NOT place copies in `src/renderer/public/apps/` — that directory was removed.

## App Protocol

Each app includes `bridge-sdk.js` and communicates with the host via PostMessage.
Apps must handle messages defined in the bridge protocol (see `../bridge.ts`).
App tool schemas are registered in `../registry/apps.json`.
