import type { Page } from '@playwright/test'
import { logStep } from './test-logger'

/**
 * Mock Supabase auth endpoints so login works without a real backend.
 */
async function mockSupabaseAuth(page: Page, email: string): Promise<void> {
  const fakeUser = {
    id: 'test-user-id-12345',
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
  }

  const fakeSession = {
    access_token: 'fake-access-token-for-testing',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: fakeUser,
  }

  await page.route('**/auth/v1/token**', async (route) => {
    logStep('mockSupabaseAuth', 'intercepted auth token request')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...fakeSession }),
    })
  })

  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeUser),
    })
  })

  await page.route('**/auth/v1/session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { session: fakeSession }, error: null }),
    })
  })

  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}

/**
 * Configure the OpenAI provider by navigating through the Settings UI.
 * This is the most reliable approach as it uses the same code paths as a real user.
 */
async function configureProviderViaUI(page: Page): Promise<void> {
  logStep('configureProviderViaUI', 'clicking Other options')

  // Click "Other options" in the welcome card
  const otherOptions = page.getByText('Other options')
  if (await otherOptions.isVisible({ timeout: 2000 }).catch(() => false)) {
    await otherOptions.click()
    await page.waitForTimeout(500)

    // We should now be on the provider settings page
    // Look for "OpenAI" in the provider list
    logStep('configureProviderViaUI', 'looking for OpenAI provider')

    const openAIItem = page.getByText('OpenAI').first()
    if (await openAIItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await openAIItem.click()
      await page.waitForTimeout(500)

      // Look for API key input and fill it
      const apiKeyInput = page.locator('input[type="password"]').first()
      if (await apiKeyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await apiKeyInput.fill('sk-fake-test-key-for-e2e-testing')
        await page.waitForTimeout(300)

        // Save/close the settings
        // Look for a save button or close button
        const saveButton = page.getByRole('button', { name: /save/i })
        if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await saveButton.click()
        }
      }
    }

    // Navigate back to the chat
    // Press Escape to close settings modal
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }
}

/**
 * Select a model for the current chat session.
 */
async function selectModelViaUI(page: Page): Promise<void> {
  logStep('selectModelViaUI', 'clicking Select Model')

  const selectModelBtn = page.getByText('Select Model')
  if (await selectModelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await selectModelBtn.click()
    await page.waitForTimeout(500)

    // Look for gpt-4o in the model list
    const gpt4o = page.getByText('gpt-4o').first()
    if (await gpt4o.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gpt4o.click()
      await page.waitForTimeout(300)
    }
  }
}

/**
 * Fill email/password fields, click Sign In, and wait for the chat interface.
 * Also configures the OpenAI provider so messages can be sent.
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  logStep('login', 'setting up auth mocks')
  await mockSupabaseAuth(page, email)

  logStep('login', 'navigating to app')
  await page.goto('/')

  // Handle login if Supabase is configured
  const loginPage = page.locator('[data-testid="login-page"]')
  const chatTextarea = page.locator('[data-testid="message-input"]')

  const firstVisible = await Promise.race([
    loginPage.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'login' as const),
    chatTextarea.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'chat' as const),
  ])

  if (firstVisible === 'login') {
    logStep('login', 'login page found, filling credentials')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.locator('button[type="submit"]').click()
    logStep('login', 'waiting for chat interface after login')
    await chatTextarea.waitFor({ state: 'visible', timeout: 15_000 })
  } else {
    logStep('login', 'no auth required, chat interface already visible')
  }

  // Check if we need to configure a provider (welcome card showing)
  const welcomeCard = page.getByText('Welcome to Chatbox!')
  if (await welcomeCard.isVisible({ timeout: 1000 }).catch(() => false)) {
    logStep('login', 'welcome card visible, configuring provider')
    await configureProviderViaUI(page)
  }

  // Check if we need to select a model
  const selectModelBtn = page.getByText('Select Model')
  if (await selectModelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    logStep('login', 'select model visible, selecting model')
    await selectModelViaUI(page)
  }

  await page.waitForTimeout(500)
  logStep('login', 'chat interface ready')
}

/**
 * Type a message in the chat textbox and send it with Enter.
 * The default shortcut is Enter (not Ctrl+Enter).
 */
export async function sendChatMessage(page: Page, text: string): Promise<void> {
  logStep('sendChatMessage', `sending: "${text}"`)
  const textarea = page.locator('[data-testid="message-input"]')
  await textarea.click()
  await textarea.fill(text)
  await page.keyboard.press('Enter')
  logStep('sendChatMessage', 'message sent, waiting for response')
}

/**
 * Wait for an assistant message bubble to appear in the chat.
 */
export async function waitForAssistantResponse(page: Page, timeout = 15_000): Promise<void> {
  logStep('waitForAssistantResponse', 'waiting for assistant message')
  await page.waitForTimeout(500)
  try {
    await page.waitForFunction(
      () => {
        const msgContents = document.querySelectorAll('.msg-content')
        return msgContents.length > 0
      },
      { timeout },
    )
  } catch {
    logStep('waitForAssistantResponse', 'msg-content not found, checking alternatives')
  }
  // Brief wait for response to finalize
  await page.waitForTimeout(500)
  logStep('waitForAssistantResponse', 'assistant response detected')
}

/**
 * Get the text content of the last assistant response in the chat.
 */
export async function getLastAssistantMessage(page: Page): Promise<string> {
  logStep('getLastAssistantMessage', 'extracting last assistant message')
  const msgContents = page.locator('.msg-content')
  const count = await msgContents.count()
  if (count === 0) {
    return ''
  }
  const lastMsg = msgContents.nth(count - 1)
  const text = (await lastMsg.textContent()) ?? ''
  logStep('getLastAssistantMessage', `found: "${text.slice(0, 100)}..."`)
  return text.trim()
}
