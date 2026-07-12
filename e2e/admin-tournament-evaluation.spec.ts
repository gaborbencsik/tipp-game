import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser, createGlobalSpecialType, deactivateGlobalSpecialType } from './helpers/api.js'

const BASE = process.env['API_URL'] ?? 'http://localhost:3000'
const ADMIN_HEADERS = {
  Authorization: 'Bearer dev-bypass-token',
  'Content-Type': 'application/json',
}

interface SpecialPredictionType {
  readonly id: string
  readonly correctAnswer: string | null
  readonly isActive: boolean
}

async function getGlobalType(typeId: string): Promise<SpecialPredictionType> {
  const res = await fetch(`${BASE}/api/admin/global-special-types`, { headers: ADMIN_HEADERS })
  if (!res.ok) throw new Error(`list global-special-types failed: ${res.status}`)
  const all = (await res.json()) as SpecialPredictionType[]
  const found = all.find(t => t.id === typeId)
  if (!found) throw new Error(`type ${typeId} not found`)
  return found
}

test.describe('Admin tournament evaluation (US-1311)', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('admin sets correct answer → triggers evaluation → backend persists answer and audits run', async ({ page }) => {
    // Arrange: create a unique text-typed global type so the test is repeatable.
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const typeName = `E2E tournament top scorer ${Date.now()}`
    const created = await createGlobalSpecialType({
      name: typeName,
      inputType: 'text',
      deadline,
      points: 7,
    })
    const typeId = created.id

    try {
      await injectSession(page)
      await page.goto('/admin/tournament-evaluation')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { name: 'Torna-tipp kiértékelés' })).toBeVisible()

      await expect(page.getByRole('heading', { name: 'Torna-tipp kiértékelés' })).toBeVisible()

      const card = page.locator(`[data-testid="tournament-evaluation-type"][data-type-id="${typeId}"]`)
      await expect(card).toBeVisible()
      await expect(card).toContainText(typeName)
      await expect(card).toContainText('Nincs helyes válasz')

      // UX-037: type the answer, click "Hozzáadás" so the chip lands in the list, then save.
      await card.locator('input[type="text"]').fill('Messi')
      await card.getByRole('button', { name: 'Hozzáadás' }).click()
      await expect(card.locator(`[data-testid="chips-${typeId}"]`)).toContainText('Messi')

      const evalResponse = page.waitForResponse(
        r => r.url().includes(`/api/admin/global-special-types/${typeId}/evaluate`)
          && r.request().method() === 'POST'
          && r.status() === 200,
      )
      const patchResponse = page.waitForResponse(
        r => r.url().includes(`/api/admin/global-special-types/${typeId}/correct-answer`)
          && r.request().method() === 'PATCH'
          && r.status() === 200,
      )

      await card.getByRole('button', { name: 'Mentés és kiértékelés' }).click()

      await patchResponse
      await evalResponse

      // Success toast appears with the evaluation summary.
      const toast = page.getByTestId('toast-success')
      await expect(toast).toBeVisible()
      await expect(toast).toContainText(/\d+ felhasználó · \d+ pont/)

      // Backend persisted the correct answer.
      const after = await getGlobalType(typeId)
      expect(after.correctAnswer).toBe('Messi')
    } finally {
      await deactivateGlobalSpecialType(typeId)
    }
  })
})
