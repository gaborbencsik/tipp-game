import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockUpdate, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, update: mockUpdate, insert: mockInsert },
}))

import {
  evaluateSpecialPrediction,
  setCorrectAnswer,
  setGlobalCorrectAnswer,
  evaluateGlobalTypeSlice,
} from '../src/services/special-prediction-evaluation.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')
const FUTURE = new Date('2026-12-31T00:00:00.000Z')
const GROUP_ID = 'group-uuid-1'
const USER_ID = 'user-uuid-1'
const TYPE_ID = 'type-uuid-1'

const MEMBER_ROW_ADMIN = { isAdmin: true }
const MEMBER_ROW_REGULAR = { isAdmin: false }

const TYPE_ROW = {
  id: TYPE_ID,
  groupId: GROUP_ID,
  name: 'Gólkirály',
  description: null,
  inputType: 'text',
  options: null,
  deadline: FUTURE,
  points: 5,
  correctAnswer: null,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
}

const PRED_ROW_CORRECT = {
  id: 'pred-uuid-1',
  userId: 'user-uuid-2',
  typeId: TYPE_ID,
  answer: 'Messi',
  points: null,
  createdAt: NOW,
  updatedAt: NOW,
}

const PRED_ROW_WRONG = {
  id: 'pred-uuid-2',
  userId: 'user-uuid-3',
  typeId: TYPE_ID,
  answer: 'Ronaldo',
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
  chain['leftJoin'] = vi.fn().mockReturnValue(chain)
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

function makeUpdateChain(returning: unknown[] = []) {
  const returningFn = vi.fn().mockResolvedValue(returning)
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn })
  const setFn = vi.fn().mockReturnValue({ where: whereFn })
  return { setFn, whereFn, returningFn }
}

function makeSimpleUpdateChain() {
  const terminal = Promise.resolve(undefined)
  const whereFn = vi.fn().mockReturnValue(terminal)
  const setFn = vi.fn().mockReturnValue({ where: whereFn, then: terminal.then.bind(terminal), catch: terminal.catch.bind(terminal), finally: terminal.finally.bind(terminal) })
  return { setFn }
}

// ─── evaluateSpecialPrediction (pure function) ───────────────────────────────

describe('evaluateSpecialPrediction', () => {
  it('exact match → full points', () => {
    expect(evaluateSpecialPrediction('Messi', 'Messi', 5)).toBe(5)
  })

  it('case insensitive → full points', () => {
    expect(evaluateSpecialPrediction('messi', 'Messi', 5)).toBe(5)
  })

  it('leading/trailing whitespace → full points', () => {
    expect(evaluateSpecialPrediction('  Messi  ', 'Messi', 5)).toBe(5)
  })

  it('accented characters normalized → full points (è vs e)', () => {
    expect(evaluateSpecialPrediction('Varga', 'Vàrga', 10)).toBe(10)
  })

  it('accented characters: Müller vs Muller', () => {
    expect(evaluateSpecialPrediction('Müller', 'Muller', 5)).toBe(5)
  })

  it('wrong answer → 0 points', () => {
    expect(evaluateSpecialPrediction('Ronaldo', 'Messi', 5)).toBe(0)
  })

  it('empty vs non-empty → 0 points', () => {
    expect(evaluateSpecialPrediction('', 'Messi', 5)).toBe(0)
  })

  it('different maxPoints value', () => {
    expect(evaluateSpecialPrediction('Messi', 'Messi', 100)).toBe(100)
  })

  // ─── UX-037: multi-correct-answer support (JSON array correctAnswer) ──────

  describe('JSON-array correctAnswer (UX-037)', () => {
    it('any match in JSON array → full points', () => {
      const correct = JSON.stringify(['Messi', 'Ronaldo', 'Mbappe'])
      expect(evaluateSpecialPrediction('Messi', correct, 5)).toBe(5)
      expect(evaluateSpecialPrediction('Ronaldo', correct, 5)).toBe(5)
      expect(evaluateSpecialPrediction('Mbappe', correct, 5)).toBe(5)
    })

    it('any match in JSON array is case-insensitive + accent-normalized', () => {
      const correct = JSON.stringify(['Müller', 'Várga'])
      expect(evaluateSpecialPrediction('muller', correct, 5)).toBe(5)
      expect(evaluateSpecialPrediction('VARGA', correct, 5)).toBe(5)
    })

    it('no match in JSON array → 0 points', () => {
      const correct = JSON.stringify(['Messi', 'Ronaldo'])
      expect(evaluateSpecialPrediction('Mbappe', correct, 5)).toBe(0)
    })

    it('single-element JSON array equivalent to plain string', () => {
      const correct = JSON.stringify(['Messi'])
      expect(evaluateSpecialPrediction('Messi', correct, 5)).toBe(5)
      expect(evaluateSpecialPrediction('Ronaldo', correct, 5)).toBe(0)
    })

    it('empty JSON array → 0 points', () => {
      expect(evaluateSpecialPrediction('Messi', '[]', 5)).toBe(0)
    })

    it('JSON array filters out empty / whitespace entries', () => {
      const correct = JSON.stringify(['', '  ', 'Messi'])
      expect(evaluateSpecialPrediction('Messi', correct, 5)).toBe(5)
      // An empty user pick must NOT match the empty entries in the array.
      expect(evaluateSpecialPrediction('', correct, 5)).toBe(0)
    })

    it('UUID-shaped multi-correct (team_select / player_select style)', () => {
      const t1 = '11111111-1111-1111-1111-111111111111'
      const t2 = '22222222-2222-2222-2222-222222222222'
      const correct = JSON.stringify([t1, t2])
      expect(evaluateSpecialPrediction(t1, correct, 3)).toBe(3)
      expect(evaluateSpecialPrediction(t2, correct, 3)).toBe(3)
      expect(evaluateSpecialPrediction('33333333-3333-3333-3333-333333333333', correct, 3)).toBe(0)
    })

    it('malformed JSON falls back to single-string match (BC)', () => {
      // Looks like an array but is not valid JSON → treat as literal string.
      const malformed = '["Messi","Ronaldo"' // missing closing bracket
      expect(evaluateSpecialPrediction(malformed, malformed, 5)).toBe(5)
      expect(evaluateSpecialPrediction('Messi', malformed, 5)).toBe(0)
    })

    it('non-array JSON (object) falls back to single-string match', () => {
      const json = JSON.stringify({ winner: 'Messi' })
      // The user would have to type the same JSON to match, not 'Messi'.
      expect(evaluateSpecialPrediction('Messi', json, 5)).toBe(0)
      expect(evaluateSpecialPrediction(json, json, 5)).toBe(5)
    })
  })
})

// ─── setCorrectAnswer ────────────────────────────────────────────────────────

describe('setCorrectAnswer', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('sets correct answer and calculates points for all predictions', async () => {
    // 1. assertGroupAdmin, 2. select type, 3. select predictions
    setupSelectSequence([
      [MEMBER_ROW_ADMIN],
      [TYPE_ROW],
      [PRED_ROW_CORRECT, PRED_ROW_WRONG],
    ])

    const updatedType = { ...TYPE_ROW, correctAnswer: 'Messi' }
    const { setFn: typeSetFn } = makeUpdateChain([updatedType])
    const { setFn: predSetFn1 } = makeSimpleUpdateChain()
    const { setFn: predSetFn2 } = makeSimpleUpdateChain()

    let updateCallIndex = 0
    mockUpdate.mockImplementation(() => {
      const fns = [{ set: typeSetFn }, { set: predSetFn1 }, { set: predSetFn2 }]
      const fn = fns[updateCallIndex]
      updateCallIndex++
      return fn
    })

    const result = await setCorrectAnswer(GROUP_ID, TYPE_ID, USER_ID, 'Messi')

    expect(result.correctAnswer).toBe('Messi')
    expect(mockUpdate).toHaveBeenCalledTimes(3) // 1 type + 2 predictions
  })

  it('throws 403 if not a member', async () => {
    setupSelectSequence([[]])

    await expect(setCorrectAnswer(GROUP_ID, TYPE_ID, 'stranger', 'Messi'))
      .rejects.toMatchObject({ status: 403, message: 'Not a member of this group' })
  })

  it('throws 403 if not admin', async () => {
    setupSelectSequence([
      [MEMBER_ROW_REGULAR],
    ])

    await expect(setCorrectAnswer(GROUP_ID, TYPE_ID, USER_ID, 'Messi'))
      .rejects.toMatchObject({ status: 403, message: 'Not a group admin' })
  })

  it('throws 404 if type not found', async () => {
    setupSelectSequence([
      [MEMBER_ROW_ADMIN],
      [],
    ])

    await expect(setCorrectAnswer(GROUP_ID, 'non-existent', USER_ID, 'Messi'))
      .rejects.toMatchObject({ status: 404, message: 'Special prediction type not found' })
  })

  it('idempotent: re-running recalculates points', async () => {
    setupSelectSequence([
      [MEMBER_ROW_ADMIN],
      [{ ...TYPE_ROW, correctAnswer: 'OldAnswer' }],
      [PRED_ROW_CORRECT],
    ])

    const updatedType = { ...TYPE_ROW, correctAnswer: 'Messi' }
    const { setFn: typeSetFn } = makeUpdateChain([updatedType])
    const { setFn: predSetFn } = makeSimpleUpdateChain()

    let updateCallIndex = 0
    mockUpdate.mockImplementation(() => {
      const fns = [{ set: typeSetFn }, { set: predSetFn }]
      const fn = fns[updateCallIndex]
      updateCallIndex++
      return fn
    })

    const result = await setCorrectAnswer(GROUP_ID, TYPE_ID, USER_ID, 'Messi')

    expect(result.correctAnswer).toBe('Messi')
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })
})

// ─── setGlobalCorrectAnswer (US-1311) ────────────────────────────────────────

const GLOBAL_TYPE_ROW = {
  id: TYPE_ID,
  groupId: null,
  name: 'Torna gólkirály',
  description: null,
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

describe('setGlobalCorrectAnswer', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('persists correctAnswer without recomputing predictions', async () => {
    setupSelectSequence([[GLOBAL_TYPE_ROW]])
    const updatedRow = { ...GLOBAL_TYPE_ROW, correctAnswer: 'Messi' }
    const { setFn } = makeUpdateChain([updatedRow])
    mockUpdate.mockReturnValueOnce({ set: setFn })

    const result = await setGlobalCorrectAnswer(TYPE_ID, 'Messi')

    expect(result.correctAnswer).toBe('Messi')
    expect(result.isGlobal).toBe(true)
    expect(mockUpdate).toHaveBeenCalledTimes(1) // only the type, no predictions recomputed
  })

  it('throws 404 when type does not exist or is not global', async () => {
    setupSelectSequence([[]])
    await expect(setGlobalCorrectAnswer('missing', 'x'))
      .rejects.toMatchObject({ status: 404 })
  })

  // UX-037: reject empty JSON-array as correct answer
  it('throws 400 when correctAnswer is an empty JSON array', async () => {
    setupSelectSequence([[GLOBAL_TYPE_ROW]])
    await expect(setGlobalCorrectAnswer(TYPE_ID, '[]'))
      .rejects.toMatchObject({ status: 400 })
  })

  it('accepts a JSON array correctAnswer with multiple values', async () => {
    setupSelectSequence([[GLOBAL_TYPE_ROW]])
    const correctAnswer = JSON.stringify(['Messi', 'Ronaldo'])
    const updatedRow = { ...GLOBAL_TYPE_ROW, correctAnswer }
    const { setFn } = makeUpdateChain([updatedRow])
    mockUpdate.mockReturnValueOnce({ set: setFn })

    const result = await setGlobalCorrectAnswer(TYPE_ID, correctAnswer)

    expect(result.correctAnswer).toBe(correctAnswer)
  })
})

// ─── evaluateGlobalTypeSlice (US-1311) ───────────────────────────────────────

describe('evaluateGlobalTypeSlice', () => {
  beforeEach(() => { vi.resetAllMocks() })

  function setupInsertSpy(): { calls: unknown[] } {
    const calls: unknown[] = []
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: unknown) => {
        calls.push(v)
        return Promise.resolve(undefined)
      }),
    }))
    return { calls }
  }

  it('throws 404 when type does not exist', async () => {
    setupSelectSequence([[]])
    await expect(evaluateGlobalTypeSlice('missing', null, USER_ID))
      .rejects.toMatchObject({ status: 404 })
  })

  it('throws 400 when correctAnswer is empty', async () => {
    setupSelectSequence([[{ ...GLOBAL_TYPE_ROW, correctAnswer: '' }]])
    await expect(evaluateGlobalTypeSlice(TYPE_ID, null, USER_ID))
      .rejects.toMatchObject({ status: 400 })
  })

  it('throws 400 when type is inactive', async () => {
    setupSelectSequence([[{ ...GLOBAL_TYPE_ROW, isActive: false, correctAnswer: 'Messi' }]])
    await expect(evaluateGlobalTypeSlice(TYPE_ID, null, USER_ID))
      .rejects.toMatchObject({ status: 400 })
  })

  it('recomputes points for every active user and writes an audit log', async () => {
    const typeRow = { ...GLOBAL_TYPE_ROW, correctAnswer: 'Messi' }
    const userPreds = [
      { id: 'p1', userId: 'u1', answer: 'Messi' },     // matches → 5p
      { id: 'p2', userId: 'u2', answer: 'Ronaldo' },  // no match → 0p
    ]
    setupSelectSequence([
      [typeRow],     // 1: load type
      userPreds,     // 2: load active users' predictions (joined with users, isNull deletedAt)
    ])
    const { setFn: predUpdateSetFn1 } = makeSimpleUpdateChain()
    const { setFn: predUpdateSetFn2 } = makeSimpleUpdateChain()
    let updateCallIdx = 0
    mockUpdate.mockImplementation(() => {
      const fns = [{ set: predUpdateSetFn1 }, { set: predUpdateSetFn2 }]
      const fn = fns[updateCallIdx]
      updateCallIdx++
      return fn
    })
    const { calls: insertCalls } = setupInsertSpy()

    const result = await evaluateGlobalTypeSlice(TYPE_ID, 'group_A', USER_ID, '127.0.0.1')

    expect(result.evaluatedCount).toBe(2)
    expect(result.totalPoints).toBe(5) // only Messi matches
    expect(result.lastRunAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({
      action: 'result_set',
      entityType: 'special_prediction_type',
      entityId: TYPE_ID,
      actorId: USER_ID,
      ipAddress: '127.0.0.1',
      newValue: { slice: 'group_A', evaluatedCount: 2, totalPoints: 5 },
    })
  })

  it('is idempotent — re-running yields the same totals', async () => {
    const typeRow = { ...GLOBAL_TYPE_ROW, correctAnswer: 'Messi' }
    const userPreds = [{ id: 'p1', userId: 'u1', answer: 'Messi' }]

    // First run.
    setupSelectSequence([[typeRow], userPreds])
    mockUpdate.mockImplementation(() => {
      const { setFn } = makeSimpleUpdateChain()
      return { set: setFn }
    })
    setupInsertSpy()
    const r1 = await evaluateGlobalTypeSlice(TYPE_ID, null, USER_ID)

    // Second run with same fixtures — must produce identical result.
    setupSelectSequence([[typeRow], userPreds])
    setupInsertSpy()
    const r2 = await evaluateGlobalTypeSlice(TYPE_ID, null, USER_ID)

    expect(r1.totalPoints).toBe(r2.totalPoints)
    expect(r1.evaluatedCount).toBe(r2.evaluatedCount)
  })
})
