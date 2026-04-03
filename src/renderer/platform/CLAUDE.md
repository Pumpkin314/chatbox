# platform/

## Purpose
Platform abstraction layer — separates Electron, Web, Mobile, and Test platform implementations.

## Key Files
- `index.ts`: Runtime platform detection, `initPlatform()` selector
- `web_platform.ts`: Web build implementation — IndexedDB storage, browser APIs only
- `storages.ts`: Storage backends (IndexedDBStorage, LocalForageStorage)
- `interfaces.ts`: Platform interface contract

## Patterns
- Platform selected at runtime based on `window.electronAPI` presence
- **IMPORTANT:** `pnpm dev:web` still runs inside Electron, so DesktopPlatform activates even with CHATBOX_BUILD_PLATFORM=web. WebPlatform only activates in production web builds (`pnpm build:web && pnpm serve:web`) or pure browser environments with no `window.electronAPI`.
- For true web-platform testing during dev, use: `pnpm build:web && pnpm serve:web`
- WebPlatform: no native filesystem, no IPC, no electron-store. Knowledge base and URL parsing throw errors.
- All platform access goes through the Platform interface — never call Electron APIs directly
- Storage: IndexedDB via localforage for web builds

## Integration Points
- Depends on: nothing (leaf module)
- Depended on by: `../stores/`, `../adapters/`, `../packages/`

## ChatBridge Changes Needed
- Supabase client initialization (web platform only for MVP)
- Auth state management via Supabase Auth
- Potentially extend Platform interface with Supabase accessor

## Last Updated
2026-04-02 by brownfield-planning exploration
