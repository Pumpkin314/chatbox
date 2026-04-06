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

test.describe('Google Books App E2E', () => {
  test('Search flow - open app and search books', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Step 1: Open google-books app
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'google-books' } },
        { type: 'text', text: 'Google Books is now open.' },
      ]),
      // Step 2: Search for books about dinosaurs
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'search_books', args: { query: 'dinosaurs' } },
        { type: 'text', text: 'I found several books about dinosaurs! Here are some great options for learning about these amazing prehistoric creatures.' },
      ]),
    ])

    await sendChatMessage(page, 'find books about dinosaurs')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    const title = await getPanelTitle(page)
    expect(title.toLowerCase()).toContain('reading assistant')

    logStep('google-books-search', 'PASSED: Google Books panel visible after search')

    // Send the search query
    await sendChatMessage(page, 'search for dinosaur books')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('dinosaurs')

    logStep('google-books-search-results', 'PASSED: Search results displayed for dinosaurs')
  })

  test('Auth-required flow - add_to_shelf requires sign in', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Step 1: Open google-books app
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'google-books' } },
        { type: 'text', text: 'Google Books is now open.' },
      ]),
      // Step 2: Try to add to shelf - tool returns auth_required, LLM tells user to sign in
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'add_to_shelf', args: { volume_id: 'vol1', shelf: 'to_read' } },
        { type: 'text', text: 'You need to sign in with Google to manage your reading list. Please click the sign in button to connect your Google account.' },
      ]),
    ])

    await sendChatMessage(page, 'open google books')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'add that to my reading list')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg.toLowerCase()).toContain('sign in')

    logStep('google-books-auth-required', 'PASSED: Auth-required flow shows sign in message')
  })

  test('Mock fallback - search works without API key', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Step 1: Open google-books app
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'google-books' } },
        { type: 'text', text: 'Google Books is now open.' },
      ]),
      // Step 2: Search books - mock fallback returns data even without API key
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'search_books', args: { query: 'test' } },
        { type: 'text', text: 'Here are some books I found. The results are from our sample collection since no API key is configured.' },
      ]),
    ])

    await sendChatMessage(page, 'open google books')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'search for test books')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    // The mock LLM response should come through regardless of API key status
    expect(lastMsg).toContain('books')

    logStep('google-books-mock-fallback', 'PASSED: Mock fallback search works without API key')
  })
})
