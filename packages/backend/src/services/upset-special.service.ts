import type { MultiTeamWeightedChoice, MultiTeamWeightedOptions } from '../types/index.js'

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
