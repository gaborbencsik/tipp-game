import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

// US-945 / US-946 seed the two global types we need (migrations 0049 + 0054).
const BRACKET_TYPE_ID = '44444444-aaaa-bbbb-cccc-000000000946'

test.describe('UX-044: Admin bracket — participants-shape correct answer (7 sections)', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('renders 7 round sections (last_32 → champion + bronze)', async ({ page }) => {
    await injectSession(page)
    await page.goto('/admin/tournament-evaluation')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Torna-tipp kiértékelés' })).toBeVisible()

    const bracketCard = page.locator(
      `[data-testid="tournament-evaluation-type"][data-type-id="${BRACKET_TYPE_ID}"]`,
    )
    await expect(bracketCard).toBeVisible()
    await expect(bracketCard.getByTestId('bracket-round-team-list')).toBeVisible()

    const expectedRounds = ['last_32', 'last_16', 'qf', 'sf', 'final', 'champion', 'bronze']
    for (const round of expectedRounds) {
      await expect(bracketCard.getByTestId(`round-section-${round}`)).toBeVisible()
      await expect(bracketCard.getByTestId(`save-${round}`)).toBeVisible()
    }
  })

  test('last_32 is initially open; downstream rounds are locked', async ({ page }) => {
    await injectSession(page)
    await page.goto('/admin/tournament-evaluation')
    await page.waitForLoadState('networkidle')

    const bracketCard = page.locator(
      `[data-testid="tournament-evaluation-type"][data-type-id="${BRACKET_TYPE_ID}"]`,
    )
    // last_32 should be unlocked (data-locked="false").
    await expect(bracketCard.getByTestId('round-section-last_32')).toHaveAttribute('data-locked', 'false')
    // Subsequent rounds without a saved upstream pool should be locked.
    for (const round of ['last_16', 'qf', 'sf', 'final', 'champion', 'bronze']) {
      await expect(bracketCard.getByTestId(`round-section-${round}`)).toHaveAttribute('data-locked', 'true')
    }
  })
})
