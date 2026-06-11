import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

const BASE = process.env['API_URL'] ?? 'http://localhost:3000'
const ADMIN_HEADERS = {
  Authorization: 'Bearer dev-bypass-token',
  'Content-Type': 'application/json',
}

interface ScoringConfigResponse {
  id: string
  name: string
  correctOutcomePoints: number
  exactBonusPoints: number
  extraTimeBonusPoints: number
  frozenAt?: string | null
}

async function getScoringConfig(): Promise<ScoringConfigResponse> {
  const res = await fetch(`${BASE}/api/admin/scoring-config`, { headers: ADMIN_HEADERS })
  if (!res.ok) throw new Error(`get scoring-config failed: ${res.status}`)
  return res.json() as Promise<ScoringConfigResponse>
}

async function putScoringConfig(input: {
  correctOutcomePoints: number
  exactBonusPoints: number
  extraTimeBonusPoints: number
}): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/scoring-config`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`put scoring-config failed: ${res.status}`)
}

async function postScoringOverride(values: {
  correctOutcomePoints: number
  exactBonusPoints: number
  extraTimeBonusPoints: number
}): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/scoring-config/override`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      values,
      reason: 'rule_change',
      recalculate: false,
    }),
  })
  if (!res.ok) throw new Error(`override scoring-config failed: ${res.status}`)
}

test.describe('Admin scoring config', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('admin form: 3 mező megjelenik, érték módosítása mentés után toast + persist', async ({ page }) => {
    const before = await getScoringConfig()
    const isFrozen = before.frozenAt !== null && before.frozenAt !== undefined
    const nextOutcome = before.correctOutcomePoints === 1 ? 2 : 1
    const nextExact = before.exactBonusPoints === 1 ? 2 : 1
    const nextET = before.extraTimeBonusPoints === 1 ? 2 : 1

    await injectSession(page)
    await page.goto('/admin/scoring')

    await expect(page.getByTestId('scoring-form')).toBeVisible()
    await expect(page.getByTestId('field-correctOutcomePoints')).toBeVisible()
    await expect(page.getByTestId('field-exactBonusPoints')).toBeVisible()
    await expect(page.getByTestId('field-extraTimeBonusPoints')).toBeVisible()

    // Wait until the watch(store.config → draft) has settled with the loaded values,
    // so our subsequent fill() isn't races against a late watch flush that would
    // overwrite the draft back to the server-side value.
    await expect(page.getByTestId('field-correctOutcomePoints')).toHaveValue(String(before.correctOutcomePoints))
    await expect(page.getByTestId('field-exactBonusPoints')).toHaveValue(String(before.exactBonusPoints))
    await expect(page.getByTestId('field-extraTimeBonusPoints')).toHaveValue(String(before.extraTimeBonusPoints))

    await page.getByTestId('field-correctOutcomePoints').fill(String(nextOutcome))
    await page.getByTestId('field-exactBonusPoints').fill(String(nextExact))
    await page.getByTestId('field-extraTimeBonusPoints').fill(String(nextET))

    // Confirm the fills landed in the DOM (and therefore in v-model.draft) before submitting.
    await expect(page.getByTestId('field-correctOutcomePoints')).toHaveValue(String(nextOutcome))
    await expect(page.getByTestId('field-exactBonusPoints')).toHaveValue(String(nextExact))
    await expect(page.getByTestId('field-extraTimeBonusPoints')).toHaveValue(String(nextET))

    if (isFrozen) {
      // Frozen: submit-btn is hidden; the admin commits via the override modal,
      // which sends the current `draft` values together with a reason.
      await expect(page.getByTestId('frozen-banner')).toBeVisible()
      await expect(page.getByTestId('submit-btn')).toHaveCount(0)
      await page.getByTestId('override-btn').click()
      await expect(page.getByTestId('override-modal')).toBeVisible()
      await page.getByTestId('override-reason').selectOption('rule_change')
      await page.getByTestId('override-recalc').uncheck()
      await page.getByTestId('override-confirm').click()
      await expect(page.getByText('Override mentve')).toBeVisible()
    } else {
      await page.getByTestId('submit-btn').click()
      await expect(page.getByText('Pontrendszer frissítve')).toBeVisible()
    }
    await expect(page.getByTestId('save-status')).toHaveText('Elmentve!')

    const after = await getScoringConfig()
    expect(after.correctOutcomePoints).toBe(nextOutcome)
    expect(after.exactBonusPoints).toBe(nextExact)
    expect(after.extraTimeBonusPoints).toBe(nextET)

    if (isFrozen) {
      await postScoringOverride({
        correctOutcomePoints: before.correctOutcomePoints,
        exactBonusPoints: before.exactBonusPoints,
        extraTimeBonusPoints: before.extraTimeBonusPoints,
      })
    } else {
      await putScoringConfig({
        correctOutcomePoints: before.correctOutcomePoints,
        exactBonusPoints: before.exactBonusPoints,
        extraTimeBonusPoints: before.extraTimeBonusPoints,
      })
    }
  })

  test('frozen állapot: ha auto-freeze érvényes, banner látszik és form letiltva', async ({ page }) => {
    const cfg = await getScoringConfig()

    await injectSession(page)
    await page.goto('/admin/scoring')

    await expect(page.getByTestId('scoring-form')).toBeVisible()

    if (cfg.frozenAt) {
      await expect(page.getByTestId('frozen-banner')).toBeVisible()
      // Inputs stay editable so the override modal can submit edited values.
      await expect(page.getByTestId('field-correctOutcomePoints')).toBeEnabled()
      await expect(page.getByTestId('submit-btn')).toHaveCount(0)
      await expect(page.getByTestId('override-btn')).toBeVisible()
    } else {
      await expect(page.getByTestId('frozen-banner')).toHaveCount(0)
      await expect(page.getByTestId('field-correctOutcomePoints')).toBeEnabled()
      await expect(page.getByTestId('submit-btn')).toBeVisible()
    }
  })
})
