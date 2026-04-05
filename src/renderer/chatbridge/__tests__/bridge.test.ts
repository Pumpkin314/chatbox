/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type BridgeMessage,
  clearHandlers,
  clearPending,
  handleIncomingMessage,
  HOST_MESSAGE_TYPES,
  IFRAME_MESSAGE_TYPES,
  onMessage,
  sendMessage,
} from '../bridge'

// Helper to create a mock iframe
function createMockIframe(): HTMLIFrameElement {
  const posted: Array<{ message: unknown; origin: string }> = []
  const iframe = {
    contentWindow: {
      postMessage: (message: unknown, origin: string) => {
        posted.push({ message, origin })
      },
    },
    _posted: posted,
  } as unknown as HTMLIFrameElement & { _posted: typeof posted }
  return iframe
}

// Helper to simulate a response from iframe
function simulateResponse(id: string, type: string, payload: unknown): void {
  const event = new MessageEvent('message', {
    data: { type, id, payload, timestamp: Date.now() },
  })
  handleIncomingMessage(event)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  clearPending()
  clearHandlers()
  vi.useRealTimers()
})

describe('message type constants', () => {
  it('HOST_MESSAGE_TYPES contains tool_call (host sends tool calls to iframes)', () => {
    expect(HOST_MESSAGE_TYPES).toContain('tool_call')
    expect(HOST_MESSAGE_TYPES).not.toContain('tool_call_result')
  })

  it('HOST_MESSAGE_TYPES contains app_init', () => {
    expect(HOST_MESSAGE_TYPES).toContain('app_init')
  })

  it('IFRAME_MESSAGE_TYPES contains expected types', () => {
    expect(IFRAME_MESSAGE_TYPES).toContain('state_update')
    expect(IFRAME_MESSAGE_TYPES).toContain('app_complete')
    expect(IFRAME_MESSAGE_TYPES).toContain('error')
  })
})

describe('bridge', () => {
  describe('sendMessage', () => {
    it('posts a message to the iframe contentWindow', () => {
      const iframe = createMockIframe()
      const promise = sendMessage(iframe, 'app_init', { version: 1 })

      const posted = (iframe as unknown as { _posted: Array<{ message: BridgeMessage; origin: string }> })._posted
      expect(posted).toHaveLength(1)
      expect(posted[0].message.type).toBe('app_init')
      expect(posted[0].message.payload).toEqual({ version: 1 })
      expect(posted[0].origin).toBe('*')
      expect(typeof posted[0].message.id).toBe('string')
      expect(posted[0].message.id.length).toBeGreaterThan(0)

      // Clean up the pending promise
      simulateResponse(posted[0].message.id, 'app_init_ack', {})
      return promise
    })

    it('resolves when a correlated response arrives', async () => {
      const iframe = createMockIframe()
      const promise = sendMessage(iframe, 'app_init', {})

      const posted = (iframe as unknown as { _posted: Array<{ message: BridgeMessage; origin: string }> })._posted
      const messageId = posted[0].message.id

      simulateResponse(messageId, 'app_init_ack', { ready: true })

      const result = await promise
      expect(result).toEqual({ ready: true })
    })

    it('rejects when response times out', async () => {
      const iframe = createMockIframe()
      const promise = sendMessage(iframe, 'app_init', {})

      // Advance past the 30s timeout
      vi.advanceTimersByTime(31_000)

      await expect(promise).rejects.toThrow('timed out')
    })

    it('rejects with error type responses', async () => {
      const iframe = createMockIframe()
      const promise = sendMessage(iframe, 'app_init', {})

      const posted = (iframe as unknown as { _posted: Array<{ message: BridgeMessage; origin: string }> })._posted
      const messageId = posted[0].message.id

      simulateResponse(messageId, 'error', 'Something went wrong')

      await expect(promise).rejects.toThrow('Something went wrong')
    })

    it('rejects when iframe has no contentWindow', async () => {
      const iframe = { contentWindow: null } as unknown as HTMLIFrameElement
      await expect(sendMessage(iframe, 'app_init', {})).rejects.toThrow('contentWindow is not available')
    })
  })

  describe('UUID correlation', () => {
    it('resolves the correct promise when multiple messages are in flight', async () => {
      const iframe = createMockIframe()

      const promise1 = sendMessage(iframe, 'type_a', { n: 1 })
      const promise2 = sendMessage(iframe, 'type_b', { n: 2 })

      const posted = (iframe as unknown as { _posted: Array<{ message: BridgeMessage; origin: string }> })._posted
      const id1 = posted[0].message.id
      const id2 = posted[1].message.id

      // Respond in reverse order
      simulateResponse(id2, 'type_b_result', { answer: 'B' })
      simulateResponse(id1, 'type_a_result', { answer: 'A' })

      const result1 = await promise1
      const result2 = await promise2
      expect(result1).toEqual({ answer: 'A' })
      expect(result2).toEqual({ answer: 'B' })
    })
  })

  describe('onMessage', () => {
    it('dispatches non-correlated messages to handlers', () => {
      const received: BridgeMessage[] = []
      const unsub = onMessage((msg) => received.push(msg))

      const event = new MessageEvent('message', {
        data: {
          type: 'state_update',
          id: 'some-new-id',
          payload: { foo: 'bar' },
          timestamp: Date.now(),
        },
      })
      handleIncomingMessage(event)

      expect(received).toHaveLength(1)
      expect(received[0].type).toBe('state_update')
      expect(received[0].payload).toEqual({ foo: 'bar' })

      unsub()
    })

    it('unsubscribe stops delivery', () => {
      const received: BridgeMessage[] = []
      const unsub = onMessage((msg) => received.push(msg))
      unsub()

      const event = new MessageEvent('message', {
        data: {
          type: 'state_update',
          id: 'another-id',
          payload: {},
          timestamp: Date.now(),
        },
      })
      handleIncomingMessage(event)

      expect(received).toHaveLength(0)
    })

    it('ignores malformed messages', () => {
      const received: BridgeMessage[] = []
      onMessage((msg) => received.push(msg))

      // No type
      handleIncomingMessage(new MessageEvent('message', { data: { id: '1' } }))
      // No id
      handleIncomingMessage(new MessageEvent('message', { data: { type: 'x' } }))
      // Not an object
      handleIncomingMessage(new MessageEvent('message', { data: 'string' }))
      // Null
      handleIncomingMessage(new MessageEvent('message', { data: null }))

      expect(received).toHaveLength(0)
    })
  })
})
