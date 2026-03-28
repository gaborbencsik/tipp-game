import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth.store'

const mockPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
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
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/login', component: LoginView },
    ],
  })
}

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('megjeleníti az oldalcímet', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    expect(wrapper.text()).toContain('VB Tippjáték')
  })

  it('megjeleníti a bejelentkezés gombot', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    expect(wrapper.find('button').text()).toBe('Bejelentkezés')
  })

  it('gombkattintásra meghívja az authStore.login()-t', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    const loginSpy = vi.spyOn(store, 'login').mockResolvedValue(undefined)
    await wrapper.find('button').trigger('click')
    expect(loginSpy).toHaveBeenCalledOnce()
  })

  it('sikeres login után a store user-je be van állítva', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia(), buildRouter()] },
    })
    const store = useAuthStore()
    vi.spyOn(store, 'login').mockImplementation(async () => {
      store.user = {
        id: '00000000-0000-0000-0000-000000000001',
        supabaseId: '00000000-0000-0000-0000-000000000001',
        email: 'dev@local',
        displayName: 'Dev User',
        avatarUrl: null,
        role: 'admin',
      }
    })
    await wrapper.find('button').trigger('click')
    expect(store.isAuthenticated()).toBe(true)
  })
})
