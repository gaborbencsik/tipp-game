import type { MatchOutcome, MatchResult, MatchStage } from '../types/index.js'

// UX-043: status helper for the "döntetlen esetén továbbjutó" tipp visibility.
//
// A pontozás (`scoring.service.ts`) csak akkor ad bonus pontot, ha a meccs ténylegesen döntetlennel zárult
// és a tipp `outcomeAfterDraw` mezője megegyezik a `match_results.outcomeAfterDraw`-val. A UI viszont
// a tippet kiértékelés után is mutatja, vizuális státusszal:
//
// - 'not-applicable'   → a meccs nem knockout (csoportkör), a tipp mezőt ne is mutassuk.
// - 'no-tip'           → knockout meccs, de a user nem adott meg outcomeAfterDraw-t.
// - 'pending'          → a meccs még nem ért véget, vagy az admin még nem rögzítette a result outcome-ot.
// - 'inactive'         → a meccs nem döntetlennel zárult, így a tipp nem aktiválódott.
// - 'correct'          → a tipp aktiválódott és a továbbjutó csapatot a user eltalálta (+ pont).
// - 'incorrect'        → a tipp aktiválódott de a user mást tippelt (0 pont).
export type OutcomeAfterDrawStatus =
  | 'not-applicable'
  | 'no-tip'
  | 'pending'
  | 'inactive'
  | 'correct'
  | 'incorrect'

export type OutcomeAdvancer = 'home' | 'away'

const KNOCKOUT_STAGES: ReadonlySet<MatchStage> = new Set<MatchStage>([
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
])

export function isKnockoutStage(stage: MatchStage): boolean {
  return KNOCKOUT_STAGES.has(stage)
}

export function outcomeAdvancer(outcome: MatchOutcome | null | undefined): OutcomeAdvancer | null {
  if (outcome === 'extra_time_home' || outcome === 'penalties_home') return 'home'
  if (outcome === 'extra_time_away' || outcome === 'penalties_away') return 'away'
  return null
}

interface ResolveInput {
  readonly stage: MatchStage
  readonly result: Pick<MatchResult, 'homeGoals' | 'awayGoals' | 'outcomeAfterDraw'> | null
  readonly predictionOutcome: MatchOutcome | null | undefined
  // Ha true, a pontozás csak az advancer (home/away) egyezést nézi, az ET vs PK kindot ignorálja.
  // Ez tükrözi a scoring.service jelenlegi viselkedését (UX-037 + US-205): a továbbjutó számít.
  readonly advancerOnly?: boolean
}

export function resolveOutcomeAfterDrawStatus(input: ResolveInput): OutcomeAfterDrawStatus {
  if (!isKnockoutStage(input.stage)) return 'not-applicable'
  if (input.predictionOutcome == null) return 'no-tip'
  if (input.result === null) return 'pending'
  if (input.result.homeGoals !== input.result.awayGoals) return 'inactive'
  if (input.result.outcomeAfterDraw == null) return 'pending'
  if (input.advancerOnly === true) {
    const predAdv = outcomeAdvancer(input.predictionOutcome)
    const actualAdv = outcomeAdvancer(input.result.outcomeAfterDraw)
    return predAdv === actualAdv ? 'correct' : 'incorrect'
  }
  return input.predictionOutcome === input.result.outcomeAfterDraw ? 'correct' : 'incorrect'
}
