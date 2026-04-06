import type { Page, Route } from '@playwright/test'
import { logStep } from './test-logger'

/**
 * Represents a single mock response that will be returned for a chat completion request.
 */
export interface MockResponse {
  /** Raw SSE body string to return */
  body: string
}

/**
 * Set up route interception for any chat completions API call.
 * Intercepts requests matching *\/chat/completions and returns mock streaming responses.
 *
 * @param page - Playwright page
 * @param responses - Queue of mock responses. Each incoming request consumes the next response.
 *                    If the queue is exhausted, returns a simple text response.
 */
export async function mockOpenAIStream(page: Page, responses: MockResponse[]): Promise<void> {
  const queue = [...responses]
  logStep('mockOpenAIStream', `setting up mock with ${queue.length} responses`)

  await page.route('**/chat/completions**', async (route: Route) => {
    const mock = queue.shift()
    const body = mock?.body ?? createTextResponse('I am a mock response.').body

    logStep('mockOpenAIStream', `intercepted request, ${queue.length} responses remaining`)

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    })
  })
}

/**
 * Create a mock streaming response containing a single tool_call.
 *
 * The OpenAI streaming format sends tool calls as deltas:
 * - First chunk: tool_calls[0] with id, function.name, and start of arguments
 * - Subsequent chunks: function.arguments fragments
 * - Final chunk: finish_reason = "tool_calls"
 */
export function createToolCallResponse(toolName: string, args: Record<string, unknown>): MockResponse {
  const toolCallId = `call_mock_${toolName}_${Date.now()}`
  const argsStr = JSON.stringify(args)

  const chunks = [
    // First chunk: role + tool call start
    {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mock',
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                index: 0,
                id: toolCallId,
                type: 'function',
                function: {
                  name: toolName,
                  arguments: '',
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    // Second chunk: arguments
    {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mock',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: {
                  arguments: argsStr,
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    // Final chunk: finish
    {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mock',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'tool_calls',
        },
      ],
    },
  ]

  const body = chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n\n') + '\n\ndata: [DONE]\n\n'
  return { body }
}

/**
 * Create a mock streaming response with plain text content.
 */
export function createTextResponse(text: string): MockResponse {
  const chunks = [
    // Role chunk
    {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mock',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: '' },
          finish_reason: null,
        },
      ],
    },
    // Content chunk
    {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mock',
      choices: [
        {
          index: 0,
          delta: { content: text },
          finish_reason: null,
        },
      ],
    },
    // Finish chunk
    {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mock',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    },
  ]

  const body = chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n\n') + '\n\ndata: [DONE]\n\n'
  return { body }
}

/**
 * Create a multi-step response that includes tool calls followed by a final text message.
 * Each step produces a separate streaming response that will be consumed on consecutive requests.
 *
 * The Vercel AI SDK with maxSteps > 1 makes multiple requests:
 * 1. First request -> returns tool_call
 * 2. SDK calls execute() on the tool, gets result
 * 3. SDK makes another request with tool result in messages -> returns next tool_call or text
 *
 * So for multi-step, we need to return an array of MockResponses (one per request).
 */
export function createMultiStepResponse(
  steps: Array<
    | { type: 'tool_call'; toolName: string; args: Record<string, unknown> }
    | { type: 'text'; text: string }
  >,
): MockResponse[] {
  return steps.map((step) => {
    if (step.type === 'tool_call') {
      return createToolCallResponse(step.toolName, step.args)
    }
    return createTextResponse(step.text)
  })
}
