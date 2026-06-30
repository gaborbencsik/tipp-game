import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

// US-945 / US-946 seed the two global types we need (migrations 0049 + 0054).
const BRACKET_TYPE_ID = '44444444-aaaa-bbbb-cccc-000000000946'

test.describe('UX-042: Admin bracket evaluation per round', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('renders BracketRoundTeamList with one section per round under the bracket card', async ({ page }) => {
    await injectSession(page)
    await page.goto('/admin/tournament-evaluation')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Torna-tipp kiértékelés' })).toBeVisible()

    const bracketCard = page.locator(
      `[data-testid="tournament-evaluation-type"][data-type-id="${BRACKET_TYPE_ID}"]`,
    )
    await expect(bracketCard).toBeVisible()
    await expect(bracketCard.getByTestId('bracket-round-team-list')).toBeVisible()

    for (const round of ['last_32', 'last_16', 'qf', 'sf', 'final', 'bronze']) {
      await expect(bracketCard.getByTestId(`round-section-${round}`)).toBeVisible()
      await expect(bracketCard.getByTestId(`save-${round}`)).toBeVisible()
    }
  })
})
