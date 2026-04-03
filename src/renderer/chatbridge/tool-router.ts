import { createStore } from 'jotai'
import { handleOpenApp, handleCloseApp } from './app-lifecycle'

/**
 * Bridge interface — PR 2.2 will provide the real implementation.
 * Use setBridgeRef() to wire it up once available.
 */
export interface AppBridge {
  sendToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown>
}

let bridgeRef: AppBridge | null = null
let storeRef: ReturnType<typeof createStore> | null = null

/**
 * Set the bridge reference so tool calls can be routed to the iframe.
 * Called by PR 2.2 when the postMessage bridge is initialized.
 */
export function setBridgeRef(bridge: AppBridge): void {
  bridgeRef = bridge
}

/**
 * Set the Jotai store reference for lifecycle operations.
 */
export function setStoreRef(store: ReturnType<typeof createStore>): void {
  storeRef = store
}

/**
 * Route a tool call to the appropriate handler.
 *
 * - open_app  -> handleOpenApp (Jotai store)
 * - close_app -> handleCloseApp (Jotai store)
 * - otherwise -> forward to active app iframe via bridge
 *
 * Returns JSON-stringified result.
 */
export async function routeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
  if (toolName === 'open_app') {
    if (!storeRef) {
      return JSON.stringify({ success: false, error: 'Store not initialized' })
    }
    const appId = args.app_id as string
    const result = handleOpenApp(storeRef, appId)
    return JSON.stringify(result)
  }

  if (toolName === 'close_app') {
    if (!storeRef) {
      return JSON.stringify({ success: false, error: 'Store not initialized' })
    }
    handleCloseApp(storeRef)
    return JSON.stringify({ success: true })
  }

  // App-specific tool — route through bridge
  if (!bridgeRef) {
    return JSON.stringify({
      success: false,
      error: `Bridge not available. Cannot route tool call "${toolName}" to app iframe.`,
    })
  }

  try {
    const result = await bridgeRef.sendToolCall(toolName, args)
    return JSON.stringify(result)
  } catch (err) {
    return JSON.stringify({
      success: false,
      error: `Bridge error for "${toolName}": ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}
