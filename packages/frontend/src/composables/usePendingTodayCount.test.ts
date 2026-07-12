import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePendingTodayCount } from './usePendingTodayCount.js'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import type { Match, Prediction } from '../types/index.js'

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    getCurrentInstance: () => null,
    onUnmounted: vi.fn(),
  }
})

// Test times anchored to 2026-06-15 (CEST, UTC+2 in Budapest).
// 08:00 Budapest = 06:00 UTC; 18:00 Budapest = 16:00 UTC; 02:00 Budapest = 00:00 UTC.
const NOW_08_BP = new Date('2026-06-15T06:00:00.000Z').getTime()
const NOW_18_BP = new Date('2026-06-15T16:00:00.000Z').getTime()
const NOW_02_BP = new Date('2026-06-15T00:00:00.000Z').getTime()

// Winter anchor: 2026-10-26 (Mon, after Hungary DST end → CET, UTC+1).
// 18:00 Budapest = 17:00 UTC.
const NOW_WINTER_18_BP = new Date('2026-10-26T17:00:00.000Z').getTime()

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm-1',
    homeTeam: { id: 'th', name: 'Home', shortCode: 'HOM', flagUrl: null, teamType: 'national', countryCode: 'HU', marketValueEur: null, transfermarktId: null },
    awayTeam: { id: 'ta', name: 'Away', shortCode: 'AWY', flagUrl: null, teamType: 'national', countryCode: 'AT', marketValueEur: null, transfermarktId: null },
    venue: null,
    league: null,
    stage: 'group',
    groupName: 'A',
    matchNumber: 1,
    scheduledAt: '2026-06-15T18:00:00.000Z',
    status: 'scheduled',
    result: null,
    ...overrides,
  }
}

function makePrediction(matchId: string): Prediction {
  return {
    id: `p-${matchId}`,
    userId: 'u-1',
    matchId,
    homeGoals: 1,
    awayGoals: 0,
    outcomeAfterDraw: null,
    pointsGlobal: null,
    pointsResult: null,
    scorerPickPlayerId: null,
    scorerPlayerNameSnapshot: null,
    scorerBonusPoints: null,
    createdAt: '2026-06-15T05:00:00.000Z',
    updatedAt: '2026-06-15T05:00:00.000Z',
  }
}

describe('usePendingTodayCount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts an un-tipped match scheduled today 20:00 Budapest when now is 08:00 Budapest', () => {
    vi.setSystemTime(NOW_08_BP)
    const matches = useMatchesStore()
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-06-15T18:00:00.000Z' })]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(1)
  })

  it('counts an un-tipped match scheduled tomorrow 06:00 Budapest (inside window) when now is 08:00 Budapest', () => {
    vi.setSystemTime(NOW_08_BP)
    const matches = useMatchesStore()
    // Tomorrow 06:00 Budapest CEST = 04:00 UTC.
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-06-16T04:00:00.000Z' })]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(1)
  })

  it('does NOT count a match tomorrow 09:00 Budapest (after window end) when now is 08:00 Budapest', () => {
    vi.setSystemTime(NOW_08_BP)
    const matches = useMatchesStore()
    // Tomorrow 09:00 Budapest CEST = 07:00 UTC, after the 07:00 Budapest cutoff.
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-06-16T07:00:00.000Z' })]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(0)
  })

  it('counts an un-tipped match today 06:00 Budapest when now is 02:00 Budapest (still in yesterday-evening window)', () => {
    vi.setSystemTime(NOW_02_BP)
    const matches = useMatchesStore()
    // Today 06:00 Budapest CEST = 04:00 UTC.
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-06-15T04:00:00.000Z' })]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(1)
  })

  it('does NOT count a match that has already kicked off (scheduledAt <= now)', () => {
    vi.setSystemTime(NOW_18_BP)
    const matches = useMatchesStore()
    // Today 17:30 Budapest CEST = 15:30 UTC, before now (16:00 UTC).
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-06-15T15:30:00.000Z' })]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(0)
  })

  it('does NOT count a match that already has a prediction', () => {
    vi.setSystemTime(NOW_08_BP)
    const matches = useMatchesStore()
    const predictions = usePredictionsStore()
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-06-15T18:00:00.000Z' })]
    predictions.predictions = [makePrediction('m1')]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(0)
  })

  it('does NOT count a match whose status is not scheduled', () => {
    vi.setSystemTime(NOW_08_BP)
    const matches = useMatchesStore()
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-06-15T18:00:00.000Z', status: 'finished' })]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(0)
  })

  it('handles winter time (CET, UTC+1) correctly — match at tomorrow 06:30 Budapest is inside the window', () => {
    vi.setSystemTime(NOW_WINTER_18_BP)
    const matches = useMatchesStore()
    // Tomorrow 06:30 Budapest CET = 05:30 UTC (UTC+1 in winter).
    matches.matches = [makeMatch({ id: 'm1', scheduledAt: '2026-10-27T05:30:00.000Z' })]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(1)
  })

  it('counts only un-tipped matches across a mixed list', () => {
    vi.setSystemTime(NOW_08_BP)
    const matches = useMatchesStore()
    const predictions = usePredictionsStore()
    matches.matches = [
      makeMatch({ id: 'm1', scheduledAt: '2026-06-15T18:00:00.000Z' }),                 // in-window, no tip → count
      makeMatch({ id: 'm2', scheduledAt: '2026-06-15T20:00:00.000Z' }),                 // in-window, has tip → skip
      makeMatch({ id: 'm3', scheduledAt: '2026-06-16T07:00:00.000Z' }),                 // out of window → skip
      makeMatch({ id: 'm4', scheduledAt: '2026-06-16T04:00:00.000Z', status: 'finished' }), // wrong status → skip
      makeMatch({ id: 'm5', scheduledAt: '2026-06-16T03:00:00.000Z' }),                 // in-window, no tip → count
    ]
    predictions.predictions = [makePrediction('m2')]

    const { pendingTodayCount } = usePendingTodayCount()

    expect(pendingTodayCount.value).toBe(2)
  })
})
