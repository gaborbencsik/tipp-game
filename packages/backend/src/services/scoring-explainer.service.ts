import { eq, isNull, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  scoringConfigs,
  groups,
  groupMembers,
  leagues,
  groupLeagues,
  specialPredictionTypes,
  groupGlobalTypeSubscriptions,
} from '../db/schema/index.js'
import type {
  ScoringConfigFull,
  ScoringExplainerResponse,
  ScoringExplainerGroup,
  ScoringExplainerSpecialType,
} from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

function toApiConfig(
  row: typeof scoringConfigs.$inferSelect,
  effectiveFrozen: Date | null,
): ScoringConfigFull {
  return {
    id: row.id,
    name: row.name,
    correctOutcomePoints: row.correctOutcomePoints,
    exactBonusPoints: row.exactBonusPoints,
    extraTimeBonusPoints: row.extraTimeBonusPoints,
    frozenAt: effectiveFrozen ? effectiveFrozen.toISOString() : null,
  }
}

function effectiveFrozenAt(
  configRelevantLeagues: ReadonlyArray<{ startsAt: Date | null }>,
  now: Date = new Date(),
): Date | null {
  const past = configRelevantLeagues
    .map(l => l.startsAt)
    .filter((d): d is Date => d != null && d <= now)
  if (past.length === 0) return null
  return past.reduce((min, d) => (d < min ? d : min))
}

export function isConfigEffectivelyFrozen(
  configRelevantLeagues: ReadonlyArray<{ startsAt: Date | null }>,
  now: Date = new Date(),
): boolean {
  return effectiveFrozenAt(configRelevantLeagues, now) !== null
}

async function loadDefaultConfig(): Promise<typeof scoringConfigs.$inferSelect> {
  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.isGlobalDefault, true))
    .limit(1)
  if (!rows[0]) throw new AppError(404, 'Global scoring config not found')
  return rows[0]
}

async function loadUserGroups(userId: string): Promise<Array<{
  id: string
  name: string
  scoringConfigId: string | null
  favoriteTeamDoublePoints: boolean
}>> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      scoringConfigId: groups.scoringConfigId,
      favoriteTeamDoublePoints: groups.favoriteTeamDoublePoints,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), isNull(groups.deletedAt)))
  return rows
}

async function loadConfigsByIds(ids: ReadonlyArray<string>): Promise<Map<string, typeof scoringConfigs.$inferSelect>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(inArray(scoringConfigs.id, ids as string[]))
  return new Map(rows.map(r => [r.id, r]))
}

async function loadAllLeagues(): Promise<Array<{ id: string; startsAt: Date | null }>> {
  return db.select({ id: leagues.id, startsAt: leagues.startsAt }).from(leagues)
}

async function loadGroupLeaguesForGroups(
  groupIds: ReadonlyArray<string>,
): Promise<Map<string, Array<string>>> {
  const result = new Map<string, Array<string>>()
  if (groupIds.length === 0) return result
  const rows = await db
    .select({ groupId: groupLeagues.groupId, leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(inArray(groupLeagues.groupId, groupIds as string[]))
  for (const r of rows) {
    const list = result.get(r.groupId) ?? []
    list.push(r.leagueId)
    result.set(r.groupId, list)
  }
  return result
}

async function loadGroupOwnedSpecialTypes(groupIds: ReadonlyArray<string>): Promise<Map<string, Array<typeof specialPredictionTypes.$inferSelect>>> {
  const grouped = new Map<string, Array<typeof specialPredictionTypes.$inferSelect>>()
  if (groupIds.length === 0) return grouped
  const rows = await db
    .select()
    .from(specialPredictionTypes)
    .where(inArray(specialPredictionTypes.groupId, groupIds as string[]))
  for (const row of rows) {
    if (!row.groupId) continue
    const list = grouped.get(row.groupId) ?? []
    list.push(row)
    grouped.set(row.groupId, list)
  }
  return grouped
}

async function loadSubscribedGlobalSpecialTypes(groupIds: ReadonlyArray<string>): Promise<Map<string, Array<typeof specialPredictionTypes.$inferSelect>>> {
  const grouped = new Map<string, Array<typeof specialPredictionTypes.$inferSelect>>()
  if (groupIds.length === 0) return grouped
  const rows = await db
    .select({
      groupId: groupGlobalTypeSubscriptions.groupId,
      type: specialPredictionTypes,
    })
    .from(groupGlobalTypeSubscriptions)
    .innerJoin(
      specialPredictionTypes,
      eq(specialPredictionTypes.id, groupGlobalTypeSubscriptions.globalTypeId),
    )
    .where(inArray(groupGlobalTypeSubscriptions.groupId, groupIds as string[]))
  for (const row of rows) {
    const list = grouped.get(row.groupId) ?? []
    list.push(row.type)
    grouped.set(row.groupId, list)
  }
  return grouped
}

function mapSpecialType(
  row: typeof specialPredictionTypes.$inferSelect,
  source: 'group-owned' | 'subscribed-global',
): ScoringExplainerSpecialType {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    points: row.points,
    source,
  }
}

export async function getScoringExplainer(userId: string): Promise<ScoringExplainerResponse> {
  const defaultRow = await loadDefaultConfig()
  const userGroups = await loadUserGroups(userId)

  const groupIds = userGroups.map(g => g.id)
  const configIdsToLoad = userGroups
    .map(g => g.scoringConfigId)
    .filter((id): id is string => id !== null)

  const [configs, owned, subscribed, allLeagues, groupLeaguesMap] = await Promise.all([
    loadConfigsByIds(configIdsToLoad),
    loadGroupOwnedSpecialTypes(groupIds),
    loadSubscribedGlobalSpecialTypes(groupIds),
    loadAllLeagues(),
    loadGroupLeaguesForGroups(groupIds),
  ])

  const defaultEffective = effectiveFrozenAt(allLeagues)

  const groupsOut: Array<ScoringExplainerGroup> = userGroups.map(g => {
    const configRow = g.scoringConfigId ? configs.get(g.scoringConfigId) ?? defaultRow : defaultRow
    const explicitLeagueIds = groupLeaguesMap.get(g.id) ?? []
    const relevantLeagues = explicitLeagueIds.length === 0
      ? allLeagues
      : allLeagues.filter(l => explicitLeagueIds.includes(l.id))
    const groupEffective = effectiveFrozenAt(relevantLeagues)

    const specialTypes: Array<ScoringExplainerSpecialType> = [
      ...(owned.get(g.id) ?? []).map(t => mapSpecialType(t, 'group-owned')),
      ...(subscribed.get(g.id) ?? []).map(t => mapSpecialType(t, 'subscribed-global')),
    ]
    return {
      id: g.id,
      name: g.name,
      config: toApiConfig(configRow, groupEffective),
      configFrozenAt: groupEffective ? groupEffective.toISOString() : null,
      favoriteTeamDoublePoints: g.favoriteTeamDoublePoints,
      specialTypes,
    }
  })

  return {
    default: toApiConfig(defaultRow, defaultEffective),
    defaultFrozenAt: defaultEffective ? defaultEffective.toISOString() : null,
    groups: groupsOut,
  }
}
