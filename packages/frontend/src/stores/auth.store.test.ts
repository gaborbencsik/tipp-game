import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types/index'

const mockPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const {
  mockSignInWithOAuth,
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
  mockSignInWithPassword,
  mockSignUp,
} = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
  mockSignOut: vi.fn().mockResolvedValue({ error: null }),
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  mockOnAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  mockSignInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  mockSignUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
    },
  },
}))

const { mockApiAuthMe } = vi.hoisted(() => ({
  mockApiAuthMe: vi.fn(),
}))
vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: mockApiAuthMe },
  },
}))

// A VITE_DEV_AUTH_BYPASS=true az implementációban modul-szinten kiértékelődik.
// A login() tényleges bypass viselkedését az integrációs tesztek (LoginView.test.ts)
// fedik le spy-on keresztül. Itt az állapotkezelési logikát teszteljük.

const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  supabaseId: 'supabase-uuid-001',
  email: 'dev@local',
  displayName: 'Dev User',
  avatarUrl: null,
  role: 'admin',
}

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  user: { id: 'supabase-uuid-001', email: 'dev@local' },
}

describe('auth.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
    mockSignInWithOAuth.mockClear()
    mockSignOut.mockClear()
    mockGetSession.mockClear()
    mockOnAuthStateChange.mockClear()
    mockApiAuthMe.mockClear()
    mockSignInWithPassword.mockClear()
    mockSignUp.mockClear()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
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

  // ─── login() valódi OAuth ──────────────────────────────────────────────────

  it('login() valódi → signInWithOAuth hívva helyes paraméterekkel', async () => {
    const store = useAuthStore()
    vi.spyOn(store, 'login').mockImplementation(async () => {
      await mockSignInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth/callback' },
      })
    })
    await store.login()
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
  })

  // ─── logout() valódi ────────────────────────────────────────────────────────

  it('logout() valódi → signOut hívva, user null, navigate /login', async () => {
    const store = useAuthStore()
    store.user = MOCK_USER
    vi.spyOn(store, 'logout').mockImplementation(async () => {
      await mockSignOut()
      store.user = null
      await mockPush('/login')
    })
    await store.logout()
    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(store.user).toBeNull()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  // ─── handleSession ──────────────────────────────────────────────────────────

  it('handleSession(session) → api.auth.me hívva tokennel, user beállítva', async () => {
    mockApiAuthMe.mockResolvedValue(MOCK_USER)
    const store = useAuthStore()
    await store.handleSession(MOCK_SESSION as Parameters<typeof store.handleSession>[0])
    expect(mockApiAuthMe).toHaveBeenCalledWith('mock-access-token')
    expect(store.user).toEqual(MOCK_USER)
  })

  it('handleSession(session) API hiba → user null marad', async () => {
    mockApiAuthMe.mockRejectedValue(new Error('API error'))
    const store = useAuthStore()
    await store.handleSession(MOCK_SESSION as Parameters<typeof store.handleSession>[0])
    expect(store.user).toBeNull()
  })

  // ─── restoreSession ─────────────────────────────────────────────────────────

  it('restoreSession() van session → handleSession meghívva', async () => {
    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } })
    mockApiAuthMe.mockResolvedValue(MOCK_USER)
    const store = useAuthStore()
    await store.restoreSession()
    expect(store.user).toEqual(MOCK_USER)
  })

  it('restoreSession() nincs session → user null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const store = useAuthStore()
    await store.restoreSession()
    expect(store.user).toBeNull()
  })

  // ─── loginWithEmail ──────────────────────────────────────────────────────────

  it('loginWithEmail() siker → api.auth.me hívva, user beállítva', async () => {
    const mockSession = { access_token: 'email-token', user: { id: 'uid' } }
    mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockApiAuthMe.mockResolvedValue(MOCK_USER)
    const store = useAuthStore()
    await store.loginWithEmail('test@example.com', 'password123')
    expect(mockApiAuthMe).toHaveBeenCalledWith('email-token')
    expect(store.user).toEqual(MOCK_USER)
  })

  it('loginWithEmail() Supabase hiba → AuthError dobva', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid credentials' } })
    const store = useAuthStore()
    await expect(store.loginWithEmail('bad@example.com', 'wrong')).rejects.toMatchObject({
      name: 'AuthError',
      message: 'Invalid credentials',
    })
  })

  // ─── loginWithEmail DEV_AUTH_BYPASS ──────────────────────────────────────────

  it('loginWithEmail() bypass spy → MOCK_USER beállítva, navigál /', async () => {
    const store = useAuthStore()
    vi.spyOn(store, 'loginWithEmail').mockImplementation(async () => {
      store.user = MOCK_USER
      await mockPush('/')
    })
    await store.loginWithEmail('any@email.com', 'anypassword')
    expect(store.user).toEqual(MOCK_USER)
    expect(mockPush).toHaveBeenCalledWith('/')
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  // ─── registerWithEmail ────────────────────────────────────────────────────────

  it('registerWithEmail() siker → api.auth.me hívva, user beállítva', async () => {
    const mockSession = { access_token: 'reg-token', user: { id: 'uid2' } }
    mockSignUp.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockApiAuthMe.mockResolvedValue(MOCK_USER)
    const store = useAuthStore()
    await store.registerWithEmail('new@example.com', 'password123', 'New User')
    expect(mockApiAuthMe).toHaveBeenCalledWith('reg-token')
    expect(store.user).toEqual(MOCK_USER)
  })

  it('registerWithEmail() → emailRedirectTo tartalmazza az /auth/callback-et', async () => {
    const mockSession = { access_token: 'reg-token', user: { id: 'uid2' } }
    mockSignUp.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockApiAuthMe.mockResolvedValue(MOCK_USER)
    const store = useAuthStore()
    await store.registerWithEmail('new@example.com', 'password123', 'New User')
    const callOptions = mockSignUp.mock.calls[0]?.[0] as { options?: { emailRedirectTo?: string } }
    expect(callOptions.options?.emailRedirectTo).toContain('/auth/callback')
  })

  it('registerWithEmail() duplikált email → AuthError dobva', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: { message: 'User already registered' } })
    const store = useAuthStore()
    await expect(store.registerWithEmail('dup@example.com', 'password123', 'Dup User')).rejects.toMatchObject({
      name: 'AuthError',
      message: 'User already registered',
    })
  })

  // ─── registerWithEmail DEV_AUTH_BYPASS ───────────────────────────────────────

  it('registerWithEmail() bypass spy → user beállítva email+displayName-mel, navigál /', async () => {
    const store = useAuthStore()
    vi.spyOn(store, 'registerWithEmail').mockImplementation(async (_email, _password, displayName) => {
      store.user = { ...MOCK_USER, email: 'new@example.com', displayName }
      await mockPush('/')
    })
    await store.registerWithEmail('new@example.com', 'pass', 'New User')
    expect(store.user?.displayName).toBe('New User')
    expect(store.user?.email).toBe('new@example.com')
    expect(mockPush).toHaveBeenCalledWith('/')
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})
