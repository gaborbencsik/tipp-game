import type { MultiTeamSelectOptions } from '../types/index.js'

export function parseMultiTeamSelectPicks(json: string): string[] | null {
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

export function validateMultiTeamSelectOptions(options: unknown): MultiTeamSelectOptions | null {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) return null
  const candidate = options as Record<string, unknown>
  const { maxPicks, minPicks, teamIds } = candidate
  if (typeof maxPicks !== 'number' || typeof minPicks !== 'number') return null
  if (!Array.isArray(teamIds)) return null
  if (!teamIds.every((id): id is string => typeof id === 'string')) return null
  return { maxPicks, minPicks, teamIds }
}
