import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
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
      { path: '/', component: HomeView },
      { path: '/login', component: { template: '<div>Login</div>' } },
    ],
  })
}

function mountWithUser() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAuthStore()
  store.user = {
    id: '00000000-0000-0000-0000-000000000001',
    supabaseId: '00000000-0000-0000-0000-000000000001',
    email: 'dev@local',
    displayName: 'Dev User',
    avatarUrl: null,
    role: 'admin',
  }
  return mount(HomeView, { global: { plugins: [pinia, buildRouter()] } })
}

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
  })

  it('renders the page header', () => {
    const wrapper = mountWithUser()
    expect(wrapper.text()).toContain('VB Tippjáték')
  })

  it('renders the logged-in user name', () => {
    const wrapper = mountWithUser()
    expect(wrapper.text()).toContain('Dev User')
  })

  it('logout button is visible', () => {
    const wrapper = mountWithUser()
    expect(wrapper.find('button').text()).toBe('Kijelentkezés')
  })

  it('clicking logout button calls logout()', async () => {
    const wrapper = mountWithUser()
    const store = useAuthStore()
    const logoutSpy = vi.spyOn(store, 'logout').mockResolvedValue(undefined)
    await wrapper.find('button').trigger('click')
    expect(logoutSpy).toHaveBeenCalledOnce()
  })

  it('clicking logout button navigates to login page', async () => {
    const wrapper = mountWithUser()
    await wrapper.find('button').trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('admin user → Admin – Csapatok link visible', () => {
    const wrapper = mountWithUser()
    expect(wrapper.text()).toContain('Admin – Csapatok')
  })

  it('non-admin user → Admin – Csapatok link hidden', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useAuthStore()
    store.user = {
      id: '00000000-0000-0000-0000-000000000002',
      supabaseId: '00000000-0000-0000-0000-000000000002',
      email: 'user@local',
      displayName: 'Regular User',
      avatarUrl: null,
      role: 'user',
    }
    const wrapper = mount(HomeView, { global: { plugins: [pinia, buildRouter()] } })
    expect(wrapper.text()).not.toContain('Admin – Csapatok')
  })
})
