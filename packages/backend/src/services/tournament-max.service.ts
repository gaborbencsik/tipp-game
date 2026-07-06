import type { SpecialPredictionInputType } from '../types/index.js'
import { TOURNAMENT_POINTS } from './tournament-scoring.constants.js'
import { parseAllGroupsStandingAnswer, validateAllGroupsStandingOptions } from './group-standings.service.js'
import { parseBracketProgressionCorrectAnswer } from './bracket-progression.service.js'
import { resolveUpsetMaxPoints, validateUpsetOptions } from './upset-special.service.js'

/**
 * Minimal shape of `special_prediction_types` needed to compute the maximum
 * reachable points for a single type. Kept structurally compatible with the
 * Drizzle row so callers can pass rows straight from a `select`.
 */
export interface SpecialPredictionTypeLike {
  readonly inputType: SpecialPredictionInputType | string
  readonly options: unknown
  readonly points: number
  readonly correctAnswer: string | null
}

/**
 * Maximum reachable points for a single tournament tip type given its currently-set
 * `correctAnswer`. Partial-evaluation aware:
 *
 *   - `all_groups_standing`: counts only groups whose 4 positions are fully populated,
 *     multiplied by `TOURNAMENT_POINTS.perGroup`.
 *   - `bracket_progression`: sums `perTeam[round] × participants[round].length` for each
 *     round key present in the new participants-shape payload, plus `perTeam.champion` if
 *     `champion !== null`. Returns 0 for the legacy winners-map payload (max per round is
 *     not encoded there).
 *   - `multi_team_weighted`: `resolveUpsetMaxPoints(options)` (top-N choice weights).
 *   - Anything else: `type.points` (the DB-stored max for simple types).
 *
 * Returns 0 whenever the payload is missing, malformed, or the type's options are invalid.
 * The caller is expected to gate this by "correctAnswer is set" — passing an unresolved
 * type here just yields 0 for the tournament types.
 */
export function computeTypeMaxPoints(type: SpecialPredictionTypeLike): number {
  const raw = type.correctAnswer?.trim() ?? ''

  if (type.inputType === 'all_groups_standing') {
    if (raw.length === 0) return 0
    const opts = validateAllGroupsStandingOptions(type.options)
    if (!opts) return 0
    const parsed = parseAllGroupsStandingAnswer(raw)
    if (!parsed) return 0
    let fullyPopulated = 0
    for (const code of opts.groups) {
      const positions = parsed.groups[code]
      if (!positions) continue
      if (positions.length !== opts.teamsPerGroup) continue
      if (positions.every((entry) => entry !== null)) fullyPopulated += 1
    }
    return fullyPopulated * TOURNAMENT_POINTS.perGroup
  }

  if (type.inputType === 'bracket_progression') {
    if (raw.length === 0) return 0
    const parsed = parseBracketProgressionCorrectAnswer(raw)
    if (!parsed) return 0
    let total = 0
    total += parsed.participants.last_32.length * TOURNAMENT_POINTS.perTeam.last_32
    total += parsed.participants.last_16.length * TOURNAMENT_POINTS.perTeam.last_16
    total += parsed.participants.qf.length * TOURNAMENT_POINTS.perTeam.qf
    total += parsed.participants.sf.length * TOURNAMENT_POINTS.perTeam.sf
    total += parsed.participants.final.length * TOURNAMENT_POINTS.perTeam.final
    if (parsed.champion !== null) total += TOURNAMENT_POINTS.perTeam.champion
    return total
  }

  if (type.inputType === 'multi_team_weighted') {
    const opts = validateUpsetOptions(type.options)
    if (!opts) return 0
    return resolveUpsetMaxPoints(opts)
  }

  return type.points
}
