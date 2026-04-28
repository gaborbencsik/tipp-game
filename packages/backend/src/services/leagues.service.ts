import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { leagues } from '../db/schema/index.js'
import type { League, LeagueInput } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export async function getLeagues(): Promise<League[]> {
  const rows = await db.select().from(leagues).orderBy(leagues.name)
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

function toLeague(row: typeof leagues.$inferSelect): League {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
