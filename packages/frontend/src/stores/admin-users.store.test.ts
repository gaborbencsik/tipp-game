import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminUsersStore } from '@/stores/admin-users.store'
import type { AdminUser } from '@/types/index'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

const { mockApiUsers } = vi.hoisted(() => ({
  mockApiUsers: {
    list: vi.fn(),
    updateRole: vi.fn(),
    ban: vi.fn(),
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    admin: { users: mockApiUsers },
  },
}))

const USER_1: AdminUser = {
  id: 'u1',
  email: 'alice@example.com',
  displayName: 'Alice',
  role: 'user',
  bannedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const USER_2: AdminUser = {
  id: 'u2',
  email: 'bob@example.com',
  displayName: 'Bob',
  role: 'admin',
  bannedAt: null,
  createdAt: '2026-01-02T00:00:00.000Z',
}

describe('admin-users.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockApiUsers.list.mockReset()
    mockApiUsers.updateRole.mockReset()
    mockApiUsers.ban.mockReset()
  })

  // ─── initial state ─────────────────────────────────────────────────────────

  it('initial users is empty', () => {
    const store = useAdminUsersStore()
    expect(store.users).toEqual([])
  })

  it('initial isLoading is false', () => {
    const store = useAdminUsersStore()
    expect(store.isLoading).toBe(false)
  })

  it('initial error is null', () => {
    const store = useAdminUsersStore()
    expect(store.error).toBeNull()
  })

  // ─── fetchUsers ────────────────────────────────────────────────────────────

  it('fetchUsers() → users populated', async () => {
    mockApiUsers.list.mockResolvedValue([USER_1, USER_2])
    const store = useAdminUsersStore()
    await store.fetchUsers()
    expect(store.users).toEqual([USER_1, USER_2])
  })

  it('fetchUsers() → isLoading false after completion', async () => {
    mockApiUsers.list.mockResolvedValue([])
    const store = useAdminUsersStore()
    await store.fetchUsers()
    expect(store.isLoading).toBe(false)
  })

  it('fetchUsers() error → error set, users remain empty', async () => {
    mockApiUsers.list.mockRejectedValue(new Error('Network error'))
    const store = useAdminUsersStore()
    await store.fetchUsers()
    expect(store.error).toBe('Network error')
    expect(store.users).toEqual([])
  })

  // ─── updateUserRole ────────────────────────────────────────────────────────

  it('updateUserRole() → user updated in list', async () => {
    mockApiUsers.list.mockResolvedValue([USER_1, USER_2])
    const updatedUser: AdminUser = { ...USER_1, role: 'admin' }
    mockApiUsers.updateRole.mockResolvedValue(updatedUser)

    const store = useAdminUsersStore()
    await store.fetchUsers()
    await store.updateUserRole('u1', 'admin')

    expect(store.users.find(u => u.id === 'u1')?.role).toBe('admin')
    expect(store.users).toHaveLength(2)
  })

  it('updateUserRole() error → error set', async () => {
    mockApiUsers.updateRole.mockRejectedValue(new Error('Forbidden'))
    const store = useAdminUsersStore()
    await store.updateUserRole('u1', 'admin')
    expect(store.error).toBe('Forbidden')
  })

  // ─── banUser ───────────────────────────────────────────────────────────────

  it('banUser(true) → user bannedAt updated in list', async () => {
    mockApiUsers.list.mockResolvedValue([USER_1, USER_2])
    const bannedAt = '2026-06-01T00:00:00.000Z'
    const bannedUser: AdminUser = { ...USER_1, bannedAt }
    mockApiUsers.ban.mockResolvedValue(bannedUser)

    const store = useAdminUsersStore()
    await store.fetchUsers()
    await store.banUser('u1', true)

    expect(store.users.find(u => u.id === 'u1')?.bannedAt).toBe(bannedAt)
  })

  it('banUser(false) → user bannedAt null in list', async () => {
    const bannedAt = '2026-06-01T00:00:00.000Z'
    mockApiUsers.list.mockResolvedValue([{ ...USER_1, bannedAt }])
    const unbannedUser: AdminUser = { ...USER_1, bannedAt: null }
    mockApiUsers.ban.mockResolvedValue(unbannedUser)

    const store = useAdminUsersStore()
    await store.fetchUsers()
    await store.banUser('u1', false)

    expect(store.users.find(u => u.id === 'u1')?.bannedAt).toBeNull()
  })

  it('banUser() error → error set', async () => {
    mockApiUsers.ban.mockRejectedValue(new Error('Forbidden'))
    const store = useAdminUsersStore()
    await store.banUser('u1', true)
    expect(store.error).toBe('Forbidden')
  })
})
