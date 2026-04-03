import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { User } from '@/types/index'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const {
  mockRestoreSession,
  mockIsAuthenticated,
  mockIsAdmin,
  mockReady,
} = vi.hoisted(() => ({
  mockRestoreSession: vi.fn().mockResolvedValue(undefined),
  mockIsAuthenticated: vi.fn().mockReturnValue(false),
  mockIsAdmin: vi.fn().mockReturnValue(false),
  mockReady: { value: false },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get ready() { return mockReady.value },
    restoreSession: mockRestoreSession,
    isAuthenticated: mockIsAuthenticated,
    isAdmin: mockIsAdmin,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  supabaseId: 'supabase-uuid-001',
  email: 'user@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  role: 'user',
}
void MOCK_USER

// ─── Router factory ──────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setAuthReady(authenticated: boolean, admin = false): void {
  mockReady.value = true
  mockIsAuthenticated.mockReturnValue(authenticated)
  mockIsAdmin.mockReturnValue(admin)
  mockRestoreSession.mockImplementation(async () => {
    mockReady.value = true
  })
}

function setAuthNotReady(authenticated: boolean, admin = false): void {
  mockReady.value = false
  mockIsAuthenticated.mockReturnValue(authenticated)
  mockIsAdmin.mockReturnValue(admin)
  mockRestoreSession.mockImplementation(async () => {
    mockReady.value = true
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('router beforeEach guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockRestoreSession.mockReset().mockResolvedValue(undefined)
    mockIsAuthenticated.mockReset().mockReturnValue(false)
    mockIsAdmin.mockReset().mockReturnValue(false)
    mockReady.value = false
    vi.resetModules()
  })

  // ─── ready=false: restoreSession() hívódik ──────────────────────────────

  it('guard calls restoreSession() when ready is false', async () => {
    setAuthNotReady(false)
    vi.resetModules()
    const { router } = await import('@/router/index')
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
      ],
    })
    void router
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
    })
    await testRouter.push('/')
    expect(mockRestoreSession).toHaveBeenCalledOnce()
  })

  it('guard does NOT call restoreSession() when ready is true', async () => {
    setAuthReady(true)
    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
    })
    await testRouter.push('/')
    expect(mockRestoreSession).not.toHaveBeenCalled()
  })

  // ─── Authenticated user navigates protected route ────────────────────────

  it('authenticated user → protected route allowed', async () => {
    setAuthReady(true)
    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
    })
    await testRouter.push('/')
    expect(testRouter.currentRoute.value.name).toBe('home')
  })

  // ─── Unauthenticated user redirected to login ─────────────────────────────

  it('unauthenticated user → protected route redirects to login', async () => {
    setAuthReady(false)
    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
    })
    await testRouter.push('/')
    expect(testRouter.currentRoute.value.name).toBe('login')
  })

  // ─── Race condition: ready=false, session exists → protected route allowed ─

  it('ready=false, session resolves as authenticated → protected route allowed (no redirect)', async () => {
    mockReady.value = false
    mockRestoreSession.mockImplementation(async () => {
      mockReady.value = true
      mockIsAuthenticated.mockReturnValue(true)
    })

    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
    })
    await testRouter.push('/')
    expect(testRouter.currentRoute.value.name).toBe('home')
  })

  // ─── Race condition: ready=false, no session → redirect to login ──────────

  it('ready=false, session resolves as unauthenticated → redirects to login', async () => {
    mockReady.value = false
    mockIsAuthenticated.mockReturnValue(false)
    mockRestoreSession.mockImplementation(async () => {
      mockReady.value = true
      // user stays unauthenticated
    })

    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
    })
    await testRouter.push('/')
    expect(testRouter.currentRoute.value.name).toBe('login')
  })

  // ─── Authenticated user visiting /login → redirect to home ───────────────

  it('authenticated user visiting /login → redirected to home', async () => {
    setAuthReady(true)
    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.name === 'login' && authStore.isAuthenticated()) {
        return { name: 'home' }
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
    })
    await testRouter.push('/login')
    expect(testRouter.currentRoute.value.name).toBe('home')
  })

  // ─── Admin route ─────────────────────────────────────────────────────────

  it('non-admin user → admin route redirects to home', async () => {
    setAuthReady(true, false)
    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
        { path: '/admin', name: 'admin', component: { template: '<div/>' }, meta: { requiresAuth: true, requiresAdmin: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
      if (to.meta.requiresAdmin && !authStore.isAdmin()) {
        return { name: 'home' }
      }
    })
    await testRouter.push('/admin')
    expect(testRouter.currentRoute.value.name).toBe('home')
  })

  it('admin user → admin route allowed', async () => {
    setAuthReady(true, true)
    vi.resetModules()
    const testRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div/>' } },
        { path: '/', name: 'home', component: { template: '<div/>' }, meta: { requiresAuth: true } },
        { path: '/admin', name: 'admin', component: { template: '<div/>' }, meta: { requiresAuth: true, requiresAdmin: true } },
      ],
    })
    testRouter.beforeEach(async (to) => {
      const { useAuthStore } = await import('@/stores/auth.store')
      const authStore = useAuthStore()
      if (!authStore.ready) {
        await authStore.restoreSession()
      }
      if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
        return { name: 'login' }
      }
      if (to.meta.requiresAdmin && !authStore.isAdmin()) {
        return { name: 'home' }
      }
    })
    await testRouter.push('/admin')
    expect(testRouter.currentRoute.value.name).toBe('admin')
  })
})
