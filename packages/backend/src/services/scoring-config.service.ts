import { eq, sql, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  scoringConfigs,
  groups,
  groupLeagues,
  leagues,
  matchResults,
  predictions,
  groupMembers,
} from '../db/schema/index.js'
import type {
  ScoringConfigFull,
  ScoringConfigInput,
  ScoringConfigWithImpact,
} from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

function effectiveFrozenAtFromLeagues(
  rows: ReadonlyArray<{ startsAt: Date | null }>,
  now: Date = new Date(),
): Date | null {
  const past = rows
    .map(r => r.startsAt)
    .filter((d): d is Date => d != null && d <= now)
  if (past.length === 0) return null
  return past.reduce((min, d) => (d < min ? d : min))
}

async function loadAllLeagues(): Promise<Array<{ id: string; startsAt: Date | null }>> {
  return db.select({ id: leagues.id, startsAt: leagues.startsAt }).from(leagues)
}

async function loadGroupLeagueIds(groupId: string): Promise<string[]> {
  const rows = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))
  return rows.map(r => r.leagueId)
}

async function effectiveFrozenAtForRequest(groupId: string | null): Promise<Date | null> {
  const allLeagues = await loadAllLeagues()
  if (!groupId) return effectiveFrozenAtFromLeagues(allLeagues)
  const ids = await loadGroupLeagueIds(groupId)
  if (ids.length === 0) return effectiveFrozenAtFromLeagues(allLeagues)
  const idSet = new Set(ids)
  return effectiveFrozenAtFromLeagues(allLeagues.filter(l => idSet.has(l.id)))
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

async function loadGlobalConfigRow(): Promise<typeof scoringConfigs.$inferSelect> {
  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.isGlobalDefault, true))
    .limit(1)
  if (!rows[0]) throw new AppError(404, 'Global scoring config not found')
  return rows[0]
}

async function loadGroupConfigRow(groupId: string): Promise<typeof scoringConfigs.$inferSelect | null> {
  const groupRows = await db
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')
  if (!groupRows[0].scoringConfigId) return null

  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.id, groupRows[0].scoringConfigId))
    .limit(1)
  return rows[0] ?? null
}

async function assertNotFrozen(groupId: string | null): Promise<void> {
  const effective = await effectiveFrozenAtForRequest(groupId)
  if (effective !== null) {
    throw new AppError(423, 'Scoring config is frozen')
  }
}

async function countGlobalImpact(): Promise<{ matches: number; predictions: number }> {
  const matchRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchResults)
  const predRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictions)
  return {
    matches: Number(matchRow[0]?.count ?? 0),
    predictions: Number(predRow[0]?.count ?? 0),
  }
}

async function countGroupImpact(groupId: string): Promise<{ matches: number; predictions: number }> {
  const matchRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchResults)
  const predRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictions)
    .innerJoin(groupMembers, eq(groupMembers.userId, predictions.userId))
    .where(eq(groupMembers.groupId, groupId))
  return {
    matches: Number(matchRow[0]?.count ?? 0),
    predictions: Number(predRow[0]?.count ?? 0),
  }
}

export async function getGlobalConfig(): Promise<ScoringConfigFull> {
  const row = await loadGlobalConfigRow()
  const effective = await effectiveFrozenAtForRequest(null)
  return toApiConfig(row, effective)
}

export async function getGlobalConfigWithImpact(): Promise<ScoringConfigWithImpact> {
  const row = await loadGlobalConfigRow()
  const effective = await effectiveFrozenAtForRequest(null)
  const impact = await countGlobalImpact()
  return {
    ...toApiConfig(row, effective),
    affectedMatches: impact.matches,
    affectedPredictions: impact.predictions,
  }
}

export async function updateGlobalConfig(input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const current = await loadGlobalConfigRow()
  await assertNotFrozen(null)
  const updated = await db
    .update(scoringConfigs)
    .set({
      correctOutcomePoints: input.correctOutcomePoints,
      exactBonusPoints: input.exactBonusPoints,
      extraTimeBonusPoints: input.extraTimeBonusPoints,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, current.id))
    .returning()
  return toApiConfig(updated[0]!, null)
}

export async function overrideGlobalConfig(input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const current = await loadGlobalConfigRow()
  const updated = await db
    .update(scoringConfigs)
    .set({
      correctOutcomePoints: input.correctOutcomePoints,
      exactBonusPoints: input.exactBonusPoints,
      extraTimeBonusPoints: input.extraTimeBonusPoints,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, current.id))
    .returning()
  return toApiConfig(updated[0]!, null)
}

export async function getGroupConfig(groupId: string): Promise<ScoringConfigFull | null> {
  const row = await loadGroupConfigRow(groupId)
  if (!row) return null
  const effective = await effectiveFrozenAtForRequest(groupId)
  return toApiConfig(row, effective)
}

export async function getGroupConfigWithImpact(groupId: string): Promise<ScoringConfigWithImpact | null> {
  const row = await loadGroupConfigRow(groupId)
  if (!row) return null
  const effective = await effectiveFrozenAtForRequest(groupId)
  const impact = await countGroupImpact(groupId)
  return {
    ...toApiConfig(row, effective),
    affectedMatches: impact.matches,
    affectedPredictions: impact.predictions,
  }
}

export async function setGroupConfig(groupId: string, input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const groupRows = await db
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  await assertNotFrozen(groupId)

  const existingConfigId = groupRows[0].scoringConfigId

  if (!existingConfigId) {
    const inserted = await db
      .insert(scoringConfigs)
      .values({
        name: 'Group Override',
        isGlobalDefault: false,
        correctOutcomePoints: input.correctOutcomePoints,
        exactBonusPoints: input.exactBonusPoints,
        extraTimeBonusPoints: input.extraTimeBonusPoints,
      })
      .returning()

    const newConfig = inserted[0]!
    await db
      .update(groups)
      .set({ scoringConfigId: newConfig.id, updatedAt: new Date() })
      .where(eq(groups.id, groupId))

    return toApiConfig(newConfig, null)
  }

  const updated = await db
    .update(scoringConfigs)
    .set({
      correctOutcomePoints: input.correctOutcomePoints,
      exactBonusPoints: input.exactBonusPoints,
      extraTimeBonusPoints: input.extraTimeBonusPoints,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, existingConfigId))
    .returning()

  return toApiConfig(updated[0]!, null)
}

export async function overrideGroupConfig(groupId: string, input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const groupRows = await db
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const existingConfigId = groupRows[0].scoringConfigId

  if (!existingConfigId) {
    const inserted = await db
      .insert(scoringConfigs)
      .values({
        name: 'Group Override',
        isGlobalDefault: false,
        correctOutcomePoints: input.correctOutcomePoints,
        exactBonusPoints: input.exactBonusPoints,
        extraTimeBonusPoints: input.extraTimeBonusPoints,
      })
      .returning()

    const newConfig = inserted[0]!
    await db
      .update(groups)
      .set({ scoringConfigId: newConfig.id, updatedAt: new Date() })
      .where(eq(groups.id, groupId))

    return toApiConfig(newConfig, null)
  }

  const updated = await db
    .update(scoringConfigs)
    .set({
      correctOutcomePoints: input.correctOutcomePoints,
      exactBonusPoints: input.exactBonusPoints,
      extraTimeBonusPoints: input.extraTimeBonusPoints,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, existingConfigId))
    .returning()

  return toApiConfig(updated[0]!, null)
}
