import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Group } from '@/types/index'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const { mockGetSession, mockGroupsMine, mockGroupsCreate, mockGroupsJoin } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockGroupsMine: vi.fn(),
  mockGroupsCreate: vi.fn(),
  mockGroupsJoin: vi.fn(),
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
    groups: {
      mine: mockGroupsMine,
      create: mockGroupsCreate,
      join: mockGroupsJoin,
    },
  },
}))

import { useGroupsStore } from '@/stores/groups.store'

const GROUP_A: Group = {
  id: 'group-uuid-1',
  name: 'Barátok',
  description: 'Barátok csoportja',
  inviteCode: 'ABCD1234',
  inviteActive: true,
  createdBy: 'user-uuid-1',
  memberCount: 3,
  isAdmin: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const GROUP_B: Group = {
  id: 'group-uuid-2',
  name: 'Munkások',
  description: null,
  inviteCode: 'EFGH5678',
  inviteActive: true,
  createdBy: 'user-uuid-2',
  memberCount: 5,
  isAdmin: false,
  createdAt: '2026-02-01T00:00:00.000Z',
}

describe('groups.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGroupsMine.mockReset()
    mockGroupsCreate.mockReset()
    mockGroupsJoin.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  // ─── Initial state ───────────────────────────────────────────────────────────

  it('initial groups is empty', () => {
    const store = useGroupsStore()
    expect(store.groups).toEqual([])
  })

  it('initial isLoading is false', () => {
    const store = useGroupsStore()
    expect(store.isLoading).toBe(false)
  })

  it('initial error is null', () => {
    const store = useGroupsStore()
    expect(store.error).toBeNull()
  })

  // ─── fetchMyGroups ───────────────────────────────────────────────────────────

  it('fetchMyGroups() → groups populated', async () => {
    mockGroupsMine.mockResolvedValue([GROUP_A, GROUP_B])
    const store = useGroupsStore()
    await store.fetchMyGroups()
    expect(store.groups).toEqual([GROUP_A, GROUP_B])
  })

  it('fetchMyGroups() → isLoading false after completion', async () => {
    mockGroupsMine.mockResolvedValue([])
    const store = useGroupsStore()
    await store.fetchMyGroups()
    expect(store.isLoading).toBe(false)
  })

  it('fetchMyGroups() error → error set, groups remain empty', async () => {
    mockGroupsMine.mockRejectedValue(new Error('Network error'))
    const store = useGroupsStore()
    await store.fetchMyGroups()
    expect(store.error).toBe('Network error')
    expect(store.groups).toEqual([])
  })

  it('fetchMyGroups() unknown error → generic error message', async () => {
    mockGroupsMine.mockRejectedValue('unexpected')
    const store = useGroupsStore()
    await store.fetchMyGroups()
    expect(store.error).toBe('Ismeretlen hiba')
  })

  // ─── createGroup ─────────────────────────────────────────────────────────────

  it('createGroup() → new group appended to list', async () => {
    mockGroupsMine.mockResolvedValue([GROUP_A])
    mockGroupsCreate.mockResolvedValue(GROUP_B)
    const store = useGroupsStore()
    await store.fetchMyGroups()
    await store.createGroup({ name: 'Munkások' })
    expect(store.groups).toHaveLength(2)
    expect(store.groups[1]).toEqual(GROUP_B)
  })

  it('createGroup() → returns created group', async () => {
    mockGroupsCreate.mockResolvedValue(GROUP_A)
    const store = useGroupsStore()
    const result = await store.createGroup({ name: 'Barátok' })
    expect(result).toEqual(GROUP_A)
  })

  it('createGroup() error → throws', async () => {
    mockGroupsCreate.mockRejectedValue(new Error('Maximum number of created groups reached'))
    const store = useGroupsStore()
    await expect(store.createGroup({ name: 'Hatodik' })).rejects.toThrow('Maximum number of created groups reached')
  })

  // ─── joinGroup ────────────────────────────────────────────────────────────────

  it('joinGroup() → joined group appended to list', async () => {
    mockGroupsMine.mockResolvedValue([GROUP_A])
    mockGroupsJoin.mockResolvedValue(GROUP_B)
    const store = useGroupsStore()
    await store.fetchMyGroups()
    await store.joinGroup({ inviteCode: 'EFGH5678' })
    expect(store.groups).toHaveLength(2)
    expect(store.groups[1]).toEqual(GROUP_B)
  })

  it('joinGroup() → returns joined group', async () => {
    mockGroupsJoin.mockResolvedValue(GROUP_B)
    const store = useGroupsStore()
    const result = await store.joinGroup({ inviteCode: 'EFGH5678' })
    expect(result).toEqual(GROUP_B)
  })

  it('joinGroup() error → throws', async () => {
    mockGroupsJoin.mockRejectedValue(new Error('Group not found'))
    const store = useGroupsStore()
    await expect(store.joinGroup({ inviteCode: 'INVALID1' })).rejects.toThrow('Group not found')
  })
})
