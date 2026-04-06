import { test, expect } from '@playwright/test'
import { login, sendChatMessage, waitForAssistantResponse, getLastAssistantMessage } from './helpers/chat-harness'
import { waitForPanel, closePanel, getPanelTitle, isPanelVisible } from './helpers/app-harness'
import {
  mockOpenAIStream,
  createTextResponse,
  createMultiStepResponse,
} from './helpers/mock-llm'
import { logStep, clearLogs } from './helpers/test-logger'

const TEST_EMAIL = 'test@chatbridge.dev'
const TEST_PASSWORD = 'TestPass123!'

test.beforeEach(async () => {
  clearLogs()
})

test.describe('Resilience Tests', () => {
  test('Rapid messages - app does not crash', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      createTextResponse('Response to first message.'),
      createTextResponse('Response to second message.'),
      createTextResponse('Response to third message.'),
    ])

    // Send 3 messages quickly
    await sendChatMessage(page, 'message one')
    await sendChatMessage(page, 'message two')
    await sendChatMessage(page, 'message three')

    // Wait for the last response to come in
    await waitForAssistantResponse(page)

    // App should still be functional - verify we can get a response
    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg.length).toBeGreaterThan(0)

    logStep('resilience-rapid', 'PASSED: Rapid messages handled without crash')
  })

  test('Open app while another is open - clean switch', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Open weather (while chess is still open)
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'weather' } },
        { type: 'text', text: 'Weather Dashboard is now open.' },
      ]),
    ])

    // Open chess
    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)
    let title = await getPanelTitle(page)
    expect(title).toContain('Chess')

    // Open weather without closing chess first
    await sendChatMessage(page, 'open weather instead')
    await waitForAssistantResponse(page)
    await waitForPanel(page)
    title = await getPanelTitle(page)
    expect(title).toContain('Weather')

    logStep('resilience-switch', 'PASSED: Clean switch from Chess to Weather')
  })

  test('Double open_app - idempotent', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // First open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Second open chess (duplicate)
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is already open.' },
      ]),
    ])

    // Open chess
    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)
    const title = await getPanelTitle(page)
    expect(title).toContain('Chess')

    // Open chess again
    await sendChatMessage(page, 'open chess again')
    await waitForAssistantResponse(page)

    // Should still show a single Chess panel
    const visible = await isPanelVisible(page)
    expect(visible).toBe(true)
    const titleAgain = await getPanelTitle(page)
    expect(titleAgain).toContain('Chess')

    // Verify only one panel exists (not duplicated)
    const panelCount = await page.locator('[data-testid="chatbridge-side-panel"]').count()
    expect(panelCount).toBe(1)

    logStep('resilience-idempotent', 'PASSED: Double open_app is idempotent')
  })

  test('Regular message after app close', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Regular text response after close
      createTextResponse('The capital of France is Paris.'),
    ])

    // Open chess
    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    // Close the panel
    await closePanel(page)

    // Verify panel is gone
    const visible = await isPanelVisible(page)
    expect(visible).toBe(false)

    // Send a regular message
    await sendChatMessage(page, 'what is the capital of France')
    await waitForAssistantResponse(page)

    // Verify response works normally
    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('Paris')

    // Verify no panel reappeared
    const stillClosed = await isPanelVisible(page)
    expect(stillClosed).toBe(false)

    logStep('resilience-after-close', 'PASSED: Regular message works after app close')
  })
})
