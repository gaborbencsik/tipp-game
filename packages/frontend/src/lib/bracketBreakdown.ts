import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
  BracketProgressionCorrectAnswer,
  BracketRound,
} from '../types/index.js'
import { deriveBracket, type DerivedBracket, type DerivedMatch } from './bracketDerive.js'
import { TOURNAMENT_POINTS } from './tournamentPoints.js'

/**
 * UX-045 — per-round breakdown of a bracket-progression tip after evaluation.
 *
 * Mirrors `scoreBracketProgressionWithParticipants()` on the backend so the frontend can
 * highlight which teams the user got right in each round and show a per-round point pill
 * without a server round-trip. Chip color / round-pill color both come from this data.
 *
 * Scoring rules (all set-based, same as backend):
 *  - last_32: user's slotA∪slotB set for round last_32 ∩ correct.participants.last_32 × 2p
 *  - last_16: user's WINNERS of last_32 ∩ correct.participants.last_16 × 3p
 *  - qf     : user's WINNERS of last_16 ∩ correct.participants.qf × 4p
 *  - sf     : user's WINNERS of qf ∩ correct.participants.sf × 6p
 *  - final  : user's WINNERS of sf ∩ correct.participants.final × 8p
 *  - champion: user's final-match winner === correct.champion → +10p
 *
 * "Pending" means the correct participants set for that round is empty — the admin has not
 * yet published the ground truth for that round. The UI should hide the point pill and use
 * neutral chip colors.
 */

export type BracketRoundKey = 'last_32' | 'last_16' | 'qf' | 'sf' | 'final'

export interface BracketRoundBreakdown {
  readonly matched: number
  readonly points: number
  readonly pointsPerTeam: number
  readonly pending?: boolean
}

export interface BracketBreakdown {
  readonly perRound: Readonly<Record<BracketRoundKey, BracketRoundBreakdown>>
  readonly championHit: boolean
  readonly championPoints: number
  readonly total: number
}

export type TeamRoundStatus = 'correct' | 'wrong' | 'pending'

const SCORED_ROUNDS: readonly BracketRoundKey[] = ['last_32', 'last_16', 'qf', 'sf', 'final']

function pointsPerTeamFor(round: BracketRoundKey): number {
  return TOURNAMENT_POINTS.perTeam[round]
}

function roundParticipantSet(matches: readonly DerivedMatch[], round: BracketRound): Set<string> {
  const s = new Set<string>()
  for (const m of matches) {
    if (m.round !== round) continue
    if (m.teamA) s.add(m.teamA)
    if (m.teamB) s.add(m.teamB)
  }
  return s
}

function roundWinnerSet(matches: readonly DerivedMatch[], round: BracketRound): Set<string> {
  const s = new Set<string>()
  for (const m of matches) {
    if (m.round !== round) continue
    if (m.winnerId) s.add(m.winnerId)
  }
  return s
}

function intersectSize(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0
  for (const x of a) if (b.has(x)) n += 1
  return n
}

function userSetForRound(user: DerivedBracket, round: BracketRoundKey): Set<string> {
  // last_32 uses participants (slotA∪slotB); every later round uses the WINNERS of the
  // previous round, matching the backend logic.
  if (round === 'last_32') return roundParticipantSet(user.matches, 'last_32')
  if (round === 'last_16') return roundWinnerSet(user.matches, 'last_32')
  if (round === 'qf') return roundWinnerSet(user.matches, 'last_16')
  if (round === 'sf') return roundWinnerSet(user.matches, 'qf')
  return roundWinnerSet(user.matches, 'sf')
}

export function computeBracketBreakdown(
  predicted: BracketProgressionAnswer,
  correct: BracketProgressionCorrectAnswer,
  template: readonly BracketMatch[],
  predictedGroupStandings: AllGroupsStandingAnswer | null,
): BracketBreakdown {
  const userBracket = deriveBracket(template, predictedGroupStandings, predicted.winners)

  const perRoundEntries: [BracketRoundKey, BracketRoundBreakdown][] = SCORED_ROUNDS.map(round => {
    const correctSet = new Set(correct.participants[round])
    const pointsPerTeam = pointsPerTeamFor(round)
    if (correctSet.size === 0) {
      return [round, { matched: 0, points: 0, pointsPerTeam, pending: true }]
    }
    const userSet = userSetForRound(userBracket, round)
    const matched = intersectSize(userSet, correctSet)
    return [round, { matched, points: matched * pointsPerTeam, pointsPerTeam }]
  })

  const perRound = Object.fromEntries(perRoundEntries) as Record<BracketRoundKey, BracketRoundBreakdown>

  const userChampion = userBracket.matches.find(m => m.round === 'final')?.winnerId ?? null
  const championHit = correct.champion !== null && userChampion === correct.champion
  const championPoints = championHit ? TOURNAMENT_POINTS.perTeam.champion : 0

  let total = championPoints
  for (const r of SCORED_ROUNDS) total += perRound[r].points

  return { perRound, championHit, championPoints, total }
}

/**
 * Chip-level status for a single team in a given round. Used by the picker to color the
 * team slot chips green/red after evaluation. `pending` means the ground truth for that
 * round hasn't been published yet — the chip should stay in its pre-eval color.
 */
export function teamStatusForRound(
  teamId: string | null,
  round: BracketRound,
  correct: BracketProgressionCorrectAnswer,
): TeamRoundStatus {
  if (!teamId) return 'pending'
  if (round === 'bronze') return 'pending'
  const set = correct.participants[round as BracketRoundKey]
  if (!set || set.length === 0) return 'pending'
  return set.includes(teamId) ? 'correct' : 'wrong'
}
