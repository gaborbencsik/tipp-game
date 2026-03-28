import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types/index'

const mockPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// A VITE_DEV_AUTH_BYPASS=true az implementációban modul-szinten kiértékelődik.
// A login() tényleges bypass viselkedését az integrációs tesztek (LoginView.test.ts)
// fedik le spy-on keresztül. Itt az állapotkezelési logikát teszteljük.

const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@local',
  displayName: 'Dev User',
  avatarUrl: null,
  role: 'admin',
}

describe('auth.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Alapállapot ───────────────────────────────────────────────────────────

  it('kezdetben nincs bejelentkezett user', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
  })

  it('isAuthenticated() false ha nincs user', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated()).toBe(false)
  })

  // ─── User állítás után ─────────────────────────────────────────────────────

  it('isAuthenticated() true ha user be van állítva', () => {
    const store = useAuthStore()
    store.user = MOCK_USER
    expect(store.isAuthenticated()).toBe(true)
  })

  it('user mezői helyesek', () => {
    const store = useAuthStore()
    store.user = MOCK_USER
    expect(store.user?.id).toBe('00000000-0000-0000-0000-000000000001')
    expect(store.user?.email).toBe('dev@local')
    expect(store.user?.displayName).toBe('Dev User')
    expect(store.user?.avatarUrl).toBeNull()
    expect(store.user?.role).toBe('admin')
  })

  // ─── logout ────────────────────────────────────────────────────────────────

  it('logout() törli a usert', async () => {
    const store = useAuthStore()
    store.user = MOCK_USER
    await store.logout()
    expect(store.user).toBeNull()
  })

  it('logout() navigál a login oldalra', async () => {
    const store = useAuthStore()
    store.user = MOCK_USER
    await store.logout()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('logout() után isAuthenticated() false', async () => {
    const store = useAuthStore()
    store.user = MOCK_USER
    await store.logout()
    expect(store.isAuthenticated()).toBe(false)
  })

  // ─── login bypass tesztelése spy-on keresztül ──────────────────────────────

  it('login() beállítja a usert és navigál (spy-on keresztül)', async () => {
    const store = useAuthStore()
    vi.spyOn(store, 'login').mockImplementation(async () => {
      store.user = MOCK_USER
      await mockPush('/')
    })
    await store.login()
    expect(store.user).toEqual(MOCK_USER)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('login() után isAuthenticated() true (spy-on keresztül)', async () => {
    const store = useAuthStore()
    vi.spyOn(store, 'login').mockImplementation(async () => {
      store.user = MOCK_USER
    })
    await store.login()
    expect(store.isAuthenticated()).toBe(true)
  })
})
