import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'
import type { Page } from '@playwright/test'

function injectSessionWithLocale(page: Page, locale: string): Promise<void> {
  return page.addInitScript((loc) => {
    window.sessionStorage.setItem('dev_session', JSON.stringify({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        supabaseId: '00000000-0000-0000-0000-000000000001',
        email: 'admin@dev.local',
        displayName: 'Dev User',
        avatarUrl: null,
        role: 'admin',
        preferredLocale: loc,
        onboardingCompletedAt: '2020-01-01T00:00:00.000Z',
      },
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    }))
    localStorage.setItem('locale', loc)
  }, locale)
}

test.describe('i18n Locale', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('login page toggle switches language immediately', async ({ page }) => {
    await page.goto('/login')

    // Default is HU
    await expect(page.getByTestId('locale-toggle-hu')).toHaveClass(/font-semibold/)
    const titleHu = await page.locator('h1').textContent()

    // Switch to EN
    await page.getByTestId('locale-toggle-en').click()
    await expect(page.getByTestId('locale-toggle-en')).toHaveClass(/font-semibold/)

    const titleEn = await page.locator('h1').textContent()
    expect(titleEn).not.toEqual(titleHu)
  })

  test('login page locale persists in localStorage', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('locale-toggle-en').click()

    const locale = await page.evaluate(() => localStorage.getItem('locale'))
    expect(locale).toBe('en')
  })

  test('locale syncs from user after login', async ({ page }) => {
    // Inject session with hu locale
    await injectSession(page)
    await page.goto('/app/matches')

    // The page should be in Hungarian (user.preferredLocale = 'hu')
    await expect(page.getByTestId('nav-matches')).toBeVisible()
    const locale = await page.evaluate(() => localStorage.getItem('locale'))
    expect(locale).toBe('hu')
  })

  test('profile locale dropdown saves and switches language', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/profile')

    // Switch to English in dropdown
    await page.getByTestId('locale-select').selectOption('en')
    await page.getByTestId('save-btn').click()
    await expect(page.getByTestId('save-success')).toBeVisible({ timeout: 5000 })

    // Page should now be in English
    const heading = await page.locator('h1').textContent()
    expect(heading).toBe('Profile')
  })

  test('locale persists across navigation', async ({ page }) => {
    // Inject session with EN locale
    await injectSessionWithLocale(page, 'en')
    await page.goto('/app/matches')

    // Navigate to leaderboard
    await page.getByTestId('nav-leaderboard').click()
    await expect(page.locator('h1')).toContainText('Leaderboard')
  })

  test('date format changes with locale', async ({ page }) => {
    // Inject session with EN locale
    await injectSessionWithLocale(page, 'en')
    await page.goto('/app/matches')

    // Wait for page to load
    await expect(page.getByTestId('nav-matches')).toBeVisible()

    // Check that the page body does not contain Hungarian month names
    const bodyText = await page.locator('body').textContent() ?? ''
    const huMonths = /január|február|március|április|május|június|július|augusztus|szeptember|október|november|december/
    expect(bodyText).not.toMatch(huMonths)
  })
})
