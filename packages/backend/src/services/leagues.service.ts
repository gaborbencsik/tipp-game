import { eq, isNull } from 'drizzle-orm'
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

export async function getLeagues(options?: { includeArchived?: boolean }): Promise<League[]> {
  const rows = options?.includeArchived
    ? await db.select().from(leagues).orderBy(leagues.name)
    : await db.select().from(leagues).where(isNull(leagues.archivedAt)).orderBy(leagues.name)
  return rows.map(toLeague)
}

export async function createLeague(input: LeagueInput): Promise<League> {
  const rows = await db
    .insert(leagues)
    .values({ name: input.name, shortName: input.shortName })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to create league')
  return toLeague(row)
}

export async function updateLeague(id: string, input: Partial<LeagueInput>): Promise<League> {
  const rows = await db
    .update(leagues)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.shortName !== undefined && { shortName: input.shortName }),
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

  if (current.archivedAt) return toLeague(current)

  const archivedAt = new Date()
  const rows = await db
    .update(leagues)
    .set({ archivedAt, updatedAt: new Date() })
    .where(eq(leagues.id, id))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to archive league')

  await db.insert(auditLogs).values({
    actorId,
    action: 'league_archive',
    entityType: 'league',
    entityId: id,
    previousValue: { archivedAt: null },
    newValue: { archivedAt: archivedAt.toISOString() },
  })

  return toLeague(row)
}

export async function restoreLeague(id: string, actorId: string): Promise<League> {
  const existing = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1)
  const current = existing[0]
  if (!current) throw new AppError(404, 'League not found')

  if (!current.archivedAt) return toLeague(current)

  const rows = await db
    .update(leagues)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(leagues.id, id))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to restore league')

  await db.insert(auditLogs).values({
    actorId,
    action: 'league_restore',
    entityType: 'league',
    entityId: id,
    previousValue: { archivedAt: current.archivedAt.toISOString() },
    newValue: { archivedAt: null },
  })

  return toLeague(row)
}

function toLeague(row: typeof leagues.$inferSelect): League {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
