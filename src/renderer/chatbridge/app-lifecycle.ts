import { atom } from 'jotai'
import type { Store } from 'jotai'
import { getAppById } from './registry'

/** The currently active app ID, or null if no app is open */
export const activeAppAtom = atom<string | null>(null)

/** Arbitrary state for the active app, serialized on close */
export const appStateAtom = atom<Record<string, unknown> | null>(null)

export interface OpenAppResult {
  success: boolean
  error?: string
  appId?: string
  appName?: string
}

/**
 * Opens an app by ID. Validates the app exists in the registry.
 */
export function handleOpenApp(store: Store, appId: string): OpenAppResult {
  const app = getAppById(appId)
  if (!app) {
    return { success: false, error: `App "${appId}" not found in registry` }
  }

  store.set(activeAppAtom, appId)
  store.set(appStateAtom, {})

  return { success: true, appId: app.id, appName: app.name }
}

/**
 * Closes the active app, clearing atoms.
 */
export function handleCloseApp(store: Store): void {
  store.set(activeAppAtom, null)
  store.set(appStateAtom, null)
}
