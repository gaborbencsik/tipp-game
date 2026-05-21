import type { Page } from '@playwright/test'
import { ensureUser } from './api.js'

const DEV_SESSION_BASE = {
  email: 'admin@dev.local',
  displayName: 'Dev User',
  avatarUrl: null,
  role: 'admin',
  preferredLocale: 'hu',
  onboardingCompletedAt: '2020-01-01T00:00:00.000Z',
}

export async function injectSession(page: Page): Promise<void> {
  const dbUser = await ensureUser()
  const session = {
    user: {
      ...DEV_SESSION_BASE,
      id: dbUser.id,
      supabaseId: dbUser.supabaseId,
    },
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
  }
  await page.addInitScript((s) => {
    window.sessionStorage.setItem('dev_session', JSON.stringify(s))
  }, session)
}

export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('Email cím').fill('admin@dev.local')
  await page.getByPlaceholder('Jelszó').fill('password123')
  await page.getByRole('button', { name: 'Bejelentkezés', exact: true }).click()
  await page.waitForURL('**/app/matches')
}
