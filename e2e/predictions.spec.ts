import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser, createLeague, createTeam, createMatch, createPlayer } from './helpers/api.js'

let matchId: string
let finishedMatchId: string
let scorerMatchId: string
let homePlayerName: string
let awayPlayerName: string

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

    // SCORER-002: dedicated match with rosters for scorer pick
    const scorerMatch = await createMatch(homeTeam.id, awayTeam.id, league.id)
    scorerMatchId = scorerMatch.id
    homePlayerName = `Home Striker ${suffix}`
    awayPlayerName = `Away Striker ${suffix}`
    await createPlayer({ name: homePlayerName, teamId: homeTeam.id, position: 'Attacker', shirtNumber: 9 })
    await createPlayer({ name: awayPlayerName, teamId: awayTeam.id, position: 'Attacker', shirtNumber: 10 })
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

  test('SCORER-002: scorer pick row visible on match detail', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${scorerMatchId}`)

    await expect(page.getByTestId('scorer-pick-row')).toBeVisible({ timeout: 5000 })
  })

  test('SCORER-002: pick scorer + goals → save success', async ({ page }) => {
    await injectSession(page)
    await page.goto(`/app/matches/${scorerMatchId}`)

    await page.getByTestId('input-home').fill('1')
    await page.getByTestId('input-away').fill('0')

    const scorerInput = page.getByTestId('scorer-pick-row').locator('input')
    await scorerInput.click()
    await scorerInput.fill(homePlayerName)
    await page.getByRole('group').getByText(homePlayerName).first().click()

    await expect(page.getByTestId('save-success')).toBeVisible({ timeout: 5000 })
  })
})
