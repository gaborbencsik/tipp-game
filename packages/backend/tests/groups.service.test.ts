import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Group } from '../src/types/index.js'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

import { getMyGroups, createGroup, joinGroup } from '../src/services/groups.service.js'

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

    const result = await getMyGroups(USER_ID)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<Group>>({
      id: 'group-uuid-1',
      name: 'Barátok',
      memberCount: 2,
      isAdmin: true,
    })
  })

  it('deleted group is skipped', async () => {
    const deletedGroup = { ...GROUP_ROW, deletedAt: NOW }
    mockSelect.mockReturnValueOnce(makeSelectChain([{ group: deletedGroup, isAdmin: false }]))
    const result = await getMyGroups(USER_ID)
    expect(result).toEqual([])
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
