import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminUsersView from '@/views/AdminUsersView.vue'
import { useAdminUsersStore } from '@/stores/admin-users.store'
import type { AdminUser } from '@/types/index'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const {
  mockGetSession,
  mockApiUsersList,
  mockApiUsersUpdateRole,
  mockApiUsersBan,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockApiUsersList: vi.fn().mockResolvedValue([]),
  mockApiUsersUpdateRole: vi.fn().mockResolvedValue(undefined),
  mockApiUsersBan: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: vi.fn() },
    matches: { list: vi.fn() },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    admin: {
      teams: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      matches: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), setResult: vi.fn() },
      users: {
        list: mockApiUsersList,
        updateRole: mockApiUsersUpdateRole,
        ban: mockApiUsersBan,
      },
    },
  },
}))

const CURRENT_USER_ID = 'current-admin-id'

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: { id: CURRENT_USER_ID, role: 'admin' },
      isAuthenticated: () => true,
      isAdmin: () => true,
      ready: true,
      restoreSession: vi.fn().mockResolvedValue(undefined),
    }),
  }
})

const USER_1: AdminUser = {
  id: 'u1',
  email: 'alice@example.com',
  displayName: 'Alice',
  role: 'user',
  bannedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const USER_2: AdminUser = {
  id: CURRENT_USER_ID,
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'admin',
  bannedAt: null,
  createdAt: '2026-01-02T00:00:00.000Z',
}

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/users', component: AdminUsersView }],
  })
}

async function mountView(users: AdminUser[] = []) {
  mockApiUsersList.mockResolvedValue(users)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminUsersView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store: useAdminUsersStore() }
}

describe('AdminUsersView', () => {
  beforeEach(() => {
    mockApiUsersList.mockReset().mockResolvedValue([])
    mockApiUsersUpdateRole.mockReset()
    mockApiUsersBan.mockReset()
    setActivePinia(createPinia())
  })

  it('loading state → spinner visible', async () => {
    let resolveList!: (v: AdminUser[]) => void
    mockApiUsersList.mockReturnValue(new Promise<AdminUser[]>(res => { resolveList = res }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AdminUsersView, { global: { plugins: [pinia, buildRouter()] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    resolveList([])
  })

  it('users loaded → table rows rendered', async () => {
    const { wrapper } = await mountView([USER_1, USER_2])
    expect(wrapper.findAll('[data-testid="user-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('alice@example.com')
    expect(wrapper.text()).toContain('admin@example.com')
  })

  it('role-select change → store.updateUserRole called', async () => {
    const updated: AdminUser = { ...USER_1, role: 'admin' }
    mockApiUsersUpdateRole.mockResolvedValue(updated)
    const { wrapper, store } = await mountView([USER_1])
    const updateRoleSpy = vi.spyOn(store, 'updateUserRole').mockResolvedValue()

    const roleSelects = wrapper.findAll('[data-testid="role-select"]')
    await roleSelects[0]!.setValue('admin')
    await flushPromises()

    expect(updateRoleSpy).toHaveBeenCalledWith(USER_1.id, 'admin')
  })

  it('ban-btn click → store.banUser called', async () => {
    const banned: AdminUser = { ...USER_1, bannedAt: '2026-06-01T00:00:00.000Z' }
    mockApiUsersBan.mockResolvedValue(banned)
    const { wrapper, store } = await mountView([USER_1])
    const banSpy = vi.spyOn(store, 'banUser').mockResolvedValue()

    const banBtns = wrapper.findAll('[data-testid="ban-btn"]')
    await banBtns[0]!.trigger('click')
    await flushPromises()

    expect(banSpy).toHaveBeenCalledWith(USER_1.id, true)
  })

  it('own account → role-select and ban-btn are disabled', async () => {
    const { wrapper } = await mountView([USER_2])
    const rows = wrapper.findAll('[data-testid="user-row"]')
    expect(rows).toHaveLength(1)
    const roleSelect = wrapper.find('[data-testid="role-select"]')
    const banBtn = wrapper.find('[data-testid="ban-btn"]')
    expect(roleSelect.attributes('disabled')).toBeDefined()
    expect(banBtn.attributes('disabled')).toBeDefined()
  })

  it('other user → role-select and ban-btn are enabled', async () => {
    const { wrapper } = await mountView([USER_1])
    const roleSelect = wrapper.find('[data-testid="role-select"]')
    const banBtn = wrapper.find('[data-testid="ban-btn"]')
    expect(roleSelect.attributes('disabled')).toBeUndefined()
    expect(banBtn.attributes('disabled')).toBeUndefined()
  })
})
