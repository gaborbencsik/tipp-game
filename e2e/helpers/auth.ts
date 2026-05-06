import type { Page } from '@playwright/test'

const DEV_SESSION = {
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    supabaseId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dev.local',
    displayName: 'Dev User',
    avatarUrl: null,
    role: 'admin',
    onboardingCompletedAt: '2020-01-01T00:00:00.000Z',
  },
  expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
}

export async function injectSession(page: Page): Promise<void> {
  await page.addInitScript((session) => {
    window.sessionStorage.setItem('dev_session', JSON.stringify(session))
  }, DEV_SESSION)
}

export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('Email cím').fill('admin@dev.local')
  await page.getByPlaceholder('Jelszó').fill('password123')
  await page.getByRole('button', { name: 'Bejelentkezés', exact: true }).click()
  await page.waitForURL('**/app/matches')
}
