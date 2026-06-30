import type { BracketProgressionCorrectAnswer, BracketRound } from '../types/index.js'

/**
 * UX-044: admin-side correct-answer for `bracket_progression`. The new shape stores
 * **participants per round** (the teams that *reached* a given round), not just the
 * match-level winners — this is what the admin actually evaluates against the user's
 * tip ("which 32 teams reached Last 32?", "which 16 reached Last 16?", …).
 *
 * Backward compatibility: the legacy `{ winners: { matchId: teamId } }` shape is still
 * understood by the scorer (see `scoreBracketProgression`); this module deals only with
 * the new shape.
 */

const ROUND_SIZES: Readonly<Record<Exclude<BracketRound, 'bronze'>, number>> = {
  last_32: 32,
  last_16: 16,
  qf: 8,
  sf: 4,
  final: 2,
}

const SUBSET_CHAIN: readonly [Exclude<BracketRound, 'bronze' | 'last_32'>, Exclude<BracketRound, 'bronze'>][] = [
  ['last_16', 'last_32'],
  ['qf', 'last_16'],
  ['sf', 'qf'],
  ['final', 'sf'],
]

export type ValidateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

export function validateBracketProgressionCorrectAnswer(
  answer: BracketProgressionCorrectAnswer,
): ValidateResult {
  // 1. Size check + duplicates per round.
  for (const round of Object.keys(ROUND_SIZES) as readonly Exclude<BracketRound, 'bronze'>[]) {
    const list = answer.participants[round]
    if (list.length !== ROUND_SIZES[round]) {
      return { ok: false, error: `bracket_round_size_mismatch:${round}` }
    }
    const seen = new Set<string>()
    for (const id of list) {
      if (seen.has(id)) return { ok: false, error: `bracket_duplicate_team:${round}` }
      seen.add(id)
    }
  }

  // 2. Subset chain: each round ⊆ previous.
  for (const [child, parent] of SUBSET_CHAIN) {
    const parentSet = new Set(answer.participants[parent])
    for (const id of answer.participants[child]) {
      if (!parentSet.has(id)) {
        return { ok: false, error: `bracket_subset_violation:${child}` }
      }
    }
  }

  // 3. champion ∈ final (or null).
  if (answer.champion !== null) {
    const finalSet = new Set(answer.participants.final)
    if (!finalSet.has(answer.champion)) {
      return { ok: false, error: 'bracket_champion_not_in_final' }
    }
  }

  // 4. bronzeWinner ∈ (sf \ final) or null.
  if (answer.bronzeWinner !== null) {
    const sfSet = new Set(answer.participants.sf)
    const finalSet = new Set(answer.participants.final)
    if (!sfSet.has(answer.bronzeWinner) || finalSet.has(answer.bronzeWinner)) {
      return { ok: false, error: 'bracket_bronze_invalid' }
    }
  }

  return { ok: true }
}

/** Structural type guard: distinguishes the new participants-shape from legacy winners-map. */
export function isBracketProgressionCorrectAnswer(
  value: unknown,
): value is BracketProgressionCorrectAnswer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  const p = obj.participants
  if (typeof p !== 'object' || p === null || Array.isArray(p)) return false
  const pObj = p as Record<string, unknown>
  for (const round of Object.keys(ROUND_SIZES)) {
    const list = pObj[round]
    if (!Array.isArray(list)) return false
    for (const item of list) {
      if (typeof item !== 'string') return false
    }
  }
  if (obj.champion !== null && typeof obj.champion !== 'string') return false
  if (obj.bronzeWinner !== null && typeof obj.bronzeWinner !== 'string') return false
  return true
}

export function parseBracketProgressionCorrectAnswer(
  json: string,
): BracketProgressionCorrectAnswer | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!isBracketProgressionCorrectAnswer(parsed)) return null
  return parsed
}
