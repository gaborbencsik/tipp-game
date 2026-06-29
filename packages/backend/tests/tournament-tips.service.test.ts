import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockInsert, mockUpdate, mockTransaction } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate, transaction: mockTransaction },
}))

import { listGlobalTypesWithPredictions, upsertGlobalPrediction, userHasTournamentAccess } from '../src/services/tournament-tips.service.js'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const FUTURE = new Date('2026-12-31T00:00:00.000Z')
const PAST = new Date('2025-01-01T00:00:00.000Z')
const USER_ID = 'user-uuid-1'
const TYPE_ID = 'type-uuid-1'
const PRED_ID = 'pred-uuid-1'
const VALID_TEAM_UUID = '11111111-2222-3333-4444-555555555555'
const ACCESS_GRANTED = [{ id: 'gm-1' }]
const ACCESS_DENIED: unknown[] = []

const GLOBAL_TYPE_ROW = {
  id: TYPE_ID,
  groupId: null,
  name: 'Gólkirály',
  description: 'Ki lesz a gólkirály?',
  inputType: 'text',
  options: null,
  deadline: FUTURE,
  points: 5,
  correctAnswer: null,
  isGlobal: true,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
}

const PRED_ROW = {
  id: PRED_ID,
  userId: USER_ID,
  typeId: TYPE_ID,
  groupId: null,
  answer: 'Messi',
  points: null,
  createdAt: NOW,
  updatedAt: NOW,
}

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(result)
  chain['then'] = terminal.then.bind(terminal)
  chain['catch'] = terminal.catch.bind(terminal)
  chain['finally'] = terminal.finally.bind(terminal)
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

function setupInsertReturning(returning: unknown[]): void {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn })
  mockInsert.mockReturnValue({ values: valuesFn })
}

function setupUpdateReturning(returning: unknown[]): void {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn })
  const setFn = vi.fn().mockReturnValue({ where: whereFn })
  mockUpdate.mockReturnValue({ set: setFn })
}

function setupTransaction(): void {
  mockTransaction.mockImplementation(async (cb) => {
    return cb({ select: mockSelect, insert: mockInsert, update: mockUpdate })
  })
}

function setupInsertOnConflictReturning(returning: unknown[]): void {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const onConflictDoUpdateFn = vi.fn().mockReturnValue({ returning: returningFn })
  const valuesFn = vi.fn().mockReturnValue({
    returning: returningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
  })
  mockInsert.mockReturnValue({ values: valuesFn })
}

describe('listGlobalTypesWithPredictions', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns global types with the user prediction merged', async () => {
    setupSelectSequence([
      ACCESS_GRANTED,
      [GLOBAL_TYPE_ROW],
      [PRED_ROW],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.typeName).toBe('Gólkirály')
    expect(result[0]?.answer).toBe('Messi')
    expect(result[0]?.isGlobal).toBe(true)
  })

  it('returns global types without predictions (answer null)', async () => {
    setupSelectSequence([
      ACCESS_GRANTED,
      [GLOBAL_TYPE_ROW],
      [],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.answer).toBeNull()
    expect(result[0]?.id).toBeNull()
  })

  it('returns empty list when no global types active', async () => {
    setupSelectSequence([
      ACCESS_GRANTED,
      [],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result).toEqual([])
  })

  it('hides correctAnswer until deadline passes', async () => {
    const TYPE_WITH_CORRECT = { ...GLOBAL_TYPE_ROW, correctAnswer: 'Mbappé' }
    setupSelectSequence([
      ACCESS_GRANTED,
      [TYPE_WITH_CORRECT],
      [],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result[0]?.correctAnswer).toBeNull()
  })

  it('reveals correctAnswer when deadline has passed', async () => {
    const TYPE_PAST = { ...GLOBAL_TYPE_ROW, deadline: PAST, correctAnswer: 'Mbappé' }
    setupSelectSequence([
      ACCESS_GRANTED,
      [TYPE_PAST],
      [],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result[0]?.correctAnswer).toBe('Mbappé')
  })

  it('uses short_name for player_select correctAnswerLabel after deadline', async () => {
    const PLAYER_UUID = '11111111-2222-3333-4444-555555555555'
    const PLAYER_TYPE = { ...GLOBAL_TYPE_ROW, inputType: 'player_select', deadline: PAST, correctAnswer: PLAYER_UUID }
    setupSelectSequence([
      ACCESS_GRANTED,
      [PLAYER_TYPE],
      [],
      [{ id: PLAYER_UUID, name: 'Vinícius José Paixão de Oliveira Júnior', shortName: 'Vinícius Júnior' }],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result[0]?.correctAnswer).toBe(PLAYER_UUID)
    expect(result[0]?.correctAnswerLabel).toBe('Vinícius Júnior')
  })

  it('falls back to long name when short_name is null for player_select', async () => {
    const PLAYER_UUID = '11111111-2222-3333-4444-555555555555'
    const PLAYER_TYPE = { ...GLOBAL_TYPE_ROW, inputType: 'player_select', deadline: PAST, correctAnswer: PLAYER_UUID }
    setupSelectSequence([
      ACCESS_GRANTED,
      [PLAYER_TYPE],
      [],
      [{ id: PLAYER_UUID, name: 'Lionel Andrés Messi Cuccittini', shortName: null }],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result[0]?.correctAnswerLabel).toBe('Lionel Andrés Messi Cuccittini')
  })

  // ─── UX-037: multi-correct-answer labels ──────────────────────────────────

  it('UX-037: joins multiple team_select correctAnswer labels (tie)', async () => {
    const T1 = '11111111-1111-1111-1111-111111111111'
    const T2 = '22222222-2222-2222-2222-222222222222'
    const TIE_TYPE = {
      ...GLOBAL_TYPE_ROW,
      inputType: 'team_select',
      deadline: PAST,
      correctAnswer: JSON.stringify([T1, T2]),
    }
    setupSelectSequence([
      ACCESS_GRANTED,
      [TIE_TYPE],
      [],
      [{ id: T1, name: 'Magyarország' }, { id: T2, name: 'Brazília' }], // teams lookup
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result[0]?.correctAnswer).toBe(JSON.stringify([T1, T2]))
    expect(result[0]?.correctAnswerLabel).toBe('Magyarország, Brazília')
  })

  it('UX-037: joins multiple player_select correctAnswer labels (tie)', async () => {
    const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const P2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const TIE_TYPE = {
      ...GLOBAL_TYPE_ROW,
      inputType: 'player_select',
      deadline: PAST,
      correctAnswer: JSON.stringify([P1, P2]),
    }
    setupSelectSequence([
      ACCESS_GRANTED,
      [TIE_TYPE],
      [],
      [
        { id: P1, name: 'Lionel Messi', shortName: 'Messi' },
        { id: P2, name: 'Cristiano Ronaldo', shortName: 'Ronaldo' },
      ],
    ])

    const result = await listGlobalTypesWithPredictions(USER_ID)

    expect(result[0]?.correctAnswerLabel).toBe('Lionel Messi, Cristiano Ronaldo')
  })

  it('throws 403 when user has no group with WC league', async () => {
    setupSelectSequence([ACCESS_DENIED])

    await expect(listGlobalTypesWithPredictions(USER_ID))
      .rejects.toThrow('No tournament access')
  })
})

describe('upsertGlobalPrediction', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('inserts a new prediction with groupId null when none exists', async () => {
    setupSelectSequence([
      ACCESS_GRANTED,
      [GLOBAL_TYPE_ROW],
      [], // eligibleGroups (none)
      [], // existing prediction lookup
    ])
    setupTransaction()
    setupInsertReturning([PRED_ROW])

    const result = await upsertGlobalPrediction(USER_ID, TYPE_ID, 'Messi')

    expect(result.answer).toBe('Messi')
    expect(result.isGlobal).toBe(true)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates an existing prediction when one already exists', async () => {
    const EXISTING = { ...PRED_ROW, answer: 'Old' }
    setupSelectSequence([
      ACCESS_GRANTED,
      [GLOBAL_TYPE_ROW],
      [], // eligibleGroups (none)
      [EXISTING],
    ])
    setupTransaction()
    setupUpdateReturning([{ ...PRED_ROW, answer: 'Mbappé' }])

    const result = await upsertGlobalPrediction(USER_ID, TYPE_ID, 'Mbappé')

    expect(result.answer).toBe('Mbappé')
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('throws 404 when type is not global or not active', async () => {
    setupSelectSequence([
      ACCESS_GRANTED,
      [],
    ])

    await expect(upsertGlobalPrediction(USER_ID, TYPE_ID, 'Messi'))
      .rejects.toThrow('Special prediction type not found')
  })

  it('throws 409 when deadline has passed', async () => {
    setupSelectSequence([
      ACCESS_GRANTED,
      [{ ...GLOBAL_TYPE_ROW, deadline: PAST }],
    ])

    await expect(upsertGlobalPrediction(USER_ID, TYPE_ID, 'Messi'))
      .rejects.toThrow('Deadline has passed')
  })

  it('throws 400 when answer is empty', async () => {
    setupSelectSequence([
      ACCESS_GRANTED,
      [GLOBAL_TYPE_ROW],
    ])

    await expect(upsertGlobalPrediction(USER_ID, TYPE_ID, '   '))
      .rejects.toThrow('answer is required')
  })

  it('throws 400 for dropdown answer not in options', async () => {
    const DROPDOWN_TYPE = { ...GLOBAL_TYPE_ROW, inputType: 'dropdown', options: ['A', 'B'] }
    setupSelectSequence([
      ACCESS_GRANTED,
      [DROPDOWN_TYPE],
    ])

    await expect(upsertGlobalPrediction(USER_ID, TYPE_ID, 'C'))
      .rejects.toThrow('answer must be one of the available options')
  })

  it('throws 400 for team_select with invalid uuid', async () => {
    const TEAM_TYPE = { ...GLOBAL_TYPE_ROW, inputType: 'team_select' }
    setupSelectSequence([
      ACCESS_GRANTED,
      [TEAM_TYPE],
    ])

    await expect(upsertGlobalPrediction(USER_ID, TYPE_ID, 'not-a-uuid'))
      .rejects.toThrow('Invalid team id')
  })

  it('resolves team name for team_select answer', async () => {
    const TEAM_TYPE = { ...GLOBAL_TYPE_ROW, inputType: 'team_select' }
    setupSelectSequence([
      ACCESS_GRANTED,
      [TEAM_TYPE],
      [{ id: VALID_TEAM_UUID, name: 'Magyarország' }],
      [], // eligibleGroups
      [], // existing prediction
    ])
    setupTransaction()
    setupInsertReturning([{ ...PRED_ROW, answer: VALID_TEAM_UUID }])

    const result = await upsertGlobalPrediction(USER_ID, TYPE_ID, VALID_TEAM_UUID)

    expect(result.answerLabel).toBe('Magyarország')
  })

  it('throws 403 when user has no group with WC league', async () => {
    setupSelectSequence([ACCESS_DENIED])

    await expect(upsertGlobalPrediction(USER_ID, TYPE_ID, 'Messi'))
      .rejects.toThrow('No tournament access')
  })
})

describe('userHasTournamentAccess', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns true when user is in a group linked to the WC league', async () => {
    setupSelectSequence([ACCESS_GRANTED])
    expect(await userHasTournamentAccess(USER_ID)).toBe(true)
  })

  it('returns false when user has no group linked to the WC league', async () => {
    setupSelectSequence([ACCESS_DENIED])
    expect(await userHasTournamentAccess(USER_ID)).toBe(false)
  })
})
