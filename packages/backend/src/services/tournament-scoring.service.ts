/**
 * Pure scoring helpers for global tournament-tip types.
 *
 * Decided in PLAN-001 (plans/05-tournament-scoring.md §4):
 *   - all_groups_standing: 3 points per perfectly-ordered group, 0 otherwise.
 *   - bracket_progression: set-based per-round (handled by `scoreBracketProgression`).
 *
 * These helpers are pure (no DB / no IO) and directly testable.
 */

import type { AllGroupsStandingAnswer } from '../types/index.js'
import { TOURNAMENT_POINTS, type GroupStandingSlice, groupCodeFromSlice, GROUP_STANDING_SLICES } from './tournament-scoring.constants.js'

/**
 * Score a single group's exact-order match. Returns `TOURNAMENT_POINTS.perGroup`
 * on a perfect match (every position equal, in order, no nulls), 0 otherwise.
 */
export function scoreGroup(
  predicted: AllGroupsStandingAnswer | null,
  correct: AllGroupsStandingAnswer | null,
  groupCode: string,
): number {
  if (!predicted || !correct) return 0
  const userPositions = predicted.groups[groupCode]
  const correctPositions = correct.groups[groupCode]
  if (!userPositions || !correctPositions) return 0
  if (userPositions.length !== correctPositions.length) return 0
  for (let i = 0; i < correctPositions.length; i++) {
    if (userPositions[i] !== correctPositions[i]) return 0
    if (userPositions[i] === null || correctPositions[i] === null) return 0
  }
  return TOURNAMENT_POINTS.perGroup
}

/**
 * Score the all_groups_standing prediction against a correct answer.
 * Always computes the *full* score (every group). The per-slice runner is the trigger
 * that re-runs this; it does NOT split into partial sums (idempotency contract — see
 * plans/05-tournament-scoring.md §5).
 */
export function scoreAllGroupsStanding(
  predicted: AllGroupsStandingAnswer | null,
  correct: AllGroupsStandingAnswer | null,
  availableGroups: readonly string[],
): number {
  let total = 0
  for (const code of availableGroups) {
    total += scoreGroup(predicted, correct, code)
  }
  return total
}

/**
 * Returns true when `slice` is a recognised `all_groups_standing` slice for the given options.
 * Used by the API layer to validate body input.
 */
export function isValidGroupSlice(slice: string, availableGroups: readonly string[]): boolean {
  if (!(GROUP_STANDING_SLICES as readonly string[]).includes(slice)) return false
  const code = groupCodeFromSlice(slice as GroupStandingSlice)
  return availableGroups.includes(code)
}
