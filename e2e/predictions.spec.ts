import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser, createLeague, createTeam, createMatch } from './helpers/api.js'

let matchId: string
let finishedMatchId: string

test.describe('Predictions', () => {
  test.beforeAll(async () => {
    await ensureUser()
    const suffix = String(Date.now()).slice(-3)
    const league = await createLeague(`E2E League ${Date.now()}`)
    const homeTeam = await createTeam(`Home ${Date.now()}`, `H${suffix}`)
    const awayTeam = await createTeam(`Away ${Date.now()}`, `A${suffix}`)

    const match = await createMatch(homeTeam.id, awayTeam.id, league.id)
    matchId = match.id

    const finished = await createMatch(homeTeam.id, awayTeam.id, league.id, {
      scheduledAt: '2020-01-01T12:00:00.000Z',
      status: 'finished',
    })
    finishedMatchId = finished.id
  })

  test('submit prediction shows save success', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${matchId}`)

    await page.getByTestId('input-home').fill('2')
    await page.getByTestId('input-away').fill('1')

    await expect(page.getByTestId('save-success')).toBeVisible({ timeout: 5000 })
  })

  test('modify prediction shows save success again', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${matchId}`)

    await page.getByTestId('input-home').fill('3')
    await page.getByTestId('input-away').fill('0')

    await expect(page.getByTestId('save-success')).toBeVisible({ timeout: 5000 })
  })

  test('finished match does not show prediction inputs', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${finishedMatchId}`)

    await expect(page.getByTestId('input-home')).not.toBeVisible()
    await expect(page.getByTestId('input-away')).not.toBeVisible()
  })
})
