import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

test.describe('Scoring Explainer modal', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('Bejelentkezett user a ranglistáról nyitja a modalt → látja a saját csoportja szabályait → bezárja', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/leaderboard')

    await page.getByTestId('scoring-explainer-trigger-leaderboard').click()
    await expect(page.getByTestId('scoring-explainer-modal')).toBeVisible()
    await expect(page.getByText('Meccs-pontozás')).toBeVisible()

    await page.getByTestId('scoring-explainer-close').click()
    await expect(page.getByTestId('scoring-explainer-modal')).not.toBeVisible()
  })

  test('Főmenüből nyitva — címsor megjelenik', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/matches')

    await page.getByTestId('nav-scoring-explainer').click()
    await expect(page.getByTestId('scoring-explainer-modal')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('scoring-explainer-modal')).not.toBeVisible()
  })
})
