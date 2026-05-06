import { test, expect } from '@playwright/test'
import { loginViaUI, injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

test.describe('Authentication', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('login via UI redirects to /app/matches', async ({ page }) => {
    await loginViaUI(page)
    await expect(page).toHaveURL(/\/app\/matches/)
    await expect(page.getByTestId('nav-matches')).toBeVisible()
  })

  test('protected route redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/app/matches')
    await expect(page).toHaveURL(/\/login/)
  })

  test('logout clears session and redirects to /login', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/matches')
    await expect(page.getByTestId('nav-matches')).toBeVisible()

    await page.getByTestId('user-menu-btn').click()
    await page.getByTestId('menu-logout').click()
    await expect(page).toHaveURL(/\/login/)
  })
})
