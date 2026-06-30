import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
  BracketProgressionCompletion,
  BracketProgressionOptions,
  BracketProgressionRoundCompletion,
  BracketRound,
} from '../types/index.js'
import { FIFA_WC2026_ANNEX_C } from './wc2026-annex-c.js'
import { TOURNAMENT_POINTS } from './tournament-scoring.constants.js'

export interface BracketContext {
  readonly groupStandings: AllGroupsStandingAnswer | null
  readonly bracketTemplate: BracketProgressionOptions['bracketTemplate']
}

export interface DerivedMatch {
  readonly id: string
  readonly round: BracketRound
  readonly slotA: string
  readonly slotB: string
  readonly teamA: string | null
  readonly teamB: string | null
  readonly winnerId: string | null
  readonly isLocked: boolean
}

export interface DerivedBracket {
  readonly matches: readonly DerivedMatch[]
}

export interface BracketValidationOk {
  readonly answer: BracketProgressionAnswer
  readonly completion: BracketProgressionCompletion
}

export interface BracketValidationErr {
  readonly error: string
}

const ROUND_ORDER: readonly BracketRound[] = ['last_32', 'last_16', 'qf', 'sf', 'final', 'bronze']

export function parseBracketProgressionAnswer(json: string): BracketProgressionAnswer | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const winnersRaw = (parsed as Record<string, unknown>).winners
  if (typeof winnersRaw !== 'object' || winnersRaw === null || Array.isArray(winnersRaw)) return null
  const winners: Record<string, string> = {}
  for (const [matchId, teamId] of Object.entries(winnersRaw as Record<string, unknown>)) {
    if (typeof teamId !== 'string') return null
    winners[matchId] = teamId
  }
  return { winners }
}

export function validateBracketProgressionOptions(options: unknown): BracketProgressionOptions | null {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) return null
  const candidate = options as Record<string, unknown>
  const tpl = candidate.bracketTemplate
  if (typeof tpl !== 'object' || tpl === null || Array.isArray(tpl)) return null
  const matches = (tpl as Record<string, unknown>).matches
  if (!Array.isArray(matches)) return null
  const validated: BracketMatch[] = []
  for (const m of matches) {
    if (typeof m !== 'object' || m === null) return null
    const entry = m as Record<string, unknown>
    if (typeof entry.id !== 'string') return null
    if (typeof entry.round !== 'string' || !ROUND_ORDER.includes(entry.round as BracketRound)) return null
    if (typeof entry.slotA !== 'string') return null
    if (typeof entry.slotB !== 'string') return null
    if (entry.winnerTo !== null && typeof entry.winnerTo !== 'string') return null
    validated.push({
      id: entry.id,
      round: entry.round as BracketRound,
      slotA: entry.slotA,
      slotB: entry.slotB,
      winnerTo: entry.winnerTo as string | null,
    })
  }
  return { bracketTemplate: { matches: validated } }
}

/**
 * Resolve a slot code to a concrete team id, given the user's group-standings tip and
 * already-picked winners. Returns null if the slot cannot yet be determined (locked).
 *
 * Slot codes:
 *  - W_<X>1   : 1st place of group X (US-945 groups[X][0])
 *  - RU_<X>1  : 2nd place of group X (US-945 groups[X][1])
 *  - 3rd_<5L> : 3rd-placed team mapped via FIFA Annex C — picks the candidate from the
 *               5-letter combo whose group is among the 8 best 3rds, then the slot's
 *               group-winner association maps that to a single qualifying group.
 *  - <matchId>        : winner of the upstream match
 *  - <matchId_loser>  : loser of the upstream match (only used by bronze)
 */
export function resolveSlot(
  slotCode: string,
  ctx: BracketContext,
  winners: Readonly<Record<string, string>>,
): string | null {
  if (slotCode.startsWith('<') && slotCode.endsWith('>')) {
    const inner = slotCode.slice(1, -1)
    if (inner.endsWith('_loser')) {
      const upstreamId = inner.slice(0, -'_loser'.length)
      return resolveLoser(upstreamId, ctx, winners)
    }
    return winners[inner] ?? null
  }

  if (!ctx.groupStandings) return null

  if (slotCode.startsWith('W_')) {
    // Format: W_<groupCode>1 — slice 2 to length-1
    const code = slotCode.slice(2, -1)
    const positions = ctx.groupStandings.groups[code]
    return positions?.[0] ?? null
  }

  if (slotCode.startsWith('RU_')) {
    const code = slotCode.slice(3, -1)
    const positions = ctx.groupStandings.groups[code]
    return positions?.[1] ?? null
  }

  if (slotCode.startsWith('3rd_')) {
    return resolveBest3rdSlot(slotCode, ctx)
  }

  return null
}

function resolveLoser(
  upstreamId: string,
  ctx: BracketContext,
  winners: Readonly<Record<string, string>>,
): string | null {
  const winnerId = winners[upstreamId]
  if (!winnerId) return null
  const upstream = ctx.bracketTemplate.matches.find(m => m.id === upstreamId)
  if (!upstream) return null
  // The loser is the other team in the upstream pair.
  const teamA = resolveSlot(upstream.slotA, ctx, winners)
  const teamB = resolveSlot(upstream.slotB, ctx, winners)
  if (teamA === winnerId) return teamB
  if (teamB === winnerId) return teamA
  return null
}

/**
 * Resolve `3rd_<5L>` using FIFA Annex C.
 *
 * Algorithm:
 *  1. Determine which 8 groups have a qualifying best-3rd team from the user's tip
 *     (the 8 best3rds; we need to know which group each came from — derived from
 *     groupStandings by looking up which group's 3rd-place position contains each id).
 *  2. Find the slot's "owner" — the W_<X>1 it pairs with in the bracket template
 *     (e.g. l32_m7 has slotA W_A1 / slotB 3rd_CEFHI, so the slot's owner is "1A").
 *  3. Look up FIFA_WC2026_ANNEX_C[sortedGroups][ownerSlot] to get the assigned 3rd-group.
 *  4. The team is groupStandings.groups[that-group][2] (3rd place).
 *  5. Sanity-check: the assigned group must also be in the 5-letter combo from the slot code.
 */
function resolveBest3rdSlot(slotCode: string, ctx: BracketContext): string | null {
  const standings = ctx.groupStandings
  if (!standings) return null
  const combo = slotCode.slice(4) // "ABCDF" or similar
  if (!/^[A-L]+$/.test(combo)) return null

  // Find which 8 groups have a 3rd-place team selected by the user (best3rds).
  const qualifyingGroups = new Set<string>()
  for (const teamId of standings.best3rds) {
    for (const [groupCode, positions] of Object.entries(standings.groups)) {
      if (positions[2] === teamId) {
        qualifyingGroups.add(groupCode)
        break
      }
    }
  }
  if (qualifyingGroups.size !== 8) return null

  const annexKey = [...qualifyingGroups].sort().join('')
  const row = FIFA_WC2026_ANNEX_C[annexKey]
  if (!row) return null

  // Find the slot's owner — the match where this `3rd_*` slot appears, and read the
  // paired W_<X>1 slot to get the owner code (e.g. "1A").
  const ownerSlot = findOwnerSlotForThirdSlot(slotCode, ctx.bracketTemplate.matches)
  if (!ownerSlot) return null

  const assignedGroup = row[ownerSlot]
  if (!assignedGroup) return null

  // Sanity: assigned group should be in the 5-letter combo
  if (!combo.includes(assignedGroup)) return null

  return standings.groups[assignedGroup]?.[2] ?? null
}

function findOwnerSlotForThirdSlot(slotCode: string, matches: readonly BracketMatch[]): string | null {
  for (const m of matches) {
    const otherSlot = m.slotA === slotCode ? m.slotB : m.slotB === slotCode ? m.slotA : null
    if (!otherSlot) continue
    if (otherSlot.startsWith('W_')) {
      const code = otherSlot.slice(2, -1)
      return `1${code}`
    }
  }
  return null
}

export function deriveBracket(
  template: readonly BracketMatch[],
  groupStandings: AllGroupsStandingAnswer | null,
  winners: Readonly<Record<string, string>>,
): DerivedBracket {
  const ctx: BracketContext = { groupStandings, bracketTemplate: { matches: template } }
  const matches: DerivedMatch[] = template.map(m => {
    const teamA = resolveSlot(m.slotA, ctx, winners)
    const teamB = resolveSlot(m.slotB, ctx, winners)
    const isLocked = teamA === null || teamB === null
    const winnerId = winners[m.id] ?? null
    return {
      id: m.id,
      round: m.round,
      slotA: m.slotA,
      slotB: m.slotB,
      teamA,
      teamB,
      winnerId,
      isLocked,
    }
  })
  return { matches }
}

export function validateBracketProgressionAnswer(
  answer: BracketProgressionAnswer,
  options: BracketProgressionOptions,
  groupStandings: AllGroupsStandingAnswer | null,
): BracketValidationOk | BracketValidationErr {
  const matchById = new Map(options.bracketTemplate.matches.map(m => [m.id, m]))
  const sanitized: Record<string, string> = {}

  // First sweep: validate every winner is one of {teamA, teamB} for that match.
  // We need to derive iteratively — a downstream match's pair depends on upstream picks.
  // Strategy: process by round order so upstream is already in sanitized when downstream is checked.
  const byRound: Record<BracketRound, string[]> = {
    last_32: [], last_16: [], qf: [], sf: [], final: [], bronze: [],
  }
  for (const [matchId] of Object.entries(answer.winners)) {
    const m = matchById.get(matchId)
    if (!m) return { error: `unknown_match:${matchId}` }
    byRound[m.round].push(matchId)
  }

  for (const round of ROUND_ORDER) {
    for (const matchId of byRound[round]) {
      const m = matchById.get(matchId)!
      const teamId = answer.winners[matchId]
      const ctx: BracketContext = { groupStandings, bracketTemplate: options.bracketTemplate }
      const teamA = resolveSlot(m.slotA, ctx, sanitized)
      const teamB = resolveSlot(m.slotB, ctx, sanitized)
      if (teamId !== teamA && teamId !== teamB) {
        return { error: `team_not_in_match:${matchId}` }
      }
      sanitized[matchId] = teamId
    }
  }

  return {
    answer: { winners: sanitized },
    completion: computeBracketCompletion({ winners: sanitized }, options.bracketTemplate.matches),
  }
}

export function computeBracketCompletion(
  answer: BracketProgressionAnswer,
  template: readonly BracketMatch[],
): BracketProgressionCompletion {
  const totals: Record<BracketRound, number> = { last_32: 0, last_16: 0, qf: 0, sf: 0, final: 0, bronze: 0 }
  const dones: Record<BracketRound, number> = { last_32: 0, last_16: 0, qf: 0, sf: 0, final: 0, bronze: 0 }
  for (const m of template) totals[m.round] += 1
  for (const [matchId] of Object.entries(answer.winners)) {
    const m = template.find(t => t.id === matchId)
    if (m) dones[m.round] += 1
  }
  const picksByRound: Record<BracketRound, BracketProgressionRoundCompletion> = {
    last_32: { done: dones.last_32, total: totals.last_32 },
    last_16: { done: dones.last_16, total: totals.last_16 },
    qf: { done: dones.qf, total: totals.qf },
    sf: { done: dones.sf, total: totals.sf },
    final: { done: dones.final, total: totals.final },
    bronze: { done: dones.bronze, total: totals.bronze },
  }
  let totalDone = 0
  let totalSteps = 0
  for (const r of ROUND_ORDER) {
    totalDone += dones[r]
    totalSteps += totals[r]
  }
  return { picksByRound, totalDone, totalSteps }
}

export function findDownstreamMatches(matchId: string, template: readonly BracketMatch[]): string[] {
  const result = new Set<string>()
  const queue: string[] = [matchId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const m of template) {
      const refsCurrent = m.slotA === `<${current}>` || m.slotB === `<${current}>`
        || m.slotA === `<${current}_loser>` || m.slotB === `<${current}_loser>`
      if (refsCurrent && !result.has(m.id)) {
        result.add(m.id)
        queue.push(m.id)
      }
    }
  }
  return [...result]
}

/**
 * Set-based per-round scoring for a bracket prediction.
 *
 * Algorithm (US-1311 / PLAN-001 §4):
 *   1. Derive both brackets fully (using each side's group standings + winners).
 *   2. last_32 team set = union of slotA + slotB across last_32 matches → 2p per intersection team.
 *   3. last_16 team set = winners of last_32 matches (round winners) → 3p per intersection team.
 *   4. last_8  (qf)     = winners of last_16 matches → 4p per intersection team.
 *   5. last_4  (sf)     = winners of qf matches    → 6p per intersection team.
 *   6. final            = winners of sf matches    → 8p per intersection team.
 *   7. champion         = winner of the `final` match → 10p if exact match.
 *
 * Order does not matter — pure set membership. Bronze match awards no extra points.
 * The `pointsPerMatch` legacy parameter has been replaced by central constants
 * (`tournament-scoring.constants.ts`).
 */
export function scoreBracketProgression(
  predicted: BracketProgressionAnswer,
  correct: BracketProgressionAnswer,
  template: readonly BracketMatch[],
  predictedGroupStandings: AllGroupsStandingAnswer | null,
  correctGroupStandings: AllGroupsStandingAnswer | null,
): number {
  const userBracket = deriveBracket(template, predictedGroupStandings, predicted.winners)
  const correctBracket = deriveBracket(template, correctGroupStandings, correct.winners)

  let total = 0

  // last_32 participants (slotA + slotB across last_32 matches).
  total += scoreRoundParticipants(userBracket, correctBracket, 'last_32', TOURNAMENT_POINTS.perTeam.last_32)

  // Round-winners cascade: each round's "team set" is the previous round's match winners.
  total += scoreRoundWinners(userBracket, correctBracket, 'last_32', TOURNAMENT_POINTS.perTeam.last_16)
  total += scoreRoundWinners(userBracket, correctBracket, 'last_16', TOURNAMENT_POINTS.perTeam.qf)
  total += scoreRoundWinners(userBracket, correctBracket, 'qf', TOURNAMENT_POINTS.perTeam.sf)
  total += scoreRoundWinners(userBracket, correctBracket, 'sf', TOURNAMENT_POINTS.perTeam.final)

  // Champion: exact final-match-winner match.
  const userFinalWinner = userBracket.matches.find(m => m.round === 'final')?.winnerId ?? null
  const correctFinalWinner = correctBracket.matches.find(m => m.round === 'final')?.winnerId ?? null
  if (userFinalWinner !== null && userFinalWinner === correctFinalWinner) {
    total += TOURNAMENT_POINTS.perTeam.champion
  }

  return total
}

/** Set of teams participating in a given round (slotA ∪ slotB across that round's matches). */
function roundParticipantSet(bracket: DerivedBracket, round: BracketRound): Set<string> {
  const set = new Set<string>()
  for (const m of bracket.matches) {
    if (m.round !== round) continue
    if (m.teamA) set.add(m.teamA)
    if (m.teamB) set.add(m.teamB)
  }
  return set
}

/** Set of round winners (the teams advancing past a given round). */
function roundWinnerSet(bracket: DerivedBracket, round: BracketRound): Set<string> {
  const set = new Set<string>()
  for (const m of bracket.matches) {
    if (m.round !== round) continue
    if (m.winnerId) set.add(m.winnerId)
  }
  return set
}

function scoreRoundParticipants(
  user: DerivedBracket,
  correct: DerivedBracket,
  round: BracketRound,
  pointsPerTeam: number,
): number {
  const userSet = roundParticipantSet(user, round)
  const correctSet = roundParticipantSet(correct, round)
  return setIntersectSize(userSet, correctSet) * pointsPerTeam
}

function scoreRoundWinners(
  user: DerivedBracket,
  correct: DerivedBracket,
  round: BracketRound,
  pointsPerTeam: number,
): number {
  const userSet = roundWinnerSet(user, round)
  const correctSet = roundWinnerSet(correct, round)
  return setIntersectSize(userSet, correctSet) * pointsPerTeam
}

function setIntersectSize(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n
}
