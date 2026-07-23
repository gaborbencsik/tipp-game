import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

test.describe('Scoring Explainer modal', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('Logged-in user opens the modal from the leaderboard → sees their own group rules → closes it', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/leaderboard')

    await page.getByTestId('scoring-explainer-trigger-leaderboard').click()
    await expect(page.getByTestId('scoring-explainer-modal')).toBeVisible()
    await expect(page.getByText('Meccs-pontozás')).toBeVisible()

    await page.getByTestId('scoring-explainer-close').click()
    await expect(page.getByTestId('scoring-explainer-modal')).not.toBeVisible()
  })

  test('Opened from the main menu — heading is visible', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/matches')

    await page.getByTestId('nav-scoring-explainer').click()
    await expect(page.getByTestId('scoring-explainer-modal')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('scoring-explainer-modal')).not.toBeVisible()
  })
})

test.describe('Scoring Explainer feature toggle — disabled (UX-049)', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  // The VITE_SCORING_RULES_ENABLED flag is baked into the composable at
  // dev-server start, so it can't be changed per test via env. Instead we
  // intercept the composable's ES module (served by Vite) and swap its
  // implementation for one that reports the feature as disabled.
  test('hides the nav item, the leaderboard trigger and the modal when the flag is off', async ({ page }) => {
    await page.route('**/useScoringRulesConfig.ts**', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'export function useScoringRulesConfig() { return { isScoringRulesEnabled: false } }',
      })
    })
    await injectSession(page)

    await page.goto('/app/matches')
    await expect(page.getByTestId('nav-scoring-explainer')).toHaveCount(0)

    await page.goto('/app/leaderboard')
    await expect(page.getByTestId('scoring-explainer-trigger-leaderboard')).toHaveCount(0)
    await expect(page.getByTestId('scoring-explainer-modal')).toHaveCount(0)
  })
})
