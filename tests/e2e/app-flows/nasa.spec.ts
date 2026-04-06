import { test, expect } from '@playwright/test'
import { login, sendChatMessage, waitForAssistantResponse, getLastAssistantMessage } from '../helpers/chat-harness'
import { waitForPanel, getPanelTitle } from '../helpers/app-harness'
import {
  mockOpenAIStream,
  createMultiStepResponse,
} from '../helpers/mock-llm'
import { logStep, clearLogs } from '../helpers/test-logger'

const TEST_EMAIL = 'test@chatbridge.dev'
const TEST_PASSWORD = 'TestPass123!'

test.beforeEach(async () => {
  clearLogs()
})

test.describe('NASA App E2E', () => {
  test('Open NASA - Space Explorer panel visible', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, createMultiStepResponse([
      { type: 'tool_call', toolName: 'open_app', args: { app_id: 'nasa' } },
      { type: 'text', text: 'NASA Space Explorer is now open!' },
    ]))

    await sendChatMessage(page, 'open nasa')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    const title = await getPanelTitle(page)
    expect(title).toContain('Space')

    logStep('nasa-open', 'PASSED: Space Explorer panel visible')
  })

  test('Get APOD - response includes description', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open NASA
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'nasa' } },
        { type: 'text', text: 'NASA Space Explorer is open.' },
      ]),
      // Get APOD
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'get_apod', args: {} },
        { type: 'text', text: 'Today\'s Astronomy Picture of the Day shows the Pillars of Creation in the Eagle Nebula, captured by the James Webb Space Telescope.' },
      ]),
    ])

    await sendChatMessage(page, 'open nasa')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'show me the astronomy picture of the day')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('Pillars of Creation')

    logStep('nasa-apod', 'PASSED: APOD response includes description')
  })

  test('Context awareness - follow-up references APOD', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open NASA
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'nasa' } },
        { type: 'text', text: 'NASA Space Explorer is open.' },
      ]),
      // Get APOD
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'get_apod', args: {} },
        { type: 'text', text: 'Today\'s APOD features a stunning image of the Andromeda Galaxy.' },
      ]),
      // Follow-up text response referencing the APOD
      ...createMultiStepResponse([
        { type: 'text', text: 'The Andromeda Galaxy, also known as M31, is the nearest large galaxy to the Milky Way. It is about 2.5 million light-years away.' },
      ]),
    ])

    // Open NASA
    await sendChatMessage(page, 'open nasa')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    // Get APOD
    await sendChatMessage(page, 'show me the APOD')
    await waitForAssistantResponse(page)

    let lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('Andromeda')

    // Follow-up question
    await sendChatMessage(page, 'tell me more about that')
    await waitForAssistantResponse(page)

    lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('Andromeda')

    logStep('nasa-context', 'PASSED: Context awareness - follow-up references APOD')
  })
})
