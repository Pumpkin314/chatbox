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

test.describe('Weather App E2E', () => {
  test('Open weather - dashboard visible', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, createMultiStepResponse([
      { type: 'tool_call', toolName: 'open_app', args: { app_id: 'weather' } },
      { type: 'text', text: 'Weather Dashboard is now open.' },
    ]))

    await sendChatMessage(page, 'show me the weather')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    const title = await getPanelTitle(page)
    expect(title).toContain('Weather')

    logStep('weather-open', 'PASSED: Weather Dashboard visible on open')
  })

  test('Query real city - data displayed', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open weather
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'weather' } },
        { type: 'text', text: 'Weather Dashboard is open.' },
      ]),
      // Get weather for city
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'get_weather', args: { city: 'San Francisco' } },
        { type: 'text', text: 'The current weather in San Francisco is 65°F with partly cloudy skies and light winds from the west.' },
      ]),
    ])

    await sendChatMessage(page, 'open weather')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'what is the weather in San Francisco')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('San Francisco')

    logStep('weather-query-city', 'PASSED: City weather data displayed')
  })

  test('Different city - response updates', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open weather
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'weather' } },
        { type: 'text', text: 'Weather Dashboard is open.' },
      ]),
      // First city
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'get_weather', args: { city: 'New York' } },
        { type: 'text', text: 'New York is currently 72°F and sunny.' },
      ]),
      // Second city
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'get_weather', args: { city: 'Tokyo' } },
        { type: 'text', text: 'Tokyo is currently 58°F with overcast skies.' },
      ]),
    ])

    // Open weather
    await sendChatMessage(page, 'open weather')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    // Query first city
    await sendChatMessage(page, 'weather in New York')
    await waitForAssistantResponse(page)

    let lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('New York')

    // Query second city
    await sendChatMessage(page, 'what about Tokyo')
    await waitForAssistantResponse(page)

    lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('Tokyo')

    logStep('weather-different-city', 'PASSED: Different city response updates')
  })
})
