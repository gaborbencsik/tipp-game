import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { teams } from '../db/schema/index.js'
import type { Team, TeamInput } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

function toApiTeam(row: typeof teams.$inferSelect): Team {
  return {
    id: row.id,
    name: row.name,
    shortCode: row.shortCode,
    flagUrl: row.flagUrl ?? null,
    group: row.group ?? null,
    teamType: row.teamType,
    countryCode: row.countryCode ?? null,
  }
}

export async function getTeams(): Promise<Team[]> {
  const rows = await db
    .select()
    .from(teams)
    .orderBy(teams.name)

  return rows.map(toApiTeam)
}

export async function getTeamById(id: string): Promise<Team> {
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) throw new AppError(404, 'Team not found')
  return toApiTeam(row)
}

export async function createTeam(input: TeamInput): Promise<Team> {
  const rows = await db
    .insert(teams)
    .values({
      name: input.name,
      shortCode: input.shortCode,
      flagUrl: input.flagUrl ?? null,
      group: input.group ?? null,
      teamType: input.teamType ?? 'national',
      countryCode: input.countryCode ?? null,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to create team')
  return toApiTeam(row)
}

export async function updateTeam(id: string, input: Partial<TeamInput>): Promise<Team> {
  const rows = await db
    .update(teams)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.shortCode !== undefined && { shortCode: input.shortCode }),
      ...(input.flagUrl !== undefined && { flagUrl: input.flagUrl }),
      ...(input.group !== undefined && { group: input.group }),
      ...(input.teamType !== undefined && { teamType: input.teamType }),
      ...(input.countryCode !== undefined && { countryCode: input.countryCode }),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, id))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(404, 'Team not found')
  return toApiTeam(row)
}

export async function deleteTeam(id: string): Promise<void> {
  try {
    await db
      .delete(teams)
      .where(eq(teams.id, id))
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === '23503') throw new AppError(409, 'Team has associated matches')
    throw err
  }
}
