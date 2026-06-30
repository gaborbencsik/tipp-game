import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import {
  ensureUser, createLeague, createTeam, createMatch,
  createPrediction, setMatchResult, updateMatch, getDefaultScoringConfig,
} from './helpers/api.js'

// UX-043: a knockout meccsek "döntetlen esetén továbbjutó" tipp kiértékelés után is
// látszódjon a MatchDetailView saját tipp szekciójában és a "mások tippjei" listán,
// vizuális visszajelzéssel (correct / incorrect / inactive).
test.describe('UX-043 outcomeAfterDraw badge visibility', () => {
  let drawMatchCorrectId: string
  let drawMatchIncorrectId: string
  let decisiveMatchId: string
  let homeTeamName: string
  let awayTeamName: string
  let extraTimeBonus: number

  test.beforeAll(async () => {
    await ensureUser()
    extraTimeBonus = (await getDefaultScoringConfig()).extraTimeBonusPoints
    const suffix = String(Date.now()).slice(-3)
    const league = await createLeague(`UX-043 League ${Date.now()}`)
    homeTeamName = `UX-043 Home ${suffix}`
    awayTeamName = `UX-043 Away ${suffix}`
    const homeTeam = await createTeam(homeTeamName, `H${suffix}`)
    const awayTeam = await createTeam(awayTeamName, `A${suffix}`)

    // A tipp rögzítéséhez a meccsnek `scheduled` állapotban kell lennie a jövőben;
    // utána admin-update-tel állítjuk át finished + múltbeli időpontra, hogy a result
    // kiértékelődhessen.
    const futureSlot = (offsetDays: number): string => {
      const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
      return d.toISOString()
    }
    const m1 = await createMatch(homeTeam.id, awayTeam.id, league.id, {
      scheduledAt: futureSlot(7), stage: 'round_of_16',
    })
    drawMatchCorrectId = m1.id
    const m2 = await createMatch(homeTeam.id, awayTeam.id, league.id, {
      scheduledAt: futureSlot(8), stage: 'quarter_final',
    })
    drawMatchIncorrectId = m2.id
    const m3 = await createMatch(homeTeam.id, awayTeam.id, league.id, {
      scheduledAt: futureSlot(9), stage: 'semi_final',
    })
    decisiveMatchId = m3.id

    // Tippek: a felhasználó a döntetlen-esetén-továbbjutót megadja.
    await createPrediction(drawMatchCorrectId, 1, 1, undefined, 'penalties_home')
    await createPrediction(drawMatchIncorrectId, 0, 0, undefined, 'extra_time_away')
    await createPrediction(decisiveMatchId, 1, 1, undefined, 'penalties_home')

    // A meccseket finished + múltbeli időpontra állítjuk, hogy a kiértékelés lefuthasson.
    await updateMatch(drawMatchCorrectId, { scheduledAt: '2020-01-01T12:00:00.000Z', status: 'finished' })
    await updateMatch(drawMatchIncorrectId, { scheduledAt: '2020-01-02T12:00:00.000Z', status: 'finished' })
    await updateMatch(decisiveMatchId, { scheduledAt: '2020-01-03T12:00:00.000Z', status: 'finished' })

    // Eredmények rögzítése (admin)
    await setMatchResult(drawMatchCorrectId, 1, 1, undefined, 'penalties_home')
    await setMatchResult(drawMatchIncorrectId, 0, 0, undefined, 'penalties_home')  // tipp = away, actual = home → incorrect
    await setMatchResult(decisiveMatchId, 2, 1)  // nem döntetlen
  })

  test('correct outcomeAfterDraw tip → green badge with bonus on own + others list', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${drawMatchCorrectId}`)

    const ownBadge = page.getByTestId('own-outcome-after-draw').getByTestId('outcome-after-draw-badge')
    await expect(ownBadge).toBeVisible({ timeout: 5000 })
    await expect(ownBadge).toHaveAttribute('data-status', 'correct')
    await expect(ownBadge).toContainText(homeTeamName)
    await expect(ownBadge).toContainText(`+${extraTimeBonus}`)

    // A "mások tippjei" listán a saját sor is megjelenik — ott is correct badge.
    const listBadge = page.getByTestId('match-predictions-list').getByTestId('outcome-after-draw-badge').first()
    await expect(listBadge).toBeVisible()
    await expect(listBadge).toHaveAttribute('data-status', 'correct')
  })

  test('incorrect outcomeAfterDraw tip → gray "incorrect" badge with strike-through team', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${drawMatchIncorrectId}`)

    const ownBadge = page.getByTestId('own-outcome-after-draw').getByTestId('outcome-after-draw-badge')
    await expect(ownBadge).toBeVisible({ timeout: 5000 })
    await expect(ownBadge).toHaveAttribute('data-status', 'incorrect')
    await expect(ownBadge).toContainText(awayTeamName)
  })

  test('decisive (non-draw) result → badge marked "inactive"', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${decisiveMatchId}`)

    const ownBadge = page.getByTestId('own-outcome-after-draw').getByTestId('outcome-after-draw-badge')
    await expect(ownBadge).toBeVisible({ timeout: 5000 })
    await expect(ownBadge).toHaveAttribute('data-status', 'inactive')
  })
})
