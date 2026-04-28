import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePendingSpecialTips } from './usePendingSpecialTips.js'
import { useGroupsStore } from '../stores/groups.store.js'
import type { SpecialPredictionWithType, Group } from '../types/index.js'

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    getCurrentInstance: () => null,
    onUnmounted: vi.fn(),
  }
})

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime()
const FUTURE_1 = '2026-06-20T18:00:00.000Z'
const FUTURE_2 = '2026-06-25T18:00:00.000Z'
const PAST = '2026-06-10T18:00:00.000Z'

function makeGroup(id: string, name: string): Group {
  return {
    id,
    name,
    description: null,
    inviteCode: 'ABC123',
    inviteActive: true,
    createdBy: 'user-1',
    memberCount: 5,
    isAdmin: false,
    userRank: 1,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

function makePrediction(overrides: Partial<SpecialPredictionWithType> = {}): SpecialPredictionWithType {
  return {
    id: 'pred-1',
    typeId: 'type-1',
    typeName: 'Gólkirály',
    typeDescription: null,
    inputType: 'text',
    options: null,
    deadline: FUTURE_1,
    maxPoints: 5,
    answer: null,
    answerLabel: null,
    points: null,
    correctAnswer: null,
    correctAnswerLabel: null,
    isGlobal: false,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  }
}

describe('usePendingSpecialTips', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty when groups list is empty', () => {
    const { pendingGroups, totalPendingCount } = usePendingSpecialTips()

    expect(pendingGroups.value).toEqual([])
    expect(totalPendingCount.value).toBe(0)
  })

  it('returns pending count for group with unanswered predictions before deadline', () => {
    const store = useGroupsStore()
    store.groups = [makeGroup('g1', 'Csoport A')]
    store.specialPredictionsMap = {
      g1: [
        makePrediction({ typeId: 't1', deadline: FUTURE_1 }),
        makePrediction({ typeId: 't2', deadline: FUTURE_2 }),
      ],
    }

    const { pendingGroups, totalPendingCount } = usePendingSpecialTips()

    expect(pendingGroups.value).toHaveLength(1)
    expect(pendingGroups.value[0]?.pendingCount).toBe(2)
    expect(pendingGroups.value[0]?.nearestDeadline).toBe(FUTURE_1)
    expect(totalPendingCount.value).toBe(2)
  })

  it('excludes group where all predictions are answered', () => {
    const store = useGroupsStore()
    store.groups = [makeGroup('g1', 'Csoport A')]
    store.specialPredictionsMap = {
      g1: [
        makePrediction({ typeId: 't1', answer: 'Messi' }),
        makePrediction({ typeId: 't2', answer: 'Mbappé' }),
      ],
    }

    const { pendingGroups, totalPendingCount } = usePendingSpecialTips()

    expect(pendingGroups.value).toEqual([])
    expect(totalPendingCount.value).toBe(0)
  })

  it('excludes predictions whose deadline has passed', () => {
    const store = useGroupsStore()
    store.groups = [makeGroup('g1', 'Csoport A')]
    store.specialPredictionsMap = {
      g1: [
        makePrediction({ typeId: 't1', deadline: PAST, answer: null }),
      ],
    }

    const { pendingGroups, totalPendingCount } = usePendingSpecialTips()

    expect(pendingGroups.value).toEqual([])
    expect(totalPendingCount.value).toBe(0)
  })

  it('skips groups whose specialPredictionsMap is undefined (not loaded)', () => {
    const store = useGroupsStore()
    store.groups = [makeGroup('g1', 'Csoport A'), makeGroup('g2', 'Csoport B')]
    store.specialPredictionsMap = {
      g1: [makePrediction({ typeId: 't1' })],
    }

    const { pendingGroups, totalPendingCount } = usePendingSpecialTips()

    expect(pendingGroups.value).toHaveLength(1)
    expect(pendingGroups.value[0]?.groupId).toBe('g1')
    expect(totalPendingCount.value).toBe(1)
  })

  it('handles multiple groups with mixed states', () => {
    const store = useGroupsStore()
    store.groups = [makeGroup('g1', 'A'), makeGroup('g2', 'B'), makeGroup('g3', 'C')]
    store.specialPredictionsMap = {
      g1: [makePrediction({ typeId: 't1' }), makePrediction({ typeId: 't2', answer: 'X' })],
      g2: [makePrediction({ typeId: 't3', deadline: PAST })],
      g3: [makePrediction({ typeId: 't4', deadline: FUTURE_2 })],
    }

    const { pendingGroups, totalPendingCount } = usePendingSpecialTips()

    expect(pendingGroups.value).toHaveLength(2)
    expect(pendingGroups.value[0]?.groupId).toBe('g1')
    expect(pendingGroups.value[0]?.pendingCount).toBe(1)
    expect(pendingGroups.value[1]?.groupId).toBe('g3')
    expect(pendingGroups.value[1]?.pendingCount).toBe(1)
    expect(totalPendingCount.value).toBe(2)
  })

  it('deadline exactly equal to now is not pending (strict >)', () => {
    const store = useGroupsStore()
    const exactNow = new Date(NOW).toISOString()
    store.groups = [makeGroup('g1', 'A')]
    store.specialPredictionsMap = {
      g1: [makePrediction({ typeId: 't1', deadline: exactNow })],
    }

    const { pendingGroups } = usePendingSpecialTips()

    expect(pendingGroups.value).toEqual([])
  })
})
