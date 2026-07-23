import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import {
  ensureUser,
  deleteMyGroupsByLeagueShortName,
  ensureGroupInLeague,
  getLeagueByShortName,
  createGlobalSpecialType,
  deactivateGlobalSpecialType,
} from './helpers/api.js'

const FUTURE_DEADLINE = '2099-07-01T00:00:00.000Z'

let wcLeagueId: string
let typeId: string

test.describe('Tournament tips', () => {
  test.beforeAll(async () => {
    await ensureUser()
    const wc = await getLeagueByShortName('VB')
    if (!wc) throw new Error('VB league not seeded — check migrations')
    wcLeagueId = wc.id

    const type = await createGlobalSpecialType({
      name: `E2E Top scorer count ${Date.now()}`,
      description: 'How many goals will the top scorer score?',
      inputType: 'dropdown',
      options: ['5', '6', '7+'],
      deadline: FUTURE_DEADLINE,
      points: 10,
    })
    typeId = type.id
  })

  test.afterAll(async () => {
    if (typeId) await deactivateGlobalSpecialType(typeId)
  })

  test('nav link is visible when user has a WC group', async ({ page }) => {
    await ensureGroupInLeague(`E2E WC Group ${Date.now()}`, wcLeagueId)

    await injectSession(page)
    await page.goto('/app/matches')
    await expect(page.getByTestId('nav-tournament-tips')).toBeVisible()
  })

  test('US-954: hides nav link and redirects to matches when user has no WC group', async ({ page }) => {
    await deleteMyGroupsByLeagueShortName('VB')

    await injectSession(page)
    await page.goto('/app/matches')

    await expect(page.getByTestId('nav-tournament-tips')).toHaveCount(0)

    await page.goto('/app/tournament-tips')
    await expect(page).toHaveURL(/\/app\/matches$/, { timeout: 5000 })
    await expect(page.getByTestId('tournament-tips-list')).toHaveCount(0)
  })

  test('shows tip list when user has a WC group', async ({ page }) => {
    await ensureGroupInLeague(`E2E WC Group ${Date.now()}`, wcLeagueId)

    await injectSession(page)
    await page.goto('/app/tournament-tips')

    await expect(page.getByTestId('tournament-tips-list')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('tournament-tips-tab-other').click()
    await expect(page.getByTestId(`tournament-tip-${typeId}`)).toBeVisible()
  })

  test('user can submit a tip', async ({ page }) => {
    await ensureGroupInLeague(`E2E WC Group ${Date.now()}`, wcLeagueId)

    await injectSession(page)
    await page.goto('/app/tournament-tips')

    await page.getByTestId('tournament-tips-tab-other').click()
    const card = page.getByTestId(`tournament-tip-${typeId}`)
    await expect(card).toBeVisible({ timeout: 5000 })

    await card.locator('select').selectOption('6')
    await expect(card.getByText(/Mentve|Saved/)).toBeVisible({ timeout: 5000 })

    await page.reload()
    await page.getByTestId('tournament-tips-tab-other').click()
    await expect(card.locator('select')).toHaveValue('6', { timeout: 5000 })
  })
})
