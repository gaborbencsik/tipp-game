import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { players, teams, matches } from '../db/schema/index.js'
import type { Player, PlayerInput } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

interface PlayerRow {
  players: typeof players.$inferSelect
  teams: typeof teams.$inferSelect | null
}

function toApiPlayer(row: PlayerRow): Player {
  return {
    id: row.players.id,
    name: row.players.name,
    teamId: row.players.teamId ?? null,
    teamName: row.teams?.name ?? null,
    teamShortCode: row.teams?.shortCode ?? null,
    position: row.players.position ?? null,
    shirtNumber: row.players.shirtNumber ?? null,
    createdAt: row.players.createdAt.toISOString(),
    updatedAt: row.players.updatedAt.toISOString(),
  }
}

export interface GetPlayersOptions {
  readonly teamId?: string
  readonly leagueId?: string
}

async function teamIdsForLeague(leagueId: string): Promise<string[]> {
  const rows = await db
    .selectDistinctOn([teams.id], { id: teams.id })
    .from(matches)
    .innerJoin(teams, sql`${teams.id} = ${matches.homeTeamId} OR ${teams.id} = ${matches.awayTeamId}`)
    .where(eq(matches.leagueId, leagueId))
  return rows.map(r => r.id)
}

export async function getPlayers(opts: GetPlayersOptions = {}): Promise<Player[]> {
  const { teamId, leagueId } = opts

  if (leagueId) {
    const teamIds = await teamIdsForLeague(leagueId)
    if (teamIds.length === 0) return []
    const filter = teamId
      ? and(inArray(players.teamId, teamIds), eq(players.teamId, teamId))
      : inArray(players.teamId, teamIds)
    const rows = await db
      .select()
      .from(players)
      .leftJoin(teams, eq(players.teamId, teams.id))
      .where(filter)
      .orderBy(players.name)
    return rows.map(toApiPlayer)
  }

  const baseQuery = db
    .select()
    .from(players)
    .leftJoin(teams, eq(players.teamId, teams.id))
    .orderBy(players.name)

  const rows = teamId
    ? await baseQuery.where(eq(players.teamId, teamId))
    : await baseQuery
  return rows.map(toApiPlayer)
}

export async function countPlayersForLeague(leagueId: string): Promise<number> {
  const teamIds = await teamIdsForLeague(leagueId)
  if (teamIds.length === 0) return 0
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(players)
    .where(inArray(players.teamId, teamIds))
  return rows[0]?.count ?? 0
}

export async function getPlayerById(id: string): Promise<Player> {
  const rows = await db
    .select()
    .from(players)
    .leftJoin(teams, eq(players.teamId, teams.id))
    .where(eq(players.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) throw new AppError(404, 'Player not found')
  return toApiPlayer(row)
}

export async function createPlayer(input: PlayerInput): Promise<Player> {
  const rows = await db
    .insert(players)
    .values({
      name: input.name,
      teamId: input.teamId ?? null,
      position: input.position ?? null,
      shirtNumber: input.shirtNumber ?? null,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to create player')
  return getPlayerById(row.id)
}

export async function updatePlayer(id: string, input: Partial<PlayerInput>): Promise<Player> {
  const rows = await db
    .update(players)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.teamId !== undefined && { teamId: input.teamId ?? null }),
      ...(input.position !== undefined && { position: input.position ?? null }),
      ...(input.shirtNumber !== undefined && { shirtNumber: input.shirtNumber ?? null }),
      updatedAt: new Date(),
    })
    .where(eq(players.id, id))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(404, 'Player not found')
  return getPlayerById(row.id)
}

export async function deletePlayer(id: string): Promise<void> {
  try {
    await db
      .delete(players)
      .where(eq(players.id, id))
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === '23503') throw new AppError(409, 'Player has associated records')
    throw err
  }
}
