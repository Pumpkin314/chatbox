import type { Page } from '@playwright/test'
import { logStep } from './test-logger'

/**
 * Wait for the ChatBridge side panel to appear.
 */
export async function waitForPanel(page: Page, timeout = 10_000): Promise<void> {
  logStep('waitForPanel', 'waiting for side panel')
  await page.locator('[data-testid="chatbridge-side-panel"]').waitFor({
    state: 'visible',
    timeout,
  })
  logStep('waitForPanel', 'side panel visible')
}

/**
 * Wait for the "Connected" status indicator in the side panel footer.
 */
export async function waitForConnected(page: Page, timeout = 15_000): Promise<void> {
  logStep('waitForConnected', 'waiting for Connected status')
  await page.locator('[data-testid="chatbridge-panel-footer"]').waitFor({
    state: 'visible',
    timeout,
  })
  await page.locator('[data-testid="chatbridge-panel-footer"]').getByText('Connected').waitFor({
    state: 'visible',
    timeout,
  })
  logStep('waitForConnected', 'Connected status visible')
}

/**
 * Click the close button on the side panel.
 */
export async function closePanel(page: Page): Promise<void> {
  logStep('closePanel', 'clicking close button')
  await page.locator('[data-testid="chatbridge-close-button"]').click()
  // Wait for panel to disappear
  await page.locator('[data-testid="chatbridge-side-panel"]').waitFor({
    state: 'detached',
    timeout: 5_000,
  })
  logStep('closePanel', 'panel closed')
}

/**
 * Get the panel header title text.
 */
export async function getPanelTitle(page: Page): Promise<string> {
  logStep('getPanelTitle', 'reading panel title')
  const header = page.locator('[data-testid="chatbridge-panel-header"]')
  const text = (await header.textContent()) ?? ''
  logStep('getPanelTitle', `title: "${text}"`)
  return text.trim()
}

/**
 * Check if the side panel is currently visible.
 */
export async function isPanelVisible(page: Page): Promise<boolean> {
  const visible = await page.locator('[data-testid="chatbridge-side-panel"]').isVisible()
  logStep('isPanelVisible', `visible: ${visible}`)
  return visible
}
