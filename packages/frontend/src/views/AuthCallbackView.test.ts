import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AuthCallbackView from '@/views/AuthCallbackView.vue'

const mockPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

const { mockGetSession, mockOnAuthStateChange, mockHandleSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockHandleSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: null,
      isAuthenticated: () => false,
      handleSession: mockHandleSession,
    }),
  }
})

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/callback', component: AuthCallbackView },
      { path: '/', component: { template: '<div>Home</div>' } },
    ],
  })
}

describe('AuthCallbackView', () => {
  beforeEach(() => {
    mockPush.mockReset().mockResolvedValue(undefined)
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
    mockHandleSession.mockReset().mockResolvedValue(undefined)
    setActivePinia(createPinia())
  })

  it('onAuthStateChange session → handleSession hívva, navigál /', async () => {
    const mockSession = { access_token: 'tok', user: { id: 'uid' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_IN', mockSession)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockHandleSession).toHaveBeenCalledWith(mockSession)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('getSession session megvan (fallback) → handleSession hívva, navigál /', async () => {
    const mockSession = { access_token: 'tok2', user: { id: 'uid2' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
    mockGetSession.mockResolvedValue({ data: { session: mockSession } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockHandleSession).toHaveBeenCalledWith(mockSession)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('nincs session → handleSession nem hívva, navigál /', async () => {
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_OUT', null)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockHandleSession).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})
