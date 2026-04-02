import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import UserMenuButton from '@/components/UserMenuButton.vue'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: { health: vi.fn(), auth: { me: vi.fn() } },
}))

const { mockLogout } = vi.hoisted(() => ({ mockLogout: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: vi.fn(),
  }
})

import { useAuthStore } from '@/stores/auth.store'

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/profile', component: { template: '<div />' } },
      { path: '/admin/matches', component: { template: '<div />' } },
      { path: '/admin/teams', component: { template: '<div />' } },
    ],
  })
}

function mountAsAdmin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  vi.mocked(useAuthStore).mockReturnValue({
    user: { id: 'u1', supabaseId: 's1', email: 'admin@test.com', displayName: 'Admin User', avatarUrl: null, role: 'admin' },
    logout: mockLogout,
  } as unknown as ReturnType<typeof useAuthStore>)
  return mount(UserMenuButton, { global: { plugins: [pinia, buildRouter()] } })
}

function mountAsUser(overrides?: { avatarUrl?: string | null; displayName?: string }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  vi.mocked(useAuthStore).mockReturnValue({
    user: {
      id: 'u2',
      supabaseId: 's2',
      email: 'user@test.com',
      displayName: overrides?.displayName ?? 'Test User',
      avatarUrl: overrides?.avatarUrl ?? null,
      role: 'user',
    },
    logout: mockLogout,
  } as unknown as ReturnType<typeof useAuthStore>)
  return mount(UserMenuButton, { global: { plugins: [pinia, buildRouter()] } })
}

describe('UserMenuButton', () => {
  beforeEach(() => {
    mockLogout.mockClear()
    setActivePinia(createPinia())
  })

  // ─── Avatar megjelenítés ──────────────────────────────────────────────────────

  it('avatar-img látszik ha avatarUrl be van állítva', () => {
    const wrapper = mountAsUser({ avatarUrl: 'https://example.com/avatar.png' })
    expect(wrapper.find('[data-testid="avatar-img"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="avatar-initials"]').exists()).toBe(false)
  })

  it('avatar-initials látszik ha avatarUrl null', () => {
    const wrapper = mountAsUser({ avatarUrl: null })
    expect(wrapper.find('[data-testid="avatar-initials"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="avatar-img"]').exists()).toBe(false)
  })

  it('a monogram a displayName első betűje nagybetűsen', () => {
    const wrapper = mountAsUser({ displayName: 'krisztián' })
    expect(wrapper.find('[data-testid="avatar-initials"]').text()).toBe('K')
  })

  it('fallback email első betűjére ha displayName üres', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'u3', supabaseId: 's3', email: 'zoltan@test.com', displayName: '', avatarUrl: null, role: 'user' },
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuthStore>)
    const wrapper = mount(UserMenuButton, { global: { plugins: [pinia, buildRouter()] } })
    expect(wrapper.find('[data-testid="avatar-initials"]').text()).toBe('Z')
  })

  // ─── Toggle ───────────────────────────────────────────────────────────────────

  it('dropdown alapból rejtett', () => {
    const wrapper = mountAsUser()
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(false)
  })

  it('avatar gomb kattintás → dropdown megjelenik', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(true)
  })

  it('második kattintás → dropdown eltűnik (toggle)', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(true)
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(false)
  })

  // ─── Backdrop ─────────────────────────────────────────────────────────────────

  it('backdrop kattintás → dropdown bezárul', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(true)
    await wrapper.find('[data-testid="user-menu-backdrop"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(false)
  })

  // ─── Admin láthatóság ─────────────────────────────────────────────────────────

  it('nem-admin usernél admin linkek hiányoznak', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-admin-matches"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-admin-teams"]').exists()).toBe(false)
  })

  it('admin usernél admin linkek láthatók', async () => {
    const wrapper = mountAsAdmin()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-admin-matches"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-admin-teams"]').exists()).toBe(true)
  })

  // ─── Akciók ───────────────────────────────────────────────────────────────────

  it('Kijelentkezés gomb → authStore.logout() meghívódik', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    await wrapper.find('[data-testid="menu-logout"]').trigger('click')
    expect(mockLogout).toHaveBeenCalledOnce()
  })
})
