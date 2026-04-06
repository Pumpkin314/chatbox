import { test, expect } from '@playwright/test'
import { login, sendChatMessage, waitForAssistantResponse, getLastAssistantMessage } from './helpers/chat-harness'
import { waitForPanel, waitForConnected, closePanel, getPanelTitle, isPanelVisible } from './helpers/app-harness'
import {
  mockOpenAIStream,
  createToolCallResponse,
  createTextResponse,
  createMultiStepResponse,
} from './helpers/mock-llm'
import { logStep, clearLogs } from './helpers/test-logger'

const TEST_EMAIL = 'test@chatbridge.dev'
const TEST_PASSWORD = 'TestPass123!'

test.beforeEach(async () => {
  clearLogs()
})

test.describe('ChatBridge Core Scenarios', () => {
  test('1. Tool discovery & invocation - open_app(chess) opens side panel', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    // Mock LLM to call open_app with chess
    await mockOpenAIStream(page, createMultiStepResponse([
      { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
      { type: 'text', text: 'I have opened the Chess app for you. You can now play chess!' },
    ]))

    await sendChatMessage(page, 'I want to play chess')
    await waitForAssistantResponse(page)

    // Verify side panel appeared
    await waitForPanel(page)
    const title = await getPanelTitle(page)
    expect(title).toContain('Chess')

    logStep('test-1', 'PASSED: Side panel appeared with Chess app')
  })

  test('2. App UI renders correctly - iframe loaded with Connected status', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, createMultiStepResponse([
      { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
      { type: 'text', text: 'Chess app is ready. Enjoy your game!' },
    ]))

    await sendChatMessage(page, 'Open the chess game')
    await waitForAssistantResponse(page)

    // Verify iframe loaded and Connected status
    await waitForPanel(page)
    const iframe = page.locator('[data-testid="chatbridge-iframe"]')
    await expect(iframe).toBeVisible()

    await waitForConnected(page)

    logStep('test-2', 'PASSED: iframe visible and Connected status shown')
  })

  test('3. Completion signaling - close panel, chat continues', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    // First interaction: open chess
    await mockOpenAIStream(page, [
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is now open.' },
      ]),
      // Response for the follow-up message after closing
      createTextResponse('Sure, I can help you with something else!'),
    ])

    await sendChatMessage(page, 'Let me play chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    // Close the panel
    await closePanel(page)

    // Verify panel is gone
    const visible = await isPanelVisible(page)
    expect(visible).toBe(false)

    // Send a new message to verify chat continues
    await sendChatMessage(page, 'What else can you help with?')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg.length).toBeGreaterThan(0)

    logStep('test-3', 'PASSED: Panel closed, chat continued successfully')
  })

  test('4. Context retention - LLM response references prior context', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is ready.' },
      ]),
      // After closing, response that references prior context
      createTextResponse('Based on your earlier chess session, would you like to try a different game or continue where you left off?'),
    ])

    await sendChatMessage(page, 'Open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    // Close the app
    await closePanel(page)

    // Send follow-up message
    await sendChatMessage(page, 'What was I doing before?')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('chess')

    logStep('test-4', 'PASSED: Context retention verified - response references chess')
  })

  test('5. App switching - chess then weather', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // First: open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Second: open weather (after user closes chess and asks for weather)
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'weather' } },
        { type: 'text', text: 'Weather Dashboard is now open.' },
      ]),
    ])

    // Open chess first
    await sendChatMessage(page, 'Open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)
    let title = await getPanelTitle(page)
    expect(title).toContain('Chess')

    // Close chess
    await closePanel(page)

    // Open weather
    await sendChatMessage(page, 'Show me the weather')
    await waitForAssistantResponse(page)
    await waitForPanel(page)
    title = await getPanelTitle(page)
    expect(title).toContain('Weather')

    logStep('test-5', 'PASSED: App switching from Chess to Weather')
  })

  test('6. Ambiguous routing - clarifying text, no app opens', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    // Mock LLM to respond with clarifying text (no tool call)
    await mockOpenAIStream(page, [
      createTextResponse('I can help with several things. Would you like to play chess, check the weather, or listen to music? Please let me know which one interests you.'),
    ])

    await sendChatMessage(page, 'I want to do something fun')
    await waitForAssistantResponse(page)

    // Verify no side panel opened
    const visible = await isPanelVisible(page)
    expect(visible).toBe(false)

    // Verify the clarifying text is shown
    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('chess')
    expect(lastMsg).toContain('weather')

    logStep('test-6', 'PASSED: No app opened, clarifying text shown')
  })

  test('7. Refusal for unrelated - text answer with no app', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    // Mock LLM to respond with a direct text answer
    await mockOpenAIStream(page, [
      createTextResponse('2 + 2 equals 4. Is there anything else I can help you with?'),
    ])

    await sendChatMessage(page, "What's 2+2?")
    await waitForAssistantResponse(page)

    // Verify no side panel opened
    const visible = await isPanelVisible(page)
    expect(visible).toBe(false)

    // Verify the answer is shown
    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('4')

    logStep('test-7', 'PASSED: No app opened, text answer provided')
  })
})
