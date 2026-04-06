/**
 * PostMessage bridge — HOST side implementation.
 *
 * Provides bidirectional communication between the ChatBridge host
 * and app iframes using structured messages with UUID correlation.
 */

export interface BridgeMessage {
  type: string
  id: string
  payload: unknown
  timestamp: number
}

export type MessageHandler = (message: BridgeMessage) => void

const TIMEOUT_MS = 30_000
const ACK_RETRY_MS = 5_000
const MAX_RETRIES = 5

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pendingResponses = new Map<string, PendingRequest>()
const messageHandlers = new Set<MessageHandler>()

/**
 * Generate a UUID v4 string.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Send a message to an iframe and wait for a correlated response.
 *
 * @param iframe - The iframe element to send the message to
 * @param type - Message type (e.g. 'app_init', 'tool_call_result')
 * @param payload - Message payload
 * @param targetOrigin - Target origin for postMessage (defaults to '*' since sandbox iframes have null origin)
 * @returns Promise that resolves with the response payload
 */
export function sendMessage(
  iframe: HTMLIFrameElement,
  type: string,
  payload: unknown = {},
  targetOrigin = '*',
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = generateId()
    const message: BridgeMessage = {
      type,
      id,
      payload,
      timestamp: Date.now(),
    }

    const timer = setTimeout(() => {
      pendingResponses.delete(id)
      reject(new Error(`ChatBridge: message '${type}' timed out after ${TIMEOUT_MS}ms (id: ${id})`))
    }, TIMEOUT_MS)

    pendingResponses.set(id, { resolve, reject, timer })

    const contentWindow = iframe.contentWindow
    if (!contentWindow) {
      clearTimeout(timer)
      pendingResponses.delete(id)
      reject(new Error('ChatBridge: iframe contentWindow is not available'))
      return
    }

    contentWindow.postMessage(message, targetOrigin)
  })
}

/**
 * Send a message to an iframe with ACK retry logic.
 * Retries up to MAX_RETRIES times with ACK_RETRY_MS delay between retries.
 */
export function sendMessageWithRetry(
  iframe: HTMLIFrameElement,
  type: string,
  payload: unknown = {},
  targetOrigin = '*',
): Promise<unknown> {
  let attempt = 0

  function trySend(): Promise<unknown> {
    attempt++
    return sendMessage(iframe, type, payload, targetOrigin).catch((err) => {
      if (attempt < MAX_RETRIES && err instanceof Error && err.message.includes('timed out')) {
        return new Promise((resolve) => setTimeout(resolve, ACK_RETRY_MS)).then(() => trySend())
      }
      throw err
    })
  }

  return trySend()
}

/**
 * Register a handler for incoming messages from iframes.
 * Returns an unsubscribe function.
 */
export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler)
  return () => {
    messageHandlers.delete(handler)
  }
}

/**
 * Handle an incoming message event from the window.
 * Validates structure and dispatches to handlers or resolves pending requests.
 */
export function handleIncomingMessage(event: MessageEvent): void {
  const data = event.data
  if (!data || typeof data !== 'object' || !data.type || !data.id) {
    return
  }

  const message = data as BridgeMessage

  // Check if this is a response to a pending request
  const pending = pendingResponses.get(message.id)
  if (pending) {
    clearTimeout(pending.timer)
    pendingResponses.delete(message.id)

    if (message.type === 'error') {
      pending.reject(new Error(String(message.payload ?? 'Unknown error from iframe')))
    } else {
      pending.resolve(message.payload)
    }
    return
  }

  // Dispatch to registered handlers
  for (const handler of messageHandlers) {
    try {
      handler(message)
    } catch {
      // Silently ignore handler errors to avoid breaking other handlers
    }
  }
}

/**
 * Install the global message listener on the window.
 * Returns an uninstall function.
 */
export function installMessageListener(): () => void {
  window.addEventListener('message', handleIncomingMessage)
  return () => {
    window.removeEventListener('message', handleIncomingMessage)
  }
}

/**
 * Clear all pending responses (useful for cleanup).
 */
export function clearPending(): void {
  for (const [id, pending] of pendingResponses) {
    clearTimeout(pending.timer)
    pending.reject(new Error('ChatBridge: bridge was cleaned up'))
  }
  pendingResponses.clear()
}

/**
 * Clear all message handlers (useful for cleanup).
 */
export function clearHandlers(): void {
  messageHandlers.clear()
}

/** Valid host-to-iframe message types */
export const HOST_MESSAGE_TYPES = ['app_init', 'tool_call', 'auth_result'] as const

/** Valid iframe-to-host message types */
export const IFRAME_MESSAGE_TYPES = ['state_update', 'app_complete', 'error', 'auth_request'] as const
