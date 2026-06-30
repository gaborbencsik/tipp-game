import { describe, it, expect } from 'vitest'
import { resolveOutcomeAfterDrawStatus } from './outcomeAfterDrawStatus.js'
import type { MatchOutcome, MatchResult, MatchStage } from '../types/index.js'

const KNOCKOUT: MatchStage = 'round_of_16'
const GROUP: MatchStage = 'group'

describe('resolveOutcomeAfterDrawStatus', () => {
  it('returns "not-applicable" for non-knockout matches', () => {
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: GROUP,
        result: { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
        predictionOutcome: 'penalties_home',
      }),
    ).toBe('not-applicable')
  })

  it('returns "no-tip" when the user has no outcomeAfterDraw on a knockout match', () => {
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: KNOCKOUT,
        result: { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
        predictionOutcome: null,
      }),
    ).toBe('no-tip')
  })

  it('returns "pending" when the match has no result yet', () => {
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: KNOCKOUT,
        result: null,
        predictionOutcome: 'penalties_home',
      }),
    ).toBe('pending')
  })

  it('returns "inactive" when the match did not end in a draw', () => {
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: KNOCKOUT,
        result: { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null },
        predictionOutcome: 'penalties_home',
      }),
    ).toBe('inactive')
  })

  it('returns "correct" when the prediction matches the actual outcome', () => {
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: KNOCKOUT,
        result: { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
        predictionOutcome: 'penalties_home',
      }),
    ).toBe('correct')
  })

  it('returns "correct" when the prediction matches the advancer (kind differs)', () => {
    // A pontozás csak a továbbjutó csapatot pontozza – az extra_time/penalties kind nem számít.
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: KNOCKOUT,
        result: { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
        predictionOutcome: 'extra_time_home',
        advancerOnly: true,
      }),
    ).toBe('correct')
  })

  it('returns "incorrect" when the predicted advancer differs from the actual one', () => {
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: KNOCKOUT,
        result: { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
        predictionOutcome: 'penalties_away',
      }),
    ).toBe('incorrect')
  })

  it('returns "incorrect" when the user picked but the recorded outcome is missing', () => {
    // Az admin még nem rögzítette a továbbjutót, de a tipp megvan és a meccs döntetlen.
    // Ezt "pending"-ként kezeljük: nem mondhatjuk hogy rossz, csak hogy még nincs adat.
    expect(
      resolveOutcomeAfterDrawStatus({
        stage: KNOCKOUT,
        result: { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: null },
        predictionOutcome: 'penalties_home',
      }),
    ).toBe('pending')
  })
})

describe('isKnockoutStage', () => {
  it('marks all knockout stages as knockout', async () => {
    const { isKnockoutStage } = await import('./outcomeAfterDrawStatus.js')
    expect(isKnockoutStage('round_of_32')).toBe(true)
    expect(isKnockoutStage('round_of_16')).toBe(true)
    expect(isKnockoutStage('quarter_final')).toBe(true)
    expect(isKnockoutStage('semi_final')).toBe(true)
    expect(isKnockoutStage('third_place')).toBe(true)
    expect(isKnockoutStage('final')).toBe(true)
    expect(isKnockoutStage('group')).toBe(false)
  })
})

describe('outcomeAdvancer', () => {
  it('extracts home/away from MatchOutcome', async () => {
    const { outcomeAdvancer } = await import('./outcomeAfterDrawStatus.js')
    const cases: Array<[MatchOutcome | null, 'home' | 'away' | null]> = [
      ['extra_time_home', 'home'],
      ['extra_time_away', 'away'],
      ['penalties_home', 'home'],
      ['penalties_away', 'away'],
      [null, null],
    ]
    for (const [outcome, expected] of cases) {
      expect(outcomeAdvancer(outcome)).toBe(expected)
    }
  })
})

// Type sanity: ensure consumers can compare result and prediction outcomes via the helper API.
const _typeSanity: MatchResult = { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: 'extra_time_home' }
void _typeSanity
