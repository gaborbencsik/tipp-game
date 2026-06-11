import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import {
  ensureUser,
  ensureGroupInLeague,
  getLeagueByShortName,
} from './helpers/api.js'

// US-946 seeds a global type with id 44444444-aaaa-bbbb-cccc-000000000946 (migration 0054).
// We do not create it from the test — we just verify the picker UI rendering and gate.
const BRACKET_TYPE_ID = '44444444-aaaa-bbbb-cccc-000000000946'

// The seed deadline (2026-06-11 02:00 UTC, WC2026 group-stage kickoff) is in the past as of
// today. We freeze the browser clock to a moment well before the deadline so the picker (and
// its gate) actually renders instead of falling into the "expired" branch.
const FROZEN_NOW = new Date('2026-06-01T08:00:00.000Z')

test.describe('Bracket progression', () => {
  test.beforeAll(async () => {
    await ensureUser()
    const wc = await getLeagueByShortName('VB')
    if (!wc) throw new Error('VB league not seeded — check migrations')
    await ensureGroupInLeague(`E2E WC Group ${Date.now()}`, wc.id)
  })

  test('shows the locked gate when group standings are not filled', async ({ page }) => {
    await page.clock.install({ time: FROZEN_NOW })
    await injectSession(page)
    await page.goto('/app/tournament-tips')

    const card = page.getByTestId(`tournament-tip-${BRACKET_TYPE_ID}`)
    await expect(card).toBeVisible({ timeout: 5000 })

    // Gate is shown — no rounds rendered, no save status.
    await expect(card.getByTestId('bracket-progression-gate')).toBeVisible()
    await expect(card.getByTestId('bracket-round-last_32')).toHaveCount(0)
  })
})
