/**
 * Tournament-scoring constants — frontend SSOT mirroring
 * `packages/backend/src/services/tournament-scoring.constants.ts`.
 *
 * Kept in sync by the unit tests in `tournamentPoints.test.ts`. The constants are PO-locked
 * (plans/05-tournament-scoring.md §4) — a change here without a matching backend change
 * is a bug.
 */

export interface TournamentPoints {
  readonly perGroup: number
  readonly perTeam: {
    readonly last_32: number
    readonly last_16: number
    readonly qf: number
    readonly sf: number
    readonly final: number
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

/**
 * Returns `TOURNAMENT_POINTS.perGroup` when every position of `predicted` matches `correct`
 * exactly (same length, no nulls on either side); otherwise returns 0. All-or-nothing — PO
 * decision, see plans/05-tournament-scoring.md §4.
 */
export function scoreGroupExact(
  predicted: readonly (string | null)[] | null | undefined,
  correct: readonly (string | null)[] | null | undefined,
): number {
  if (!predicted || !correct) return 0
  if (predicted.length !== correct.length) return 0
  for (let i = 0; i < correct.length; i++) {
    const a = predicted[i]
    const c = correct[i]
    if (a === null || a === undefined) return 0
    if (c === null || c === undefined) return 0
    if (a !== c) return 0
  }
  return TOURNAMENT_POINTS.perGroup
}
