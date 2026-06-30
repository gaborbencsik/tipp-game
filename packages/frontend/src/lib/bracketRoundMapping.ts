import { deriveBracket } from './bracketDerive.js'
import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
  BracketRound,
} from '../types/index.js'

export class BracketTeamNotInRoundError extends Error {
  readonly teamId: string
  readonly round: BracketRound
  constructor(teamId: string, round: BracketRound) {
    super(`Team ${teamId} is not a participant of any ${round} match`)
    this.name = 'BracketTeamNotInRoundError'
    this.teamId = teamId
    this.round = round
  }
}

/**
 * Build a new BracketProgressionAnswer where the winners of `round` are derived from
 * the admin's selected team IDs. Earlier-round winners in `currentAnswer` are preserved;
 * existing winners of the same round are replaced (or cleared when `selectedTeamIds` is empty).
 *
 * Algorithm:
 *  1. Derive the bracket using the existing answer's winners + correctGroupStandings.
 *  2. For every match in `round`, look up the teamA/teamB derived from slot resolution.
 *  3. For each selected team, find the unique match in `round` it participates in and
 *     map matchId → teamId. Throw BracketTeamNotInRoundError when a team is not found.
 *  4. Merge: keep all other rounds' winners as-is; replace this round's winners entirely.
 */
export function mapRoundWinnersToBracketAnswer(
  round: BracketRound,
  selectedTeamIds: readonly string[],
  currentAnswer: BracketProgressionAnswer | null,
  template: readonly BracketMatch[],
  correctGroupStandings: AllGroupsStandingAnswer | null,
): BracketProgressionAnswer {
  const prevWinners = currentAnswer?.winners ?? {}
  const derived = deriveBracket(template, correctGroupStandings, prevWinners)

  // Strip previous winners belonging to `round` so the new selection fully owns the round.
  const nextWinners: Record<string, string> = {}
  for (const [matchId, teamId] of Object.entries(prevWinners)) {
    const match = template.find(m => m.id === matchId)
    if (!match) continue
    if (match.round === round) continue
    nextWinners[matchId] = teamId
  }

  if (selectedTeamIds.length === 0) {
    return { winners: nextWinners }
  }

  const roundMatches = derived.matches.filter(m => m.round === round)

  for (const teamId of selectedTeamIds) {
    const match = roundMatches.find(m => m.teamA === teamId || m.teamB === teamId)
    if (!match) {
      throw new BracketTeamNotInRoundError(teamId, round)
    }
    nextWinners[match.id] = teamId
  }

  return { winners: nextWinners }
}
