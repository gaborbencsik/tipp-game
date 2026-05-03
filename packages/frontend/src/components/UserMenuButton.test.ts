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

  // ─── Avatar megjelenítés ──────────────────────────────────────────────────────

  it('avatar-img látszik ha avatarUrl be van állítva', () => {
    const wrapper = mountAsUser({ avatarUrl: 'https://example.com/avatar.png' })
    expect(wrapper.find('[data-testid="avatar-img"]').attributes('src')).toBe('https://example.com/avatar.png')
  })

  it('avatarUrl null esetén DiceBear fallback URL kerül az avatar-img src-be', () => {
    const wrapper = mountAsUser({ avatarUrl: null, displayName: 'Test User' })
    const src = wrapper.find('[data-testid="avatar-img"]').attributes('src')
    expect(src).toContain('api.dicebear.com')
    expect(src).toContain('miniavs')
    expect(src).toContain('Test%20User')
  })

  it('DiceBear seed email-re esik vissza ha displayName üres', () => {
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
    expect(wrapper.find('[data-testid="menu-admin-users"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-admin-sync"]').exists()).toBe(false)
  })

  it('admin usernél admin linkek láthatók', async () => {
    const wrapper = mountAsAdmin()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-admin-matches"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-admin-teams"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-admin-users"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-admin-sync"]').exists()).toBe(true)
  })

  it('admin section toggle → admin linkek elrejtve', async () => {
    const wrapper = mountAsAdmin()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    // adminOpen starts as false (path is '/'), so one click opens it, second closes it
    await wrapper.find('[data-testid="admin-section-toggle"]').trigger('click') // open
    await wrapper.find('[data-testid="admin-section-toggle"]').trigger('click') // close
    await wrapper.vm.$nextTick()
    expect((wrapper.find('[data-testid="menu-admin-matches"]').element as HTMLElement).style.display).toBe('none')
  })

  it('admin section toggle kétszer → admin linkek visszajönnek', async () => {
    const wrapper = mountAsAdmin()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    await wrapper.find('[data-testid="admin-section-toggle"]').trigger('click') // open
    await wrapper.find('[data-testid="admin-section-toggle"]').trigger('click') // close
    await wrapper.find('[data-testid="admin-section-toggle"]').trigger('click') // open again
    await wrapper.vm.$nextTick()
    expect((wrapper.find('[data-testid="menu-admin-matches"]').element as HTMLElement).style.display).toBe('')
  })

  it('nem-admin usernél admin-section-toggle nem látható', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="admin-section-toggle"]').exists()).toBe(false)
  })

  // ─── Akciók ───────────────────────────────────────────────────────────────────

  it('Kijelentkezés gomb → authStore.logout() meghívódik', async () => {
    const wrapper = mountAsUser()
    await wrapper.find('[data-testid="user-menu-btn"]').trigger('click')
    await wrapper.find('[data-testid="menu-logout"]').trigger('click')
    expect(mockLogout).toHaveBeenCalledOnce()
  })
})
