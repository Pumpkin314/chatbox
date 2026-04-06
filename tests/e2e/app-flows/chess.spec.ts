import { test, expect } from '@playwright/test'
import { login, sendChatMessage, waitForAssistantResponse, getLastAssistantMessage } from '../helpers/chat-harness'
import { waitForPanel, closePanel, getPanelTitle, isPanelVisible } from '../helpers/app-harness'
import {
  mockOpenAIStream,
  createTextResponse,
  createMultiStepResponse,
} from '../helpers/mock-llm'
import { logStep, clearLogs } from '../helpers/test-logger'

const TEST_EMAIL = 'test@chatbridge.dev'
const TEST_PASSWORD = 'TestPass123!'

test.beforeEach(async () => {
  clearLogs()
})

test.describe('Chess App E2E', () => {
  test('Board renders on open', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, createMultiStepResponse([
      { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
      { type: 'text', text: 'Chess is ready! The board is set up for you.' },
    ]))

    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    const title = await getPanelTitle(page)
    expect(title).toContain('Chess')

    logStep('chess-board-renders', 'PASSED: Board renders on open')
  })

  test('Start game via chat', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // First message: open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Second message: start game
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'start_game', args: { color: 'white' } },
        { type: 'text', text: 'Game started! You are playing as white. Make your first move.' },
      ]),
    ])

    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'start a game as white')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('white')

    logStep('chess-start-game', 'PASSED: Start game via chat')
  })

  test('Make move via chat', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Make move
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'make_move', args: { move: 'e2e4' } },
        { type: 'text', text: 'Moved pawn from e2 to e4. Your turn!' },
      ]),
    ])

    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'play e2 to e4')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('e4')

    logStep('chess-make-move', 'PASSED: Make move via chat')
  })

  test('Get hint', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Get hint
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'get_hint', args: {} },
        { type: 'text', text: 'I suggest moving your knight to f3. It controls the center and develops a piece.' },
      ]),
    ])

    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'give me a hint')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('knight')

    logStep('chess-get-hint', 'PASSED: Get hint')
  })

  test('Resign ends game', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess is open.' },
      ]),
      // Resign
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'resign', args: {} },
        { type: 'text', text: 'You have resigned. Game over! Would you like to play again?' },
      ]),
    ])

    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)

    await sendChatMessage(page, 'I resign')
    await waitForAssistantResponse(page)

    const lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('Game over')

    logStep('chess-resign', 'PASSED: Resign ends game')
  })

  test('Full mini-game flow: open, start, move, resign', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await mockOpenAIStream(page, [
      // Step 1: open chess
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'open_app', args: { app_id: 'chess' } },
        { type: 'text', text: 'Chess board is ready.' },
      ]),
      // Step 2: start game
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'start_game', args: { color: 'white' } },
        { type: 'text', text: 'Game started as white.' },
      ]),
      // Step 3: make move
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'make_move', args: { move: 'e2e4' } },
        { type: 'text', text: 'Pawn to e4. Good opening!' },
      ]),
      // Step 4: resign
      ...createMultiStepResponse([
        { type: 'tool_call', toolName: 'resign', args: {} },
        { type: 'text', text: 'You resigned. Game over. Better luck next time!' },
      ]),
    ])

    // Open chess
    await sendChatMessage(page, 'open chess')
    await waitForAssistantResponse(page)
    await waitForPanel(page)
    const title = await getPanelTitle(page)
    expect(title).toContain('Chess')

    // Start game
    await sendChatMessage(page, 'start a new game as white')
    await waitForAssistantResponse(page)
    let lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('white')

    // Make move
    await sendChatMessage(page, 'play e2 to e4')
    await waitForAssistantResponse(page)
    lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('e4')

    // Resign
    await sendChatMessage(page, 'I resign')
    await waitForAssistantResponse(page)
    lastMsg = await getLastAssistantMessage(page)
    expect(lastMsg).toContain('Game over')

    logStep('chess-full-flow', 'PASSED: Full mini-game flow')
  })
})
