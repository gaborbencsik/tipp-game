import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, update: mockUpdate },
}))

import { evaluateSpecialPrediction, setCorrectAnswer } from '../src/services/special-prediction-evaluation.service.js'

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
