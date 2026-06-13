/**
 * Tournament scoring constants — single source of truth for global special prediction
 * (`is_global = true`) point values. Mirrors the user-facing rules shown in
 * `ScoringExplainerModal.vue` (`TOURNAMENT_RULES`).
 *
 * Decided by PO on 2026-06-12 (see plans/05-tournament-scoring.md §4).
 *
 * No partial credit on group standings: an exact 4-team order match scores `perGroup`,
 * any deviation scores 0. Knockout rounds are set-based — every team in the user's
 * derived round set that intersects with the correct derived set scores `perTeam[round]`.
 */

import type { BracketRound } from '../types/index.js'

export interface TournamentPoints {
  readonly perGroup: number
  readonly perTeam: Readonly<Record<Exclude<BracketRound, 'bronze'>, number>> & {
    readonly champion: number
  }
}

export const TOURNAMENT_POINTS: TournamentPoints = {
  perGroup: 3,
  perTeam: {
    last_32: 2,
    last_16: 3,
    qf: 4,
    sf: 6,
    final: 8,
    champion: 10,
  },
} as const

/** Slice codes accepted by the tournament evaluation flow. `null` ≡ full type. */
export type GroupStandingSlice =
  | 'group_A' | 'group_B' | 'group_C' | 'group_D' | 'group_E' | 'group_F'
  | 'group_G' | 'group_H' | 'group_I' | 'group_J' | 'group_K' | 'group_L'

export type BracketSlice = 'last_32' | 'last_16' | 'qf' | 'sf' | 'final' | 'bronze'

export type TournamentEvaluationSlice = GroupStandingSlice | BracketSlice | null

export const GROUP_STANDING_SLICES: readonly GroupStandingSlice[] = [
  'group_A', 'group_B', 'group_C', 'group_D', 'group_E', 'group_F',
  'group_G', 'group_H', 'group_I', 'group_J', 'group_K', 'group_L',
]

export const BRACKET_SLICES: readonly BracketSlice[] = [
  'last_32', 'last_16', 'qf', 'sf', 'final', 'bronze',
]

export function isGroupStandingSlice(value: string): value is GroupStandingSlice {
  return (GROUP_STANDING_SLICES as readonly string[]).includes(value)
}

export function isBracketSlice(value: string): value is BracketSlice {
  return (BRACKET_SLICES as readonly string[]).includes(value)
}

/** Extracts the single-letter group code from a `group_X` slice. */
export function groupCodeFromSlice(slice: GroupStandingSlice): string {
  return slice.slice('group_'.length)
}
