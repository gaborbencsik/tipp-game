import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

import { getMyPredictions, upsertPrediction } from '../src/services/special-predictions.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')
const FUTURE = new Date('2026-12-31T00:00:00.000Z')
const PAST = new Date('2025-01-01T00:00:00.000Z')
const GROUP_ID = 'group-uuid-1'
const USER_ID = 'user-uuid-1'
const TYPE_ID = 'type-uuid-1'
const PRED_ID = 'pred-uuid-1'

const GROUP_ROW = { id: GROUP_ID, deletedAt: null }
const MEMBER_ROW = { id: 'gm-uuid-1', groupId: GROUP_ID, userId: USER_ID, isAdmin: false }

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

const TYPE_ROW_DROPDOWN = {
  ...TYPE_ROW,
  id: 'type-uuid-2',
  name: 'Döntős',
  inputType: 'dropdown',
  options: ['Magyarország', 'Németország', 'Franciaország'],
}

const TYPE_ROW_EXPIRED = {
  ...TYPE_ROW,
  id: 'type-uuid-3',
  deadline: PAST,
}

const TYPE_ROW_PLAYER_SELECT = {
  ...TYPE_ROW,
  id: 'type-uuid-4',
  name: 'Gólkirály',
  inputType: 'player_select',
  options: null,
}

const VALID_PLAYER_UUID = '11111111-2222-3333-4444-555555555555'

const PLAYER_ROW = { id: VALID_PLAYER_UUID, name: 'Messi', teamId: 'team-uuid-1' }

const PRED_ROW = {
  id: PRED_ID,
  userId: USER_ID,
  typeId: TYPE_ID,
  answer: 'Messi',
  points: null,
  createdAt: NOW,
  updatedAt: NOW,
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

function setupSelectSequence(results: unknown[]): void {
  let callIndex = 0
  mockSelect.mockImplementation(() => {
    const result = results[callIndex] ?? []
    callIndex++
    return makeSelectChain(result)
  })
}

function makeInsertChain(returning: unknown[] = []) {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const onConflictFn = vi.fn().mockReturnValue({ returning: returningFn })
  const valuesFn = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictFn, returning: returningFn })
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn })
  return { insertFn, valuesFn, onConflictFn, returningFn }
}

// ─── getMyPredictions ────────────────────────────────────────────────────────

describe('getMyPredictions', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns types with user predictions merged', async () => {
    // 1. assertGroupExists, 2. assertGroupMember, 3. group-scoped types, 4. global subscribed types, 5. predictions
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW],
      [],
      [PRED_ROW],
    ])

    const result = await getMyPredictions(GROUP_ID, USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.typeName).toBe('Gólkirály')
    expect(result[0]?.answer).toBe('Messi')
    expect(result[0]?.points).toBeNull()
  })

  it('returns types without predictions (answer = null)', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW],
      [],
      [],
    ])

    const result = await getMyPredictions(GROUP_ID, USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.answer).toBeNull()
    expect(result[0]?.id).toBeNull()
  })

  it('returns empty when no active types', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [],
      [],
    ])

    const result = await getMyPredictions(GROUP_ID, USER_ID)

    expect(result).toEqual([])
  })

  it('hides correctAnswer before deadline', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [{ ...TYPE_ROW, correctAnswer: 'Mbappe' }],
      [],
      [],
    ])

    const result = await getMyPredictions(GROUP_ID, USER_ID)

    expect(result[0]?.correctAnswer).toBeNull()
  })

  it('shows correctAnswer after deadline', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [{ ...TYPE_ROW_EXPIRED, correctAnswer: 'Mbappe' }],
      [],
      [],
    ])

    const result = await getMyPredictions(GROUP_ID, USER_ID)

    expect(result[0]?.correctAnswer).toBe('Mbappe')
  })

  it('throws 404 if group not found', async () => {
    setupSelectSequence([[]])

    await expect(getMyPredictions(GROUP_ID, USER_ID))
      .rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })

  it('throws 403 if not a member', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [],
    ])

    await expect(getMyPredictions(GROUP_ID, 'stranger'))
      .rejects.toMatchObject({ status: 403, message: 'Not a member of this group' })
  })
})

// ─── upsertPrediction ────────────────────────────────────────────────────────

describe('upsertPrediction', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('creates a new prediction', async () => {
    // 1. assertGroupExists, 2. assertGroupMember, 3. select type
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW],
    ])
    const { insertFn } = makeInsertChain([PRED_ROW])
    mockInsert.mockImplementation(insertFn)

    const result = await upsertPrediction(GROUP_ID, USER_ID, { typeId: TYPE_ID, answer: 'Messi' })

    expect(result.answer).toBe('Messi')
    expect(result.typeId).toBe(TYPE_ID)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('throws 409 when deadline has passed', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW_EXPIRED],
    ])

    await expect(upsertPrediction(GROUP_ID, USER_ID, { typeId: 'type-uuid-3', answer: 'Messi' }))
      .rejects.toMatchObject({ status: 409, message: 'Deadline has passed for this prediction type' })
  })

  it('throws 400 for dropdown with invalid option', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW_DROPDOWN],
    ])

    await expect(upsertPrediction(GROUP_ID, USER_ID, { typeId: 'type-uuid-2', answer: 'Brazília' }))
      .rejects.toMatchObject({ status: 400, message: 'answer must be one of the available options' })
  })

  it('accepts valid dropdown option', async () => {
    const predRow = { ...PRED_ROW, typeId: 'type-uuid-2', answer: 'Magyarország' }
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW_DROPDOWN],
    ])
    const { insertFn } = makeInsertChain([predRow])
    mockInsert.mockImplementation(insertFn)

    const result = await upsertPrediction(GROUP_ID, USER_ID, { typeId: 'type-uuid-2', answer: 'Magyarország' })

    expect(result.answer).toBe('Magyarország')
  })

  it('throws 400 for empty answer', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW],
    ])

    await expect(upsertPrediction(GROUP_ID, USER_ID, { typeId: TYPE_ID, answer: '   ' }))
      .rejects.toMatchObject({ status: 400, message: 'answer is required' })
  })

  it('throws 404 if type not found or belongs to another group', async () => {
    // 1. assertGroupExists, 2. assertGroupMember, 3. group-scoped type (empty), 4. global type fallback (empty)
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [],
      [],
    ])

    await expect(upsertPrediction(GROUP_ID, USER_ID, { typeId: 'non-existent', answer: 'X' }))
      .rejects.toMatchObject({ status: 404, message: 'Special prediction type not found' })
  })

  it('throws 403 if not a member', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [],
    ])

    await expect(upsertPrediction(GROUP_ID, 'stranger', { typeId: TYPE_ID, answer: 'X' }))
      .rejects.toMatchObject({ status: 403, message: 'Not a member of this group' })
  })

  it('throws 400 for answer exceeding 500 characters', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW],
    ])

    const longAnswer = 'a'.repeat(501)
    await expect(upsertPrediction(GROUP_ID, USER_ID, { typeId: TYPE_ID, answer: longAnswer }))
      .rejects.toMatchObject({ status: 400, message: 'answer must be at most 500 characters' })
  })

  it('accepts player_select with valid player UUID', async () => {
    const predRow = { ...PRED_ROW, typeId: 'type-uuid-4', answer: VALID_PLAYER_UUID }
    // 1. assertGroupExists, 2. assertGroupMember, 3. select type, 4. select player (UUID lookup)
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW_PLAYER_SELECT],
      [PLAYER_ROW],
    ])
    const { insertFn } = makeInsertChain([predRow])
    mockInsert.mockImplementation(insertFn)

    const result = await upsertPrediction(GROUP_ID, USER_ID, { typeId: 'type-uuid-4', answer: VALID_PLAYER_UUID })

    expect(result.answer).toBe(VALID_PLAYER_UUID)
  })

  it('throws 400 for player_select with invalid UUID format', async () => {
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW_PLAYER_SELECT],
    ])

    await expect(upsertPrediction(GROUP_ID, USER_ID, { typeId: 'type-uuid-4', answer: 'not-a-uuid' }))
      .rejects.toMatchObject({ status: 400, message: 'Invalid player id' })
  })

  it('throws 400 for player_select with non-existent player UUID', async () => {
    // 1. assertGroupExists, 2. assertGroupMember, 3. select type, 4. select player (empty)
    setupSelectSequence([
      [GROUP_ROW],
      [MEMBER_ROW],
      [TYPE_ROW_PLAYER_SELECT],
      [],
    ])

    await expect(upsertPrediction(GROUP_ID, USER_ID, { typeId: 'type-uuid-4', answer: VALID_PLAYER_UUID }))
      .rejects.toMatchObject({ status: 400, message: 'Invalid player id' })
  })
})
