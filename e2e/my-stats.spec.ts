import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import {
  ensureUser,
  createLeague,
  createTeam,
  createMatch,
  createPrediction,
  ensureGroupInLeague,
} from './helpers/api.js'

let leagueAId: string
let leagueBId: string

test.describe('My Stats', () => {
  test.beforeAll(async () => {
    await ensureUser()

    const stamp = Date.now()
    const suffix = String(stamp).slice(-3)

    const leagueA = await createLeague(`E2E Stats League A ${stamp}`)
    const leagueB = await createLeague(`E2E Stats League B ${stamp}`)
    leagueAId = leagueA.id
    leagueBId = leagueB.id
    await ensureGroupInLeague(`Stats Group A ${stamp}`, leagueAId)
    await ensureGroupInLeague(`Stats Group B ${stamp}`, leagueBId)

    const homeTeam = await createTeam(`Stats Home ${stamp}`, `S${suffix}`)
    const awayTeam = await createTeam(`Stats Away ${stamp}`, `T${suffix}`)
    const match = await createMatch(homeTeam.id, awayTeam.id, leagueAId)
    await createPrediction(match.id, 2, 1)
  })

  test('page renders with title and KPI cards', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/my-tips')

    await expect(page.getByRole('heading', { name: /Statisztikáim|My Stats/ })).toBeVisible()
    await expect(page.getByTestId('filter-chip-all')).toBeVisible({ timeout: 10000 })
  })

  test('league filter is visible when user has 2+ leagues', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/my-tips')

    const leagueFilter = page.getByTestId('league-filter')
    await expect(leagueFilter).toBeVisible({ timeout: 10000 })

    const optionCount = await leagueFilter.locator('option').count()
    expect(optionCount).toBeGreaterThanOrEqual(3)
  })

  test('selecting a league narrows the prediction list', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/my-tips')

    await expect(page.getByTestId('filter-chip-all')).toBeVisible({ timeout: 10000 })

    const leagueFilter = page.getByTestId('league-filter')
    await leagueFilter.selectOption(leagueAId)
    await expect(page.getByTestId('prediction-item').first()).toBeVisible({ timeout: 5000 })

    const countA = await page.getByTestId('prediction-item').count()

    await leagueFilter.selectOption(leagueBId)
    await page.waitForTimeout(200)
    const countB = await page.getByTestId('prediction-item').count()

    expect(countA).toBeGreaterThan(countB)
  })

  test('filter chips switch the visible list', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/my-tips')

    await expect(page.getByTestId('filter-chip-all')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('league-filter').selectOption(leagueAId)
    await expect(page.getByTestId('prediction-item').first()).toBeVisible({ timeout: 5000 })

    await page.getByTestId('filter-chip-correct').click()
    await expect(page.getByTestId('filter-chip-correct')).toHaveClass(/bg-blue-600/)

    await page.getByTestId('filter-chip-all').click()
    await expect(page.getByTestId('prediction-item').first()).toBeVisible()
  })
})
