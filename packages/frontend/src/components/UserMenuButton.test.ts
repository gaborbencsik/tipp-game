import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UserMenuButton from '@/components/UserMenuButton.vue'
import { buildTestRouter } from '@/test-utils/router'

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
  return buildTestRouter()
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

  // ─── Avatar rendering ─────────────────────────────────────────────────────────

  it('avatar-img is shown when avatarUrl is set', () => {
    const wrapper = mountAsUser({ avatarUrl: 'https://example.com/avatar.png' })
    expect(wrapper.find('[data-testid="avatar-img"]').attributes('src')).toBe('https://example.com/avatar.png')
  })

  it('when avatarUrl is null a DiceBear fallback URL is used for avatar-img src', () => {
    const wrapper = mountAsUser({ avatarUrl: null, displayName: 'Test User' })
    const src = wrapper.find('[data-testid="avatar-img"]').attributes('src')
    expect(src).toContain('api.dicebear.com')
    expect(src).toContain('miniavs')
    expect(src).toContain('Test%20User')
  })

  it('DiceBear seed falls back to email when displayName is empty', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'u3', supabaseId: 's3', email: 'zoltan@test.com', displayName: '', avatarUrl: null, role: 'user' },
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuthStore>)
    const wrapper = mount(UserMenuButton, { global: { plugins: [pinia, buildRouter()] } })
    const src = wrapper.find('[data-testid="avatar-img"]').attributes('src')
    expect(src).toContain('zoltan%40test.com')
  })

  // ─── Toggle ───────────────────────────────────────────────────────────────────

  it('dropdown is hidden by default', () => {
    const wrapper = mountAsUser()
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(false)
  })

  it('avatar button click → dropdown appears', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(true)
  })

  it('second click → dropdown disappears (toggle)', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(true)
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(false)
  })

  // ─── Backdrop ─────────────────────────────────────────────────────────────────

  it('backdrop click → dropdown closes', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(true)
    await wrapper.find('[data-testid="user-menu-backdrop"]').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-dropdown"]').exists()).toBe(false)
  })

  // ─── Admin visibility ─────────────────────────────────────────────────────────

  it('admin link is missing for non-admin user', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-admin-matches"]').exists()).toBe(false)
  })

  it('admin link is visible for admin user', async () => {
    const wrapper = mountAsAdmin()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-admin-matches"]').exists()).toBe(true)
  })

  it('admin link is not visible for non-admin user', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-admin-matches"]').exists()).toBe(false)
  })

  // ─── Actions ──────────────────────────────────────────────────────────────────

  it('Logout button → authStore.logout() is called', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    await wrapper.find('[data-testid="menu-logout"]').trigger('click')
    expect(mockLogout).toHaveBeenCalledOnce()
  })
})
