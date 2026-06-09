import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth.store'
import { buildTestRouter } from '@/test-utils/router'

const mockPush = vi.fn().mockResolvedValue(undefined)
const mockRoute = { query: {} as Record<string, unknown> }
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
    useRoute: () => mockRoute,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: vi.fn() },
  },
}))

function buildRouter() {
  return buildTestRouter({ '/login': LoginView })
}

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
    mockRoute.query = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the page title', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    expect(wrapper.text()).toContain('VB Tippjáték')
  })

  it('login form is shown by default', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    expect(wrapper.find('button[type="submit"]').text()).toContain('Bejelentkezés')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('clicking "Regisztrálj" link shows register form', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    await wrapper.find('a').trigger('click')
    expect(wrapper.find('button[type="submit"]').text()).toContain('Regisztráció')
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
  })

  it('login submit → loginWithEmail() called with correct data', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    const spy = vi.spyOn(store, 'loginWithEmail').mockResolvedValue(undefined)

    await wrapper.find('input[type="email"]').setValue('user@example.com')
    await wrapper.find('input[type="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')

    expect(spy).toHaveBeenCalledWith('user@example.com', 'password123')
  })

  it('register submit → registerWithEmail() called with correct data', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    const spy = vi.spyOn(store, 'registerWithEmail').mockResolvedValue(undefined)

    await wrapper.find('a').trigger('click')
    await wrapper.find('input[type="text"]').setValue('New User')
    await wrapper.find('input[type="email"]').setValue('new@example.com')
    await wrapper.find('input[type="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')

    expect(spy).toHaveBeenCalledWith('new@example.com', 'password123', 'New User')
  })

  it('loginWithEmail() error → errorMessage shown in DOM', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    vi.spyOn(store, 'loginWithEmail').mockRejectedValue(new Error('Invalid credentials'))

    await wrapper.find('input[type="email"]').setValue('bad@example.com')
    await wrapper.find('input[type="password"]').setValue('wrong')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Invalid credentials')
  })

  it('does not render a Google sign-in option', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    expect(wrapper.text()).not.toContain('Google')
  })

  it('after successful login the store user is set', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    vi.spyOn(store, 'loginWithEmail').mockImplementation(async () => {
      store.user = {
        id: '00000000-0000-0000-0000-000000000001',
        supabaseId: '00000000-0000-0000-0000-000000000001',
        email: 'dev@local',
        displayName: 'Dev User',
        avatarUrl: null,
        role: 'admin',
        preferredLocale: 'hu',
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
        isSupporter: false,
      }
    })
    await wrapper.find('input[type="email"]').setValue('dev@local')
    await wrapper.find('input[type="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')
    expect(store.isAuthenticated()).toBe(true)
  })

  it('login submit with redirect=/app/join/CODE → savePendingInviteCode("CODE") called', async () => {
    mockRoute.query = { redirect: '/app/join/ABC123' }
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    vi.spyOn(store, 'loginWithEmail').mockResolvedValue(undefined)
    const saveSpy = vi.spyOn(store, 'savePendingInviteCode')

    await wrapper.find('input[type="email"]').setValue('user@example.com')
    await wrapper.find('input[type="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')

    expect(saveSpy).toHaveBeenCalledWith('ABC123')
  })

  it('login submit without invite redirect → savePendingInviteCode NOT called', async () => {
    mockRoute.query = {}
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    vi.spyOn(store, 'loginWithEmail').mockResolvedValue(undefined)
    const saveSpy = vi.spyOn(store, 'savePendingInviteCode')

    await wrapper.find('input[type="email"]').setValue('user@example.com')
    await wrapper.find('input[type="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')

    expect(saveSpy).not.toHaveBeenCalled()
  })
})
