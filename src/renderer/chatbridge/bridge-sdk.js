/**
 * ChatBridge SDK — IFRAME side.
 *
 * This script is loaded inside app iframes to provide a communication
 * bridge back to the ChatBridge host. Since the iframe uses
 * sandbox="allow-scripts allow-forms" (no allow-same-origin),
 * we must use '*' as targetOrigin when posting to the parent.
 *
 * Usage inside an app iframe:
 *   ChatBridge.onToolCall((toolName, params) => { ... return result })
 *   ChatBridge.sendStateUpdate({ key: 'value' })
 *   ChatBridge.sendComplete({ result: 'done' })
 */

;(function () {
  'use strict'

  // Prevent double-initialization
  if (window.ChatBridge) return

  var toolCallHandlers = []
  var messageHandlers = {}

  /**
   * Generate a UUID v4.
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      var v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * Send a message to the host.
   */
  function sendToHost(type, payload, id) {
    var message = {
      type: type,
      id: id || generateId(),
      payload: payload || {},
      timestamp: Date.now(),
    }
    // Since we're in a sandboxed iframe without allow-same-origin,
    // we must use '*' as the target origin.
    window.parent.postMessage(message, '*')
    return message.id
  }

  /**
   * Handle incoming messages from the host.
   */
  function handleMessage(event) {
    var data = event.data
    if (!data || typeof data !== 'object' || !data.type || !data.id) {
      return
    }

    // Handle tool calls from the host
    if (data.type === 'tool_call') {
      var toolPayload = data.payload || {}
      var toolName = toolPayload.name
      var toolParams = toolPayload.parameters || {}

      // Dispatch to registered tool call handlers
      var handled = false
      for (var i = 0; i < toolCallHandlers.length; i++) {
        try {
          var result = toolCallHandlers[i](toolName, toolParams)
          if (result !== undefined) {
            // If handler returns a Promise, wait for it
            if (result && typeof result.then === 'function') {
              result.then(
                function (resolvedResult) {
                  sendToHost('tool_call_result', { result: resolvedResult }, data.id)
                },
                function (err) {
                  sendToHost(
                    'error',
                    { message: err && err.message ? err.message : 'Tool call failed' },
                    data.id,
                  )
                },
              )
            } else {
              sendToHost('tool_call_result', { result: result }, data.id)
            }
            handled = true
            break
          }
        } catch (err) {
          sendToHost(
            'error',
            { message: err && err.message ? err.message : 'Tool call handler error' },
            data.id,
          )
          handled = true
          break
        }
      }

      if (!handled) {
        sendToHost('error', { message: 'No handler for tool: ' + toolName }, data.id)
      }
      return
    }

    // Handle app_init from host
    if (data.type === 'app_init') {
      if (messageHandlers.init) {
        try {
          messageHandlers.init(data.payload)
        } catch (_) {
          // Ignore init handler errors
        }
      }
      // ACK the init
      sendToHost('app_init_ack', {}, data.id)
      return
    }

    // Generic message handler dispatch
    if (messageHandlers[data.type]) {
      try {
        messageHandlers[data.type](data.payload, data.id)
      } catch (_) {
        // Ignore handler errors
      }
    }
  }

  window.addEventListener('message', handleMessage)

  /**
   * The ChatBridge SDK object exposed to app iframes.
   */
  window.ChatBridge = {
    /**
     * Register a handler for tool calls from the host.
     * The handler receives (toolName, params) and should return a result
     * (or a Promise that resolves to a result).
     *
     * @param {function} handler - (toolName: string, params: object) => any
     */
    onToolCall: function (handler) {
      if (typeof handler === 'function') {
        toolCallHandlers.push(handler)
      }
    },

    /**
     * Register a handler for a specific message type.
     *
     * @param {string} type - Message type to listen for
     * @param {function} handler - (payload: any, messageId: string) => void
     */
    on: function (type, handler) {
      if (typeof handler === 'function') {
        messageHandlers[type] = handler
      }
    },

    /**
     * Send a state update to the host.
     *
     * @param {object} state - The state update to send
     */
    sendStateUpdate: function (state) {
      sendToHost('state_update', state)
    },

    /**
     * Signal that the app has completed its task.
     *
     * @param {object} result - The completion result
     */
    sendComplete: function (result) {
      sendToHost('app_complete', result)
    },

    /**
     * Send a custom message to the host.
     *
     * @param {string} type - Message type
     * @param {object} payload - Message payload
     * @returns {string} The message ID
     */
    send: function (type, payload) {
      return sendToHost(type, payload)
    },
  }
})()
