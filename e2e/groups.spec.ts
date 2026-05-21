import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser, createLeague, createGroup } from './helpers/api.js'

let leagueId: string

test.describe('Groups', () => {
  test.beforeAll(async () => {
    await ensureUser()
    const league = await createLeague(`E2E Group League ${Date.now()}`)
    leagueId = league.id
  })

  test('create group shows it in the list', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/groups')

    await expect(page.getByTestId('spinner')).toHaveCount(0, { timeout: 10000 })

    await page.getByTestId('create-group-btn').first().click()
    const groupName = `Test Group ${Date.now()}`
    await page.getByTestId('create-name-input').fill(groupName)

    const leagueSelect = page.getByTestId('league-select').locator('select')
    if (await leagueSelect.isVisible()) {
      await leagueSelect.selectOption({ index: 1 })
    }

    await page.getByTestId('create-submit-btn').click()

    await expect(page.getByText(groupName)).toBeVisible({ timeout: 5000 })
  })

  test('join group with own invite code shows already member error', async ({ page }) => {
    const group = await createGroup(`Joinable Group ${Date.now()}`, leagueId)

    await injectSession(page)
    await page.goto('/app/groups')

    await page.getByTestId('join-group-btn').click()
    await page.getByTestId('join-code-input').fill(group.inviteCode)
    await page.getByTestId('join-submit-btn').click()

    await expect(page.getByTestId('join-error')).toBeVisible({ timeout: 5000 })
  })

  test('join group with invalid code shows error', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/groups')

    await page.getByTestId('join-group-btn').click()
    await page.getByTestId('join-code-input').fill('INVALIDX')
    await page.getByTestId('join-submit-btn').click()

    await expect(page.getByTestId('join-error')).toBeVisible({ timeout: 5000 })
  })
})
