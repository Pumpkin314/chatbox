import { atom } from 'jotai'
import type { ChatBridgeApp } from './registry'

/**
 * The currently active ChatBridge app, or null if none is open.
 */
export const activeAppAtom = atom<ChatBridgeApp | null>(null)

/**
 * State of the active app's lifecycle.
 */
export type AppState = 'idle' | 'loading' | 'connected' | 'error'
export const appStateAtom = atom<AppState>('idle')

/**
 * Open a ChatBridge app by setting it as the active app.
 */
export function handleOpenApp(
  set: (atom: ReturnType<typeof atom>, value: unknown) => void,
  app: ChatBridgeApp,
): void {
  ;(set as Function)(activeAppAtom, app)
  ;(set as Function)(appStateAtom, 'loading' as AppState)
}

/**
 * Close the active ChatBridge app.
 */
export function handleCloseApp(set: (atom: ReturnType<typeof atom>, value: unknown) => void): void {
  ;(set as Function)(activeAppAtom, null)
  ;(set as Function)(appStateAtom, 'idle' as AppState)
}
