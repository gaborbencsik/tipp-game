import { eq, isNull, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  scoringConfigs,
  groups,
  groupMembers,
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

function toApiConfig(row: typeof scoringConfigs.$inferSelect): ScoringConfigFull {
  return {
    id: row.id,
    name: row.name,
    exactScore: row.exactScore,
    correctWinnerAndDiff: row.correctWinnerAndDiff,
    correctWinner: row.correctWinner,
    correctDraw: row.correctDraw,
    correctOutcome: row.correctOutcome,
    incorrect: row.incorrect,
    frozenAt: row.frozenAt ? row.frozenAt.toISOString() : null,
  }
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

  const [configs, owned, subscribed] = await Promise.all([
    loadConfigsByIds(configIdsToLoad),
    loadGroupOwnedSpecialTypes(groupIds),
    loadSubscribedGlobalSpecialTypes(groupIds),
  ])

  const groupsOut: Array<ScoringExplainerGroup> = userGroups.map(g => {
    const configRow = g.scoringConfigId ? configs.get(g.scoringConfigId) ?? defaultRow : defaultRow
    const specialTypes: Array<ScoringExplainerSpecialType> = [
      ...(owned.get(g.id) ?? []).map(t => mapSpecialType(t, 'group-owned')),
      ...(subscribed.get(g.id) ?? []).map(t => mapSpecialType(t, 'subscribed-global')),
    ]
    return {
      id: g.id,
      name: g.name,
      config: toApiConfig(configRow),
      configFrozenAt: configRow.frozenAt ? configRow.frozenAt.toISOString() : null,
      favoriteTeamDoublePoints: g.favoriteTeamDoublePoints,
      specialTypes,
    }
  })

  return {
    default: toApiConfig(defaultRow),
    defaultFrozenAt: defaultRow.frozenAt ? defaultRow.frozenAt.toISOString() : null,
    groups: groupsOut,
  }
}
