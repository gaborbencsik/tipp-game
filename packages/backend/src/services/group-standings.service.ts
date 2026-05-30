import type {
  AllGroupsStandingAnswer,
  AllGroupsStandingCompletion,
  AllGroupsStandingOptions,
} from '../types/index.js'

export interface GroupTeamMembership {
  readonly groups: ReadonlyMap<string, ReadonlySet<string>>
}

export interface ValidatedAnswer {
  readonly answer: AllGroupsStandingAnswer
  readonly completion: AllGroupsStandingCompletion
}

export function parseAllGroupsStandingAnswer(json: string): AllGroupsStandingAnswer | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  return shapeAnswer(parsed)
}

export function validateAllGroupsStandingOptions(options: unknown): AllGroupsStandingOptions | null {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) return null
  const candidate = options as Record<string, unknown>
  const { groups, teamsPerGroup, best3rdPicks } = candidate
  if (!Array.isArray(groups)) return null
  if (!groups.every((entry): entry is string => typeof entry === 'string')) return null
  if (typeof teamsPerGroup !== 'number' || typeof best3rdPicks !== 'number') return null
  if (groups.length === 0 || teamsPerGroup <= 0 || best3rdPicks < 0) return null
  return { groups, teamsPerGroup, best3rdPicks }
}

export function validateAllGroupsStandingAnswer(
  answer: AllGroupsStandingAnswer,
  options: AllGroupsStandingOptions,
  membership: GroupTeamMembership,
): ValidatedAnswer | { readonly error: string } {
  const allowedGroups = new Set(options.groups)
  const sanitizedGroups: Record<string, (string | null)[]> = {}

  for (const code of options.groups) {
    sanitizedGroups[code] = Array.from({ length: options.teamsPerGroup }, () => null)
  }

  for (const [code, positions] of Object.entries(answer.groups)) {
    if (!allowedGroups.has(code)) return { error: `unknown_group:${code}` }
    if (!Array.isArray(positions)) return { error: `invalid_group:${code}` }
    if (positions.length !== options.teamsPerGroup) return { error: `wrong_length:${code}` }

    const teamSet = membership.groups.get(code)
    if (!teamSet) return { error: `unknown_group:${code}` }

    const seen = new Set<string>()
    const normalized: (string | null)[] = []
    for (let i = 0; i < positions.length; i++) {
      const slot = positions[i]
      if (slot === null || slot === undefined) {
        normalized.push(null)
        continue
      }
      if (typeof slot !== 'string') return { error: `invalid_team:${code}` }
      if (!teamSet.has(slot)) return { error: `team_not_in_group:${code}:${slot}` }
      if (seen.has(slot)) return { error: `duplicate_team:${code}:${slot}` }
      seen.add(slot)
      normalized.push(slot)
    }
    sanitizedGroups[code] = normalized
  }

  const thirdPlaceTeams = new Set<string>()
  for (const code of options.groups) {
    const team = sanitizedGroups[code][2]
    if (team) thirdPlaceTeams.add(team)
  }

  if (answer.best3rds.length > options.best3rdPicks) {
    return { error: `too_many_best3rds` }
  }
  const best3rdSet = new Set<string>()
  const sanitizedBest3rds: string[] = []
  for (const teamId of answer.best3rds) {
    if (typeof teamId !== 'string') return { error: 'invalid_best3rd' }
    if (best3rdSet.has(teamId)) return { error: `duplicate_best3rd:${teamId}` }
    if (!thirdPlaceTeams.has(teamId)) return { error: `best3rd_not_third_place:${teamId}` }
    best3rdSet.add(teamId)
    sanitizedBest3rds.push(teamId)
  }

  return {
    answer: {
      groups: sanitizedGroups,
      best3rds: sanitizedBest3rds,
    },
    completion: computeCompletion(sanitizedGroups, sanitizedBest3rds, options),
  }
}

export function computeCompletion(
  groups: Record<string, readonly (string | null)[]>,
  best3rds: readonly string[],
  options: AllGroupsStandingOptions,
): AllGroupsStandingCompletion {
  let groupsDone = 0
  for (const code of options.groups) {
    const positions = groups[code] ?? []
    if (positions.length === options.teamsPerGroup && positions.every((entry) => entry !== null)) {
      groupsDone += 1
    }
  }
  const best3rdsDone = best3rds.length
  return {
    groupsDone,
    best3rdsDone,
    totalDone: groupsDone + best3rdsDone,
    totalSteps: options.groups.length + options.best3rdPicks,
  }
}

function shapeAnswer(value: unknown): AllGroupsStandingAnswer | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const groupsRaw = candidate.groups
  const best3rdsRaw = candidate.best3rds
  if (typeof groupsRaw !== 'object' || groupsRaw === null || Array.isArray(groupsRaw)) return null
  if (!Array.isArray(best3rdsRaw)) return null

  const groups: Record<string, (string | null)[]> = {}
  for (const [code, positions] of Object.entries(groupsRaw as Record<string, unknown>)) {
    if (!Array.isArray(positions)) return null
    const normalized: (string | null)[] = []
    for (const slot of positions) {
      if (slot === null) {
        normalized.push(null)
      } else if (typeof slot === 'string') {
        normalized.push(slot)
      } else {
        return null
      }
    }
    groups[code] = normalized
  }

  const best3rds: string[] = []
  for (const teamId of best3rdsRaw) {
    if (typeof teamId !== 'string') return null
    best3rds.push(teamId)
  }

  return { groups, best3rds }
}
