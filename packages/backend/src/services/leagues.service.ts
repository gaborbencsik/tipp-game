import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { leagues, auditLogs } from '../db/schema/index.js'
import type { League, LeagueInput } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

const SEASON_MIN = 2000
const SEASON_MAX = 2100

function parseDate(value: string, field: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new AppError(422, `${field} must be a valid date`)
  return date
}

/**
 * Validates the sync-related fields of a league input and normalizes date strings
 * to Date objects. Pure except for the uniqueness check, which is done by the caller.
 */
function validateSyncFields(input: Partial<LeagueInput>): { syncFrom?: Date | null; syncTo?: Date | null } {
  if (input.status !== undefined && input.status !== 'active' && input.status !== 'archived') {
    throw new AppError(422, "status must be 'active' or 'archived'")
  }

  if (
    input.season !== undefined &&
    input.season !== null &&
    (!Number.isInteger(input.season) || input.season < SEASON_MIN || input.season > SEASON_MAX)
  ) {
    throw new AppError(422, `season must be an integer between ${SEASON_MIN} and ${SEASON_MAX}`)
  }

  if (input.externalId !== undefined && input.externalId !== null && !Number.isInteger(input.externalId)) {
    throw new AppError(422, 'externalId must be an integer')
  }

  if (
    input.fixtureAllowlist != null &&
    !input.fixtureAllowlist.every((n) => Number.isInteger(n) && n > 0)
  ) {
    throw new AppError(422, 'fixtureAllowlist must contain only positive integers')
  }

  const syncFrom = input.syncFrom != null ? parseDate(input.syncFrom, 'syncFrom') : (input.syncFrom as null | undefined)
  const syncTo = input.syncTo != null ? parseDate(input.syncTo, 'syncTo') : (input.syncTo as null | undefined)
  if (syncFrom instanceof Date && syncTo instanceof Date && syncFrom > syncTo) {
    throw new AppError(422, 'syncFrom must be on or before syncTo')
  }

  return { syncFrom, syncTo }
}

async function assertExternalIdUnique(externalId: number, excludeId?: string): Promise<void> {
  const existing = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.externalId, externalId))
    .limit(1)
  const conflict = existing[0]
  if (conflict && conflict.id !== excludeId) {
    throw new AppError(409, `A league with externalId ${externalId} already exists`)
  }
}

export async function getLeagues(options?: { includeArchived?: boolean }): Promise<League[]> {
  const rows = options?.includeArchived
    ? await db.select().from(leagues).orderBy(leagues.name)
    : await db.select().from(leagues).where(eq(leagues.status, 'active')).orderBy(leagues.name)
  return rows.map(toLeague)
}

export async function createLeague(input: LeagueInput): Promise<League> {
  const { syncFrom, syncTo } = validateSyncFields(input)

  const syncEnabled = input.syncEnabled ?? false
  const externalId = input.externalId ?? null
  if (syncEnabled && externalId == null) {
    throw new AppError(422, 'syncEnabled requires a non-null externalId')
  }
  if (externalId != null) await assertExternalIdUnique(externalId)

  const rows = await db
    .insert(leagues)
    .values({
      name: input.name,
      shortName: input.shortName,
      status: input.status ?? 'active',
      startsAt: input.startsAt != null ? parseDate(input.startsAt, 'startsAt') : null,
      syncEnabled,
      externalId,
      season: input.season ?? null,
      syncFrom: syncFrom ?? null,
      syncTo: syncTo ?? null,
      fixtureAllowlist: input.fixtureAllowlist != null ? [...input.fixtureAllowlist] : null,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to create league')
  return toLeague(row)
}

export async function updateLeague(id: string, input: Partial<LeagueInput>): Promise<League> {
  const { syncFrom, syncTo } = validateSyncFields(input)

  if (input.externalId != null) await assertExternalIdUnique(input.externalId, id)

  const rows = await db
    .update(leagues)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.shortName !== undefined && { shortName: input.shortName }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.startsAt !== undefined && {
        startsAt: input.startsAt != null ? parseDate(input.startsAt, 'startsAt') : null,
      }),
      ...(input.syncEnabled !== undefined && { syncEnabled: input.syncEnabled }),
      ...(input.externalId !== undefined && { externalId: input.externalId }),
      ...(input.season !== undefined && { season: input.season }),
      ...(input.syncFrom !== undefined && { syncFrom: syncFrom ?? null }),
      ...(input.syncTo !== undefined && { syncTo: syncTo ?? null }),
      ...(input.fixtureAllowlist !== undefined && {
        fixtureAllowlist: input.fixtureAllowlist != null ? [...input.fixtureAllowlist] : null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(leagues.id, id))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(404, 'League not found')
  return toLeague(row)
}

export async function deleteLeague(id: string): Promise<void> {
  const rows = await db.delete(leagues).where(eq(leagues.id, id)).returning()
  if (rows.length === 0) throw new AppError(404, 'League not found')
}

export async function archiveLeague(id: string, actorId: string): Promise<League> {
  const existing = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1)
  const current = existing[0]
  if (!current) throw new AppError(404, 'League not found')

  if (current.status === 'archived') return toLeague(current)

  const rows = await db
    .update(leagues)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(leagues.id, id))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to archive league')

  await db.insert(auditLogs).values({
    actorId,
    action: 'league_archive',
    entityType: 'league',
    entityId: id,
    previousValue: { status: 'active' },
    newValue: { status: 'archived' },
  })

  return toLeague(row)
}

export async function restoreLeague(id: string, actorId: string): Promise<League> {
  const existing = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1)
  const current = existing[0]
  if (!current) throw new AppError(404, 'League not found')

  if (current.status === 'active') return toLeague(current)

  const rows = await db
    .update(leagues)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(leagues.id, id))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to restore league')

  await db.insert(auditLogs).values({
    actorId,
    action: 'league_restore',
    entityType: 'league',
    entityId: id,
    previousValue: { status: 'archived' },
    newValue: { status: 'active' },
  })

  return toLeague(row)
}

function toLeague(row: typeof leagues.$inferSelect): League {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    status: row.status,
    archivedAt: row.status === 'archived' ? row.updatedAt.toISOString() : null,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    syncEnabled: row.syncEnabled,
    externalId: row.externalId,
    season: row.season,
    syncFrom: row.syncFrom ? row.syncFrom.toISOString() : null,
    syncTo: row.syncTo ? row.syncTo.toISOString() : null,
    fixtureAllowlist: row.fixtureAllowlist,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
