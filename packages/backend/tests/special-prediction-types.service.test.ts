import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}))

import { listActiveTypes, createType, updateType, deactivateType } from '../src/services/special-prediction-types.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')
const FUTURE = new Date('2026-12-31T00:00:00.000Z')
const GROUP_ID = 'group-uuid-1'
const USER_ID = 'user-uuid-1'
const OTHER_USER_ID = 'user-uuid-2'
const TYPE_ID = 'type-uuid-1'

const GROUP_ROW = {
  id: GROUP_ID,
  deletedAt: null,
}

const MEMBER_ROW_ADMIN = {
  id: 'gm-uuid-1',
  groupId: GROUP_ID,
  userId: USER_ID,
  isAdmin: true,
}

const MEMBER_ROW_REGULAR = {
  id: 'gm-uuid-2',
  groupId: GROUP_ID,
  userId: OTHER_USER_ID,
  isAdmin: false,
}

const TYPE_ROW = {
  id: TYPE_ID,
  groupId: GROUP_ID,
  name: 'Gólkirály',
  description: 'Ki lesz a gólkirály?',
  inputType: 'text',
  options: null,
  deadline: FUTURE,
  points: 5,
  correctAnswer: null,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
}

const VALID_TEXT_INPUT = {
  name: 'Gólkirály',
  inputType: 'text' as const,
  deadline: '2026-12-31T00:00:00.000Z',
  points: 5,
}

const VALID_DROPDOWN_INPUT = {
  name: 'Melyik csapat nyer?',
  inputType: 'dropdown' as const,
  options: ['Magyarország', 'Németország', 'Franciaország'],
  deadline: '2026-12-31T00:00:00.000Z',
  points: 10,
}

// ─── Chain builder helpers ────────────────────────────────────────────────────

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(result)
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

function makeUpdateChain(returning: unknown[] = []) {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn })
  const setFn = vi.fn().mockReturnValue({ where: whereFn })
  return { setFn, whereFn, returningFn }
}

/**
 * Sets up mockSelect to return different results on sequential calls.
 * Each entry in `results` is returned on the nth call.
 */
function setupSelectSequence(results: unknown[]): void {
  let callIndex = 0
  mockSelect.mockImplementation(() => {
    const result = results[callIndex] ?? []
    callIndex++
    return makeSelectChain(result)
  })
}

// ─── listActiveTypes ─────────────────────────────────────────────────────────

describe('listActiveTypes', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns active types for a group member', async () => {
    // 1. assertGroupExists → group found
    // 2. assertGroupMember → member found
    // 3. select active types
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
      [TYPE_ROW],
    ])

    const result = await listActiveTypes(GROUP_ID, USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Gólkirály')
    expect(result[0]?.deadline).toBe('2026-12-31T00:00:00.000Z')
  })

  it('returns empty array when no active types', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
      [],
    ])

    const result = await listActiveTypes(GROUP_ID, USER_ID)

    expect(result).toEqual([])
  })

  it('throws 404 if group not found', async () => {
    setupSelectSequence([[]])

    await expect(listActiveTypes(GROUP_ID, USER_ID))
      .rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })

  it('throws 403 if requester is not a member', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [],
    ])

    await expect(listActiveTypes(GROUP_ID, 'stranger'))
      .rejects.toMatchObject({ status: 403, message: 'Not a member of this group' })
  })
})

// ─── createType ──────────────────────────────────────────────────────────────

describe('createType', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('creates a text type', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
    ])
    const { insertFn } = makeInsertChain([TYPE_ROW])
    mockInsert.mockImplementation(insertFn)

    const result = await createType(GROUP_ID, USER_ID, VALID_TEXT_INPUT)

    expect(result.name).toBe('Gólkirály')
    expect(result.groupId).toBe(GROUP_ID)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('creates a dropdown type with options', async () => {
    const dropdownRow = { ...TYPE_ROW, inputType: 'dropdown', options: ['A', 'B', 'C'] }
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
    ])
    const { insertFn } = makeInsertChain([dropdownRow])
    mockInsert.mockImplementation(insertFn)

    const result = await createType(GROUP_ID, USER_ID, VALID_DROPDOWN_INPUT)

    expect(result.inputType).toBe('dropdown')
  })

  it('throws 403 if requester is not group admin', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_REGULAR],
    ])

    await expect(createType(GROUP_ID, OTHER_USER_ID, VALID_TEXT_INPUT))
      .rejects.toMatchObject({ status: 403, message: 'Not a group admin' })
  })

  it('throws 400 for invalid inputType', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
    ])

    const invalidInput = { ...VALID_TEXT_INPUT, inputType: 'number' as 'text' }
    await expect(createType(GROUP_ID, USER_ID, invalidInput))
      .rejects.toMatchObject({ status: 400, message: "inputType must be 'text' or 'dropdown'" })
  })

  it('throws 400 for dropdown without enough options', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
    ])

    const invalidInput = { ...VALID_DROPDOWN_INPUT, options: ['only one'] }
    await expect(createType(GROUP_ID, USER_ID, invalidInput))
      .rejects.toMatchObject({ status: 400, message: 'dropdown type requires at least 2 options' })
  })

  it('throws 400 for empty name', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
    ])

    const invalidInput = { ...VALID_TEXT_INPUT, name: '' }
    await expect(createType(GROUP_ID, USER_ID, invalidInput))
      .rejects.toMatchObject({ status: 400, message: 'name is required' })
  })

  it('throws 400 for invalid points', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
    ])

    const invalidInput = { ...VALID_TEXT_INPUT, points: 0 }
    await expect(createType(GROUP_ID, USER_ID, invalidInput))
      .rejects.toMatchObject({ status: 400, message: 'points must be an integer between 1 and 100' })
  })

  it('throws 400 for past deadline', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
    ])

    const invalidInput = { ...VALID_TEXT_INPUT, deadline: '2020-01-01T00:00:00.000Z' }
    await expect(createType(GROUP_ID, USER_ID, invalidInput))
      .rejects.toMatchObject({ status: 400, message: 'deadline must be in the future' })
  })
})

// ─── updateType ──────────────────────────────────────────────────────────────

describe('updateType', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('updates a type successfully', async () => {
    const updatedRow = { ...TYPE_ROW, name: 'Legjobb kapus' }
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
      [TYPE_ROW],
    ])
    const { setFn } = makeUpdateChain([updatedRow])
    mockUpdate.mockReturnValueOnce({ set: setFn })

    const result = await updateType(GROUP_ID, TYPE_ID, USER_ID, { name: 'Legjobb kapus' })

    expect(result.name).toBe('Legjobb kapus')
  })

  it('throws 404 if type not found or belongs to another group', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
      [],
    ])

    await expect(updateType(GROUP_ID, 'non-existent', USER_ID, { name: 'X' }))
      .rejects.toMatchObject({ status: 404, message: 'Special prediction type not found' })
  })

  it('throws 403 if not group admin', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_REGULAR],
    ])

    await expect(updateType(GROUP_ID, TYPE_ID, OTHER_USER_ID, { name: 'X' }))
      .rejects.toMatchObject({ status: 403, message: 'Not a group admin' })
  })
})

// ─── deactivateType ──────────────────────────────────────────────────────────

describe('deactivateType', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('deactivates a type (sets isActive = false)', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
      [TYPE_ROW],
    ])
    const terminal = Promise.resolve(undefined)
    const whereFn = vi.fn().mockReturnValue(terminal)
    const setFn = vi.fn().mockReturnValue({ where: whereFn, then: terminal.then.bind(terminal), catch: terminal.catch.bind(terminal), finally: terminal.finally.bind(terminal) })
    mockUpdate.mockReturnValueOnce({ set: setFn })

    await deactivateType(GROUP_ID, TYPE_ID, USER_ID)

    expect(mockUpdate).toHaveBeenCalled()
  })

  it('throws 404 if type not found', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_ADMIN],
      [],
    ])

    await expect(deactivateType(GROUP_ID, 'non-existent', USER_ID))
      .rejects.toMatchObject({ status: 404, message: 'Special prediction type not found' })
  })

  it('throws 403 if not group admin', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW_REGULAR],
    ])

    await expect(deactivateType(GROUP_ID, TYPE_ID, OTHER_USER_ID))
      .rejects.toMatchObject({ status: 403, message: 'Not a group admin' })
  })

  it('throws 404 if group does not exist', async () => {
    setupSelectSequence([[]])

    await expect(deactivateType(GROUP_ID, TYPE_ID, USER_ID))
      .rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })
})
