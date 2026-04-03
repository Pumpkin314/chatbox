import { atom } from 'jotai'
import type { Store } from 'jotai'
import { activeAppAtom, appStateAtom } from './app-lifecycle'
import { getAppById } from './registry'

export interface AppContextEntry {
  appId: string
  appName: string
  state: Record<string, unknown>
  timestamp: number
  type: 'state_update' | 'app_complete'
}

/** History of app interactions in the current conversation */
export const appContextHistoryAtom = atom<AppContextEntry[]>([])

/**
 * Records a state update from the active app.
 * Called when the iframe sends a state_update message.
 */
export function recordStateUpdate(store: Store, state: Record<string, unknown>): void {
  store.set(appStateAtom, state)
}

/**
 * Records app completion -- stores final state in context history.
 * Called when the app signals completion or when the panel is closed.
 */
export function recordAppComplete(store: Store): AppContextEntry | null {
  const appId = store.get(activeAppAtom)
  const state = store.get(appStateAtom)
  if (!appId || !state) return null

  const app = getAppById(appId)
  const entry: AppContextEntry = {
    appId,
    appName: app?.name ?? appId,
    state,
    timestamp: Date.now(),
    type: 'app_complete',
  }

  const history = store.get(appContextHistoryAtom)
  store.set(appContextHistoryAtom, [...history, entry])
  return entry
}

/**
 * Gets the last known state for a specific app from context history.
 * Used when reopening an app to resume from where the user left off.
 */
export function getLastAppState(store: Store, appId: string): Record<string, unknown> | null {
  const history = store.get(appContextHistoryAtom)
  const entries = history.filter((e) => e.appId === appId)
  return entries.length > 0 ? entries[entries.length - 1].state : null
}
