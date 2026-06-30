/**
 * UX-045: build a per-round scored view of the user's bracket-progression tip vs. the
 * admin's correctAnswer. The user side always stores match-level winners (legacy shape).
 * The correct side may be either the legacy `BracketProgressionAnswer` (deriving sets via
 * `deriveBracket`) or the new `BracketProgressionCorrectAnswer` (per-round participant
 * arrays — UX-044). Mirrors `scoreBracketProgression` on the backend.
 */

import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
  BracketProgressionCorrectAnswer,
  BracketRound,
  Team,
} from '../types/index.js'
import { deriveBracket } from './bracketDerive.js'
import { TOURNAMENT_POINTS } from './tournamentPoints.js'

export type ScoredRound = Exclude<BracketRound, 'bronze'>

export const SCORED_ROUNDS: readonly ScoredRound[] = ['last_32', 'last_16', 'qf', 'sf', 'final']

/** Expected total for a round to be considered "fully evaluated" by the admin. */
const ROUND_TARGET: Readonly<Record<ScoredRound, number>> = {
  last_32: 32, last_16: 16, qf: 8, sf: 4, final: 2,
}

export type CellStatus = 'hit' | 'miss' | 'unknown'

export interface RoundTeamCell {
  readonly teamId: string
  readonly status: CellStatus
  /** Kept for backward-compatibility — true ⇔ status === 'hit'. */
  readonly hit: boolean
}

export interface ScoredRoundView {
  readonly round: ScoredRound
  readonly pointsPerTeam: number
  readonly userTeams: readonly RoundTeamCell[]
  /** Teams the correct answer (this round) includes but the user missed. */
  readonly missedTeams: readonly string[]
  readonly hitCount: number
  readonly correctTotal: number
  readonly pointsEarned: number
  /** True when the admin has evaluated this round (or a narrower one — subset chain). */
  readonly evaluated: boolean
}

export interface ChampionView {
  readonly userPick: string | null
  readonly correct: string | null
  readonly status: CellStatus
  /** Kept for backward-compatibility — true ⇔ status === 'hit'. */
  readonly hit: boolean
  readonly pointsEarned: number
}

export interface BracketScoredView {
  readonly rounds: readonly ScoredRoundView[]
  readonly champion: ChampionView
  readonly totalPoints: number
}

interface CorrectSets {
  readonly last_32: ReadonlySet<string>
  readonly last_16: ReadonlySet<string>
  readonly qf: ReadonlySet<string>
  readonly sf: ReadonlySet<string>
  readonly final: ReadonlySet<string>
  readonly champion: string | null
}

export function isBracketProgressionCorrectAnswer(value: unknown): value is BracketProgressionCorrectAnswer {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.participants !== 'object' || v.participants === null) return false
  const p = v.participants as Record<string, unknown>
  return Array.isArray(p.last_32) && Array.isArray(p.last_16) && Array.isArray(p.qf)
    && Array.isArray(p.sf) && Array.isArray(p.final)
}

export function parseCorrectAnswer(raw: string | null | undefined): BracketProgressionAnswer | BracketProgressionCorrectAnswer | null {
  if (!raw) return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (isBracketProgressionCorrectAnswer(parsed)) return parsed
  if (typeof parsed === 'object' && parsed !== null && 'winners' in parsed) {
    const w = (parsed as { winners: unknown }).winners
    if (typeof w === 'object' && w !== null) {
      const winners: Record<string, string> = {}
      for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
        if (typeof v === 'string') winners[k] = v
      }
      return { winners }
    }
  }
  return null
}

function correctSetsFromParticipants(answer: BracketProgressionCorrectAnswer): CorrectSets {
  return {
    last_32: new Set(answer.participants.last_32),
    last_16: new Set(answer.participants.last_16),
    qf: new Set(answer.participants.qf),
    sf: new Set(answer.participants.sf),
    final: new Set(answer.participants.final),
    champion: answer.champion,
  }
}

function correctSetsFromLegacy(
  answer: BracketProgressionAnswer,
  template: readonly BracketMatch[],
  correctGroupStandings: AllGroupsStandingAnswer | null,
): CorrectSets {
  const bracket = deriveBracket(template, correctGroupStandings, answer.winners)
  const last32 = new Set<string>()
  for (const m of bracket.matches) {
    if (m.round !== 'last_32') continue
    if (m.teamA) last32.add(m.teamA)
    if (m.teamB) last32.add(m.teamB)
  }
  const winnerSet = (round: BracketRound): Set<string> => {
    const s = new Set<string>()
    for (const m of bracket.matches) {
      if (m.round === round && m.winnerId) s.add(m.winnerId)
    }
    return s
  }
  return {
    last_32: last32,
    last_16: winnerSet('last_32'),
    qf: winnerSet('last_16'),
    sf: winnerSet('qf'),
    final: winnerSet('sf'),
    champion: bracket.matches.find(m => m.round === 'final')?.winnerId ?? null,
  }
}

interface UserSets {
  readonly last_32: readonly string[]
  readonly last_16: readonly string[]
  readonly qf: readonly string[]
  readonly sf: readonly string[]
  readonly final: readonly string[]
  readonly champion: string | null
}

function userSetsFromAnswer(
  answer: BracketProgressionAnswer,
  template: readonly BracketMatch[],
  userGroupStandings: AllGroupsStandingAnswer | null,
): UserSets {
  const bracket = deriveBracket(template, userGroupStandings, answer.winners)
  const last32Order: string[] = []
  const seen = new Set<string>()
  for (const m of bracket.matches) {
    if (m.round !== 'last_32') continue
    for (const t of [m.teamA, m.teamB]) {
      if (t && !seen.has(t)) {
        seen.add(t)
        last32Order.push(t)
      }
    }
  }
  const winnerList = (round: BracketRound): readonly string[] => {
    const arr: string[] = []
    const set = new Set<string>()
    for (const m of bracket.matches) {
      if (m.round !== round) continue
      if (m.winnerId && !set.has(m.winnerId)) {
        set.add(m.winnerId)
        arr.push(m.winnerId)
      }
    }
    return arr
  }
  return {
    last_32: last32Order,
    last_16: winnerList('last_32'),
    qf: winnerList('last_16'),
    sf: winnerList('qf'),
    final: winnerList('sf'),
    champion: bracket.matches.find(m => m.round === 'final')?.winnerId ?? null,
  }
}

export function buildBracketScoredView(input: {
  readonly userAnswer: BracketProgressionAnswer
  readonly correctAnswer: BracketProgressionAnswer | BracketProgressionCorrectAnswer
  readonly template: readonly BracketMatch[]
  readonly userGroupStandings: AllGroupsStandingAnswer | null
  readonly correctGroupStandings: AllGroupsStandingAnswer | null
}): BracketScoredView {
  const correctSets = isBracketProgressionCorrectAnswer(input.correctAnswer)
    ? correctSetsFromParticipants(input.correctAnswer)
    : correctSetsFromLegacy(input.correctAnswer, input.template, input.correctGroupStandings)

  const userSets = userSetsFromAnswer(input.userAnswer, input.template, input.userGroupStandings)

  // A round is "evaluated" iff the admin's correct set for it reaches the expected size.
  // For the legacy `{winners:{...}}` shape `correctSetsFromLegacy` only returns a non-empty
  // set when there are actual winners in that round, so the same size check works there too.
  const evaluatedByRound: Record<ScoredRound, boolean> = {
    last_32: correctSets.last_32.size >= ROUND_TARGET.last_32,
    last_16: correctSets.last_16.size >= ROUND_TARGET.last_16,
    qf: correctSets.qf.size >= ROUND_TARGET.qf,
    sf: correctSets.sf.size >= ROUND_TARGET.sf,
    final: correctSets.final.size >= ROUND_TARGET.final,
  }

  const rounds: ScoredRoundView[] = []
  for (let i = 0; i < SCORED_ROUNDS.length; i++) {
    const r = SCORED_ROUNDS[i]!
    const correct = correctSets[r]
    const userTeamsList = userSets[r]
    const evaluated = evaluatedByRound[r]
    // Cascade rule: when the current round is NOT evaluated, fall back to the closest upstream
    // (wider) round that IS evaluated. If the user's team is not in that wider set, it has
    // already been eliminated — render as miss. Otherwise the team is still "alive" and we
    // don't know its fate yet → unknown.
    let upstreamEvaluatedSet: ReadonlySet<string> | null = null
    if (!evaluated) {
      for (let j = i - 1; j >= 0; j--) {
        const rp = SCORED_ROUNDS[j]!
        if (evaluatedByRound[rp]) {
          upstreamEvaluatedSet = correctSets[rp]
          break
        }
      }
    }

    const userTeams: RoundTeamCell[] = userTeamsList.map(teamId => {
      let status: CellStatus
      if (evaluated) {
        status = correct.has(teamId) ? 'hit' : 'miss'
      } else if (upstreamEvaluatedSet) {
        status = upstreamEvaluatedSet.has(teamId) ? 'unknown' : 'miss'
      } else {
        status = 'unknown'
      }
      return { teamId, status, hit: status === 'hit' }
    })
    const hitCount = userTeams.reduce((n, c) => n + (c.status === 'hit' ? 1 : 0), 0)
    const missedTeams: string[] = []
    if (evaluated) {
      const userSet = new Set(userTeamsList)
      for (const teamId of correct) {
        if (!userSet.has(teamId)) missedTeams.push(teamId)
      }
    }
    const pointsPerTeam = TOURNAMENT_POINTS.perTeam[r]
    rounds.push({
      round: r,
      pointsPerTeam,
      userTeams,
      missedTeams,
      hitCount,
      // Until the round is evaluated, treat the target as the "correctTotal" so the badge
      // shows e.g. "3 / 32" rather than "3 / 0" — gives the user a sense of scale.
      correctTotal: evaluated ? correct.size : ROUND_TARGET[r],
      pointsEarned: hitCount * pointsPerTeam,
      evaluated,
    })
  }

  const championCorrect = correctSets.champion
  const championPick = userSets.champion
  let championStatus: CellStatus
  if (championCorrect !== null) {
    championStatus = championPick !== null && championPick === championCorrect ? 'hit' : 'miss'
  } else if (championPick !== null) {
    // No champion declared yet — but if the user's pick has already been eliminated upstream
    // (e.g. not in the evaluated final/sf set), render as miss; otherwise unknown.
    const finalSetEvaluated = evaluatedByRound.final
    if (finalSetEvaluated && !correctSets.final.has(championPick)) {
      championStatus = 'miss'
    } else {
      championStatus = 'unknown'
    }
  } else {
    championStatus = 'unknown'
  }
  const championView: ChampionView = {
    userPick: championPick,
    correct: championCorrect,
    status: championStatus,
    hit: championStatus === 'hit',
    pointsEarned: championStatus === 'hit' ? TOURNAMENT_POINTS.perTeam.champion : 0,
  }

  const totalPoints = rounds.reduce((n, r) => n + r.pointsEarned, 0) + championView.pointsEarned

  return { rounds, champion: championView, totalPoints }
}

export function teamNameOf(teamId: string, teams: ReadonlyMap<string, Team>): string {
  return teams.get(teamId)?.name ?? teamId.slice(0, 8)
}
