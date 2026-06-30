import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
  BracketProgressionCorrectAnswer,
  MultiTeamWeightedChoice,
  MultiTeamWeightedOptions,
} from '../types/index.js'
import { deriveBracket } from './bracket-progression.service.js'
import { isBracketProgressionCorrectAnswer } from './bracket-correct-answer.js'

export function scoreUpsetSpecial(
  picks: readonly string[],
  eliminated: readonly string[],
  choices: readonly MultiTeamWeightedChoice[],
): number {
  if (picks.length === 0) return 0
  const pointsByTeam = new Map<string, number>()
  for (const choice of choices) pointsByTeam.set(choice.teamId, choice.points)
  const eliminatedSet = new Set(eliminated)
  const pickedSet = new Set(picks)
  let total = 0
  for (const teamId of pickedSet) {
    if (!eliminatedSet.has(teamId)) continue
    const points = pointsByTeam.get(teamId)
    if (points !== undefined) total += points
  }
  return total
}

export function parseUpsetPicks(json: string): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  if (!parsed.every((entry): entry is string => typeof entry === 'string')) return null
  return parsed
}

export function parseUpsetEliminated(json: string | null): string[] {
  if (json === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter((entry): entry is string => typeof entry === 'string')
}

export function validateUpsetOptions(options: unknown): MultiTeamWeightedOptions | null {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) return null
  const candidate = options as Record<string, unknown>
  const { maxPicks, minPicks, choices } = candidate
  if (typeof maxPicks !== 'number' || typeof minPicks !== 'number') return null
  if (!Array.isArray(choices)) return null
  const validatedChoices: MultiTeamWeightedChoice[] = []
  for (const raw of choices) {
    if (typeof raw !== 'object' || raw === null) return null
    const choice = raw as Record<string, unknown>
    if (typeof choice.teamId !== 'string' || typeof choice.points !== 'number') return null
    validatedChoices.push({ teamId: choice.teamId, points: choice.points })
  }
  return { maxPicks, minPicks, choices: validatedChoices }
}

export function resolveUpsetMaxPoints(options: MultiTeamWeightedOptions): number {
  if (options.choices.length === 0) return 0
  const sorted = [...options.choices].sort((a, b) => b.points - a.points)
  const top = sorted.slice(0, options.maxPicks)
  return top.reduce((sum, choice) => sum + choice.points, 0)
}

/**
 * US-1311 follow-up: derive the eliminated-team set from the correct bracket answer.
 *
 * "Eliminated" = teams from `options.choices` (the favourite-pool the user could pick from)
 *   that did NOT make it to the last_32 round of the correct bracket. Equivalently:
 *
 *   eliminated = choices ∖ derivedBracket(template, correctGroupStandings).last_32_participants
 *
 * Returns null when the inputs are insufficient: missing template, missing group standings,
 * or the last_32 round can't be fully resolved (e.g. some 3rd-place slots couldn't be
 * mapped because best3rds aren't populated yet). The caller then either keeps the manual
 * `correctAnswer` or rejects the run.
 */
export function deriveEliminatedFromBracket(
  options: MultiTeamWeightedOptions,
  template: readonly BracketMatch[] | null,
  correctGroupStandings: AllGroupsStandingAnswer | null,
  correctBracket: BracketProgressionAnswer | BracketProgressionCorrectAnswer | null,
): string[] | null {
  if (!template || template.length === 0) return null

  // UX-044: when the admin has stored the new participants shape, take last_32 directly from it
  // — no need to re-derive from group standings + winners.
  if (correctBracket && isBracketProgressionCorrectAnswer(correctBracket)) {
    const last32Set = new Set(correctBracket.participants.last_32)
    if (last32Set.size !== 32) return null
    return options.choices
      .map(c => c.teamId)
      .filter(teamId => !last32Set.has(teamId))
  }

  if (!correctGroupStandings) return null
  const winners = correctBracket?.winners ?? {}
  const derived = deriveBracket(template, correctGroupStandings, winners)
  const last32Participants = new Set<string>()
  let last32MatchCount = 0
  let unresolvedSlotCount = 0
  for (const m of derived.matches) {
    if (m.round !== 'last_32') continue
    last32MatchCount += 1
    if (m.teamA) last32Participants.add(m.teamA); else unresolvedSlotCount += 1
    if (m.teamB) last32Participants.add(m.teamB); else unresolvedSlotCount += 1
  }
  if (last32MatchCount === 0) return null
  // Every slot must resolve — otherwise the "32-be jutottak" set is incomplete.
  if (unresolvedSlotCount > 0) return null
  return options.choices
    .map(c => c.teamId)
    .filter(teamId => !last32Participants.has(teamId))
}
