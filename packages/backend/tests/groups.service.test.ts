import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Group, GroupMember } from '../src/types/index.js'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockInsert, mockDelete, mockUpdate, mockGetGroupLeaderboard } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  mockGetGroupLeaderboard: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert, delete: mockDelete, update: mockUpdate },
}))

vi.mock('../src/services/group-leaderboard.service.js', () => ({
  getGroupLeaderboard: mockGetGroupLeaderboard,
}))

import { getMyGroups, createGroup, joinGroup, getGroupMembers, removeMember, setMemberAdmin, regenerateInviteCode, setInviteActive, deleteGroup } from '../src/services/groups.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')
const USER_ID = 'user-uuid-1'
const OTHER_USER_ID = 'user-uuid-2'

const GROUP_ROW = {
  id: 'group-uuid-1',
  name: 'Barátok',
  description: 'Barátok csoportja',
  inviteCode: 'ABCD1234',
  inviteActive: true,
  createdBy: USER_ID,
  scoringConfigId: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
}

const MEMBER_ROW = {
  id: 'member-uuid-1',
  groupId: 'group-uuid-1',
  userId: USER_ID,
  isAdmin: true,
  joinedAt: NOW,
}

// ─── Chain builder helpers ────────────────────────────────────────────────────

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(result)
  // Make the chain itself thenable so `await chain` resolves to result
  ;(chain as Record<string, unknown>)['then'] = terminal.then.bind(terminal)
  ;(chain as Record<string, unknown>)['catch'] = terminal.catch.bind(terminal)
  ;(chain as Record<string, unknown>)['finally'] = terminal.finally.bind(terminal)
  chain['from'] = vi.fn().mockReturnValue(chain)
  chain['innerJoin'] = vi.fn().mockReturnValue(chain)
  chain['where'] = vi.fn().mockReturnValue(chain)
  chain['orderBy'] = vi.fn().mockReturnValue(terminal)
  chain['limit'] = vi.fn().mockReturnValue(terminal)
  return chain
}

function makeInsertChain(returning: unknown[] = []) {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn })
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn })
  return { insertFn, valuesFn, returningFn }
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(undefined)
  ;(chain as Record<string, unknown>)['then'] = terminal.then.bind(terminal)
  ;(chain as Record<string, unknown>)['catch'] = terminal.catch.bind(terminal)
  ;(chain as Record<string, unknown>)['finally'] = terminal.finally.bind(terminal)
  chain['where'] = vi.fn().mockReturnValue(terminal)
  return chain
}

function makeUpdateChain(returning: unknown[] = []) {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn })
  const setFn = vi.fn().mockReturnValue({ where: whereFn })
  return { setFn, whereFn, returningFn }
}

// ─── Member fixtures ──────────────────────────────────────────────────────────

const REQUESTER_ID = USER_ID
const TARGET_ID = 'user-uuid-3'

const MEMBER_ROW_ADMIN = {
  id: 'gm-uuid-1',
  userId: REQUESTER_ID,
  displayName: 'Alice',
  avatarUrl: null,
  isAdmin: true,
  joinedAt: NOW,
}

const MEMBER_ROW_TARGET = {
  id: 'gm-uuid-2',
  userId: TARGET_ID,
  displayName: 'Bob',
  avatarUrl: null,
  isAdmin: false,
  joinedAt: NOW,
}

const MEMBER_ROW_ADMIN2 = {
  id: 'gm-uuid-3',
  userId: 'user-uuid-4',
  displayName: 'Carol',
  avatarUrl: null,
  isAdmin: true,
  joinedAt: NOW,
}

// ─── getMyGroups ──────────────────────────────────────────────────────────────

describe('getMyGroups', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('no memberships → returns []', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    const result = await getMyGroups(USER_ID)
    expect(result).toEqual([])
  })

  it('one membership → returns group with memberCount and isAdmin', async () => {
    const membership = [{ group: GROUP_ROW, isAdmin: true }]
    mockSelect
      .mockReturnValueOnce(makeSelectChain(membership))
      .mockReturnValueOnce(makeSelectChain([{ count: 2 }]))
    mockGetGroupLeaderboard.mockResolvedValueOnce([
      { rank: 1, userId: USER_ID, displayName: 'Alice', avatarUrl: null, totalPoints: 10, predictionCount: 3, correctCount: 2 },
    ])

    const result = await getMyGroups(USER_ID)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<Group>>({
      id: 'group-uuid-1',
      name: 'Barátok',
      memberCount: 2,
      isAdmin: true,
      userRank: 1,
    })
  })

  it('deleted group is skipped', async () => {
    const deletedGroup = { ...GROUP_ROW, deletedAt: NOW }
    mockSelect.mockReturnValueOnce(makeSelectChain([{ group: deletedGroup, isAdmin: false }]))
    const result = await getMyGroups(USER_ID)
    expect(result).toEqual([])
  })

  it('returns userRank from leaderboard', async () => {
    const membership = [{ group: GROUP_ROW, isAdmin: false }]
    mockSelect
      .mockReturnValueOnce(makeSelectChain(membership))
      .mockReturnValueOnce(makeSelectChain([{ count: 3 }]))
    mockGetGroupLeaderboard.mockResolvedValueOnce([
      { rank: 1, userId: 'someone-else', displayName: 'Bob', avatarUrl: null, totalPoints: 15, predictionCount: 5, correctCount: 4 },
      { rank: 2, userId: USER_ID, displayName: 'Alice', avatarUrl: null, totalPoints: 10, predictionCount: 3, correctCount: 2 },
    ])

    const result = await getMyGroups(USER_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.userRank).toBe(2)
  })

  it('userRank is null when user has no leaderboard entry', async () => {
    const membership = [{ group: GROUP_ROW, isAdmin: false }]
    mockSelect
      .mockReturnValueOnce(makeSelectChain(membership))
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
    mockGetGroupLeaderboard.mockResolvedValueOnce([])

    const result = await getMyGroups(USER_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.userRank).toBeNull()
  })

  it('userRank is null when leaderboard throws', async () => {
    const membership = [{ group: GROUP_ROW, isAdmin: false }]
    mockSelect
      .mockReturnValueOnce(makeSelectChain(membership))
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
    mockGetGroupLeaderboard.mockRejectedValueOnce(new Error('DB error'))

    const result = await getMyGroups(USER_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.userRank).toBeNull()
  })
})

// ─── createGroup ──────────────────────────────────────────────────────────────

describe('createGroup', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('user already has 5 groups → AppError 422', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ count: 5 }]))
    await expect(createGroup({ name: 'Új' }, USER_ID)).rejects.toMatchObject({
      status: 422,
      message: 'Maximum number of created groups reached',
    })
  })

  it('valid input → returns group with memberCount=1 and isAdmin=true', async () => {
    // 1: createdCount check, 2: inviteCode uniqueness check
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))

    const { insertFn, valuesFn } = makeInsertChain([GROUP_ROW])
    // first insert (groups) returns GROUP_ROW; second insert (groupMembers) resolves undefined
    const returningFn = vi.fn().mockResolvedValue([GROUP_ROW])
    const memberValuesFn = vi.fn().mockResolvedValue(undefined)
    insertFn.mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: returningFn }) })
    insertFn.mockReturnValueOnce({ values: memberValuesFn })
    mockInsert.mockImplementation(insertFn)

    const result = await createGroup({ name: 'Barátok' }, USER_ID)
    expect(result).toMatchObject({ name: 'Barátok', memberCount: 1, isAdmin: true })
  })

  it('valid input → inviteCode is generated', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))

    const returningFn = vi.fn().mockResolvedValue([GROUP_ROW])
    const memberValuesFn = vi.fn().mockResolvedValue(undefined)
    const insertFn = vi.fn()
    insertFn.mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: returningFn }) })
    insertFn.mockReturnValueOnce({ values: memberValuesFn })
    mockInsert.mockImplementation(insertFn)

    const result = await createGroup({ name: 'Barátok' }, USER_ID)
    expect(typeof result.inviteCode).toBe('string')
    expect(result.inviteCode.length).toBeGreaterThan(0)
  })
})

// ─── joinGroup ────────────────────────────────────────────────────────────────

describe('joinGroup', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('group not found → AppError 404', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    await expect(joinGroup('NOTEXIST', USER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Group not found',
    })
  })

  it('invite not active → AppError 410', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ ...GROUP_ROW, inviteActive: false }]))
    await expect(joinGroup('ABCD1234', USER_ID)).rejects.toMatchObject({
      status: 410,
      message: 'Invite code is no longer active',
    })
  })

  it('already a member → AppError 409', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW]))
    await expect(joinGroup('ABCD1234', USER_ID)).rejects.toMatchObject({
      status: 409,
      message: 'Already a member of this group',
    })
  })

  it('valid join → returns group with isAdmin=false', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))         // find group
      .mockReturnValueOnce(makeSelectChain([]))                  // existing members
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))      // user joined count

    const memberValuesFn = vi.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValueOnce({ values: memberValuesFn })

    const result = await joinGroup('ABCD1234', OTHER_USER_ID)
    expect(result.isAdmin).toBe(false)
    expect(result.id).toBe('group-uuid-1')
  })

  it('valid join → memberCount = existing + 1', async () => {
    const otherMember = { ...MEMBER_ROW, userId: 'someone-else' }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([otherMember]))
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))

    mockInsert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) })

    const result = await joinGroup('ABCD1234', OTHER_USER_ID)
    expect(result.memberCount).toBe(2)
  })
})

// ─── getGroupMembers ───────────────────────────────────────────────────────────

describe('getGroupMembers', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('group not found → AppError 404', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    await expect(getGroupMembers('group-uuid-1', REQUESTER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Group not found',
    })
  })

  it('requester not a member → AppError 403', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_TARGET]))
    await expect(getGroupMembers('group-uuid-1', REQUESTER_ID)).rejects.toMatchObject({
      status: 403,
      message: 'Not a member of this group',
    })
  })

  it('returns mapped GroupMember list', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN, MEMBER_ROW_TARGET]))
    const result = await getGroupMembers('group-uuid-1', REQUESTER_ID)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject<Partial<GroupMember>>({
      id: 'gm-uuid-1',
      userId: REQUESTER_ID,
      displayName: 'Alice',
      isAdmin: true,
      joinedAt: NOW.toISOString(),
    })
  })
})

// ─── removeMember ─────────────────────────────────────────────────────────────

describe('removeMember', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('self-remove → AppError 403', async () => {
    await expect(removeMember('group-uuid-1', REQUESTER_ID, REQUESTER_ID)).rejects.toMatchObject({
      status: 403,
      message: 'Cannot remove yourself',
    })
  })

  it('group not found → AppError 404', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    await expect(removeMember('group-uuid-1', TARGET_ID, REQUESTER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Group not found',
    })
  })

  it('requester not admin → AppError 403', async () => {
    const nonAdminRequester = { ...MEMBER_ROW_ADMIN, isAdmin: false }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([nonAdminRequester, MEMBER_ROW_TARGET]))
    await expect(removeMember('group-uuid-1', TARGET_ID, REQUESTER_ID)).rejects.toMatchObject({
      status: 403,
      message: 'Not authorized',
    })
  })

  it('target not in group → AppError 404', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN]))
    await expect(removeMember('group-uuid-1', TARGET_ID, REQUESTER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Member not found',
    })
  })

  it('success → calls db.delete', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN, MEMBER_ROW_TARGET]))
    const deleteChain = makeDeleteChain()
    mockDelete.mockReturnValueOnce(deleteChain)
    await expect(removeMember('group-uuid-1', TARGET_ID, REQUESTER_ID)).resolves.toBeUndefined()
    expect(mockDelete).toHaveBeenCalledOnce()
  })
})

// ─── setMemberAdmin ───────────────────────────────────────────────────────────

describe('setMemberAdmin', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('self-change → AppError 403', async () => {
    await expect(setMemberAdmin('group-uuid-1', REQUESTER_ID, true, REQUESTER_ID)).rejects.toMatchObject({
      status: 403,
      message: 'Cannot change your own admin status',
    })
  })

  it('group not found → AppError 404', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    await expect(setMemberAdmin('group-uuid-1', TARGET_ID, true, REQUESTER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Group not found',
    })
  })

  it('requester not admin → AppError 403', async () => {
    const nonAdminRequester = { ...MEMBER_ROW_ADMIN, isAdmin: false }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([nonAdminRequester, MEMBER_ROW_TARGET]))
    await expect(setMemberAdmin('group-uuid-1', TARGET_ID, true, REQUESTER_ID)).rejects.toMatchObject({
      status: 403,
      message: 'Not authorized',
    })
  })

  it('target not in group → AppError 404', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN]))
    await expect(setMemberAdmin('group-uuid-1', TARGET_ID, false, REQUESTER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Member not found',
    })
  })

  it('demote when 2 admins → succeeds', async () => {
    const targetAdmin = { ...MEMBER_ROW_TARGET, isAdmin: true }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN, targetAdmin]))
    const { setFn } = makeUpdateChain([{ ...MEMBER_ROW_TARGET, isAdmin: false }])
    mockUpdate.mockReturnValueOnce({ set: setFn })
    const result = await setMemberAdmin('group-uuid-1', TARGET_ID, false, REQUESTER_ID)
    expect(result.isAdmin).toBe(false)
  })

  it('promote member → returns updated GroupMember with isAdmin=true', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN, MEMBER_ROW_TARGET]))
    const { setFn } = makeUpdateChain([{ ...MEMBER_ROW_TARGET, isAdmin: true }])
    mockUpdate.mockReturnValueOnce({ set: setFn })
    const result = await setMemberAdmin('group-uuid-1', TARGET_ID, true, REQUESTER_ID)
    expect(result).toMatchObject<Partial<GroupMember>>({
      userId: TARGET_ID,
      isAdmin: true,
      displayName: 'Bob',
    })
  })
})

// ─── regenerateInviteCode ─────────────────────────────────────────────────────

describe('regenerateInviteCode', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('group not found → AppError 404', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    await expect(regenerateInviteCode('group-uuid-1', REQUESTER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Group not found',
    })
  })

  it('requester not admin → AppError 403', async () => {
    const nonAdminRequester = { ...MEMBER_ROW_ADMIN, isAdmin: false }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([nonAdminRequester]))
    await expect(regenerateInviteCode('group-uuid-1', REQUESTER_ID)).rejects.toMatchObject({
      status: 403,
      message: 'Not authorized',
    })
  })

  it('success → returns Group with new inviteCode and inviteActive=true', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))          // group check
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN]))   // members check
      .mockReturnValueOnce(makeSelectChain([]))                   // uniqueness check (no collision)
    const updatedGroup = { ...GROUP_ROW, inviteCode: 'NEWCODE1', inviteActive: true }
    const { setFn } = makeUpdateChain([updatedGroup])
    mockUpdate.mockReturnValueOnce({ set: setFn })
    const result = await regenerateInviteCode('group-uuid-1', REQUESTER_ID)
    expect(result.inviteActive).toBe(true)
    expect(result.inviteCode).toBe('NEWCODE1')
  })
})

// ─── setInviteActive ──────────────────────────────────────────────────────────

describe('setInviteActive', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('group not found → AppError 404', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    await expect(setInviteActive('group-uuid-1', false, REQUESTER_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Group not found',
    })
  })

  it('requester not admin → AppError 403', async () => {
    const nonAdminRequester = { ...MEMBER_ROW_ADMIN, isAdmin: false }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([nonAdminRequester]))
    await expect(setInviteActive('group-uuid-1', false, REQUESTER_ID)).rejects.toMatchObject({
      status: 403,
      message: 'Not authorized',
    })
  })

  it('deactivate → returns Group with inviteActive=false', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN]))
    const updatedGroup = { ...GROUP_ROW, inviteActive: false }
    const { setFn } = makeUpdateChain([updatedGroup])
    mockUpdate.mockReturnValueOnce({ set: setFn })
    const result = await setInviteActive('group-uuid-1', false, REQUESTER_ID)
    expect(result.inviteActive).toBe(false)
  })

  it('activate → returns Group with inviteActive=true', async () => {
    const inactiveGroup = { ...GROUP_ROW, inviteActive: false }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([inactiveGroup]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN]))
    const updatedGroup = { ...GROUP_ROW, inviteActive: true }
    const { setFn } = makeUpdateChain([updatedGroup])
    mockUpdate.mockReturnValueOnce({ set: setFn })
    const result = await setInviteActive('group-uuid-1', true, REQUESTER_ID)
    expect(result.inviteActive).toBe(true)
  })
})

// ─── deleteGroup ──────────────────────────────────────────────────────────────

describe('deleteGroup', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('group not found → AppError 404', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    await expect(deleteGroup('group-uuid-1', REQUESTER_ID, false)).rejects.toMatchObject({
      status: 404,
      message: 'Group not found',
    })
  })

  it('requester not a member → AppError 403', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_TARGET]))
    await expect(deleteGroup('group-uuid-1', REQUESTER_ID, false)).rejects.toMatchObject({
      status: 403,
      message: 'Not authorized',
    })
  })

  it('requester not admin → AppError 403', async () => {
    const nonAdminRequester = { ...MEMBER_ROW_ADMIN, isAdmin: false }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([nonAdminRequester]))
    await expect(deleteGroup('group-uuid-1', REQUESTER_ID, false)).rejects.toMatchObject({
      status: 403,
      message: 'Not authorized',
    })
  })

  it('csoport admin → soft delete', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW_ADMIN]))
    const { setFn } = makeUpdateChain([{ ...GROUP_ROW, deletedAt: new Date() }])
    mockUpdate.mockReturnValueOnce({ set: setFn })
    await expect(deleteGroup('group-uuid-1', REQUESTER_ID, false)).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledOnce()
  })

  it('global admin → skip membership check, soft delete', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
    const { setFn } = makeUpdateChain([{ ...GROUP_ROW, deletedAt: new Date() }])
    mockUpdate.mockReturnValueOnce({ set: setFn })
    await expect(deleteGroup('group-uuid-1', 'other-user', true)).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledOnce()
  })
})
