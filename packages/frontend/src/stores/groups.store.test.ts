import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Group, GroupMember } from '@/types/index'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const {
  mockGetSession,
  mockGroupsMine,
  mockGroupsCreate,
  mockGroupsJoin,
  mockGroupsMembers,
  mockGroupsRemoveMember,
  mockGroupsUpdateMemberRole,
  mockGroupsRegenerateInvite,
  mockGroupsSetInviteActive,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockGroupsMine: vi.fn(),
  mockGroupsCreate: vi.fn(),
  mockGroupsJoin: vi.fn(),
  mockGroupsMembers: vi.fn(),
  mockGroupsRemoveMember: vi.fn(),
  mockGroupsUpdateMemberRole: vi.fn(),
  mockGroupsRegenerateInvite: vi.fn(),
  mockGroupsSetInviteActive: vi.fn(),
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
      members: mockGroupsMembers,
      removeMember: mockGroupsRemoveMember,
      updateMemberRole: mockGroupsUpdateMemberRole,
      regenerateInvite: mockGroupsRegenerateInvite,
      setInviteActive: mockGroupsSetInviteActive,
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
    mockGroupsMembers.mockReset()
    mockGroupsRemoveMember.mockReset()
    mockGroupsUpdateMemberRole.mockReset()
    mockGroupsRegenerateInvite.mockReset()
    mockGroupsSetInviteActive.mockReset()
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

  // ─── fetchGroupMembers ────────────────────────────────────────────────────────

  const MEMBER_A: GroupMember = {
    id: 'gm-uuid-1',
    userId: 'user-uuid-1',
    displayName: 'Alice',
    avatarUrl: null,
    isAdmin: true,
    joinedAt: '2026-01-01T00:00:00.000Z',
  }

  const MEMBER_B: GroupMember = {
    id: 'gm-uuid-2',
    userId: 'user-uuid-2',
    displayName: 'Bob',
    avatarUrl: null,
    isAdmin: false,
    joinedAt: '2026-01-02T00:00:00.000Z',
  }

  it('fetchGroupMembers() success → membersMap populated', async () => {
    mockGroupsMembers.mockResolvedValue([MEMBER_A, MEMBER_B])
    const store = useGroupsStore()
    await store.fetchGroupMembers('group-uuid-1')
    expect(store.membersMap['group-uuid-1']).toEqual([MEMBER_A, MEMBER_B])
  })

  it('fetchGroupMembers() error → membersError set', async () => {
    mockGroupsMembers.mockRejectedValue(new Error('Not a member'))
    const store = useGroupsStore()
    await store.fetchGroupMembers('group-uuid-1')
    expect(store.membersError).toBe('Not a member')
    expect(store.membersMap['group-uuid-1']).toBeUndefined()
  })

  // ─── removeMember ─────────────────────────────────────────────────────────────

  it('removeMember() success → member filtered from membersMap', async () => {
    mockGroupsMembers.mockResolvedValue([MEMBER_A, MEMBER_B])
    mockGroupsRemoveMember.mockResolvedValue({ success: true })
    const store = useGroupsStore()
    await store.fetchGroupMembers('group-uuid-1')
    await store.removeMember('group-uuid-1', 'user-uuid-2')
    expect(store.membersMap['group-uuid-1']).toHaveLength(1)
    expect(store.membersMap['group-uuid-1']![0].userId).toBe('user-uuid-1')
  })

  it('removeMember() error → throws', async () => {
    mockGroupsRemoveMember.mockRejectedValue(new Error('Not authorized'))
    const store = useGroupsStore()
    await expect(store.removeMember('group-uuid-1', 'user-uuid-2')).rejects.toThrow('Not authorized')
  })

  // ─── toggleMemberAdmin ────────────────────────────────────────────────────────

  it('toggleMemberAdmin() success → isAdmin updated in membersMap', async () => {
    mockGroupsMembers.mockResolvedValue([MEMBER_A, MEMBER_B])
    const updatedMember: GroupMember = { ...MEMBER_B, isAdmin: true }
    mockGroupsUpdateMemberRole.mockResolvedValue(updatedMember)
    const store = useGroupsStore()
    await store.fetchGroupMembers('group-uuid-1')
    await store.toggleMemberAdmin('group-uuid-1', 'user-uuid-2', true)
    const bob = store.membersMap['group-uuid-1']?.find((m) => m.userId === 'user-uuid-2')
    expect(bob?.isAdmin).toBe(true)
  })

  it('toggleMemberAdmin() error → throws', async () => {
    mockGroupsUpdateMemberRole.mockRejectedValue(new Error('Cannot change your own admin status'))
    const store = useGroupsStore()
    await expect(store.toggleMemberAdmin('group-uuid-1', 'user-uuid-1', false)).rejects.toThrow(
      'Cannot change your own admin status',
    )
  })

  // ─── regenerateInvite ─────────────────────────────────────────────────────────

  it('regenerateInvite() → group updated in list', async () => {
    mockGroupsMine.mockResolvedValue([GROUP_A, GROUP_B])
    const updatedGroup = { ...GROUP_A, inviteCode: 'NEWCODE1' }
    mockGroupsRegenerateInvite.mockResolvedValue(updatedGroup)
    const store = useGroupsStore()
    await store.fetchMyGroups()
    await store.regenerateInvite('group-uuid-1')
    expect(store.groups.find((g) => g.id === 'group-uuid-1')?.inviteCode).toBe('NEWCODE1')
  })

  it('regenerateInvite() → other groups unchanged', async () => {
    mockGroupsMine.mockResolvedValue([GROUP_A, GROUP_B])
    mockGroupsRegenerateInvite.mockResolvedValue({ ...GROUP_A, inviteCode: 'NEWCODE1' })
    const store = useGroupsStore()
    await store.fetchMyGroups()
    await store.regenerateInvite('group-uuid-1')
    expect(store.groups.find((g) => g.id === 'group-uuid-2')).toEqual(GROUP_B)
  })

  // ─── setInviteActive ──────────────────────────────────────────────────────────

  it('setInviteActive(false) → group inviteActive set to false', async () => {
    mockGroupsMine.mockResolvedValue([GROUP_A, GROUP_B])
    mockGroupsSetInviteActive.mockResolvedValue({ ...GROUP_A, inviteActive: false })
    const store = useGroupsStore()
    await store.fetchMyGroups()
    await store.setInviteActive('group-uuid-1', false)
    expect(store.groups.find((g) => g.id === 'group-uuid-1')?.inviteActive).toBe(false)
  })

  it('setInviteActive(true) → group inviteActive set to true', async () => {
    const inactiveGroupA = { ...GROUP_A, inviteActive: false }
    mockGroupsMine.mockResolvedValue([inactiveGroupA, GROUP_B])
    mockGroupsSetInviteActive.mockResolvedValue({ ...inactiveGroupA, inviteActive: true })
    const store = useGroupsStore()
    await store.fetchMyGroups()
    await store.setInviteActive('group-uuid-1', true)
    expect(store.groups.find((g) => g.id === 'group-uuid-1')?.inviteActive).toBe(true)
  })

  it('setInviteActive() error → throws', async () => {
    mockGroupsSetInviteActive.mockRejectedValue(new Error('Not authorized'))
    const store = useGroupsStore()
    await expect(store.setInviteActive('group-uuid-1', false)).rejects.toThrow('Not authorized')
  })
})
