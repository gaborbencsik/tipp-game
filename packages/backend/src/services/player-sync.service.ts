import { eq, sql, and, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { teams, players, playerStats } from '../db/schema/index.js'
import type { FootballApiClient } from './football-api.service.js'
import { FootballApiRateLimitError } from './football-api.service.js'
import type { ApiFootballSquadPlayer, ApiFootballPlayerEntry, ApiFootballPlayerStat, PlayerSyncResult } from '../types/index.js'

export function filterValidStats(statistics: readonly ApiFootballPlayerStat[]): ApiFootballPlayerStat[] {
  return statistics.filter((stat): stat is ApiFootballPlayerStat & { league: { name: string } } =>
    typeof stat.league.name === 'string' && stat.league.name.length > 0
  )
}

const SEASONS = [2025, 2026] as const

interface NationalTeamRow {
  readonly id: string
  readonly externalId: number
}

export async function syncPlayers(client: FootballApiClient): Promise<PlayerSyncResult> {
  const nationalTeams = await db
    .select({ id: teams.id, externalId: teams.externalId })
    .from(teams)
    .where(and(isNotNull(teams.externalId), eq(teams.teamType, 'national')))

  const teamsWithExtId = nationalTeams.filter(
    (t): t is NationalTeamRow => t.externalId !== null
  )

  let inserted = 0
  let updated = 0
  let statsUpserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const team of teamsWithExtId) {
    try {
      const squadResult = await syncSquadForTeam(client, team)
      inserted += squadResult.inserted
      updated += squadResult.updated

      const statsResult = await syncStatsForTeam(client, team)
      statsUpserted += statsResult.statsUpserted
    } catch (err: unknown) {
      if (err instanceof FootballApiRateLimitError) {
        errors.push(`team ${team.externalId}: rate limit`)
        skipped++
        continue
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`team ${team.externalId}: ${message}`)
      skipped++
    }
  }

  return { inserted, updated, statsUpserted, skipped, errors }
}

async function syncSquadForTeam(
  client: FootballApiClient,
  team: NationalTeamRow
): Promise<{ inserted: number; updated: number }> {
  const response = await client.fetchSquad({ team: team.externalId })
  if (response.response.length === 0) return { inserted: 0, updated: 0 }

  const squad = response.response[0]
  let inserted = 0
  let updated = 0

  for (const player of squad.players) {
    const result = await upsertPlayerFromSquad(player, team.id)
    if (result === 'inserted') inserted++
    else updated++
  }

  return { inserted, updated }
}

async function upsertPlayerFromSquad(
  player: ApiFootballSquadPlayer,
  teamInternalId: string
): Promise<'inserted' | 'updated'> {
  const [existing] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.externalId, player.id))
    .limit(1)

  if (existing) {
    const squadShortName = player.name && player.name.trim().length > 0 ? player.name : null
    const updateSet: {
      position?: string
      shirtNumber?: number
      teamId: string
      shortName?: string
      updatedAt: ReturnType<typeof sql>
    } = {
      position: player.position ?? undefined,
      shirtNumber: player.number ?? undefined,
      teamId: teamInternalId,
      updatedAt: sql`now()`,
    }
    if (squadShortName !== null) {
      updateSet.shortName = squadShortName
    }
    await db.update(players)
      .set(updateSet)
      .where(eq(players.id, existing.id))
    return 'updated'
  }

  await db.insert(players).values({
    id: crypto.randomUUID(),
    name: player.name,
    shortName: player.name,
    externalId: player.id,
    position: player.position,
    shirtNumber: player.number,
    teamId: teamInternalId,
  })
  return 'inserted'
}

async function syncStatsForTeam(
  client: FootballApiClient,
  team: NationalTeamRow
): Promise<{ statsUpserted: number }> {
  let statsUpserted = 0

  for (const season of SEASONS) {
    let page = 1
    let totalPages = 1

    do {
      const response = await client.fetchPlayers({ team: team.externalId, season, page })
      totalPages = response.paging.total

      for (const entry of response.response) {
        await updatePlayerName(entry)
        const count = await upsertPlayerStats(entry)
        statsUpserted += count
      }

      page++
    } while (page <= totalPages)
  }

  return { statsUpserted }
}

async function updatePlayerName(entry: ApiFootballPlayerEntry): Promise<void> {
  const { player } = entry
  const fullName = player.firstname && player.lastname
    ? `${player.firstname} ${player.lastname}`.trim()
    : player.name

  const [existing] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.externalId, player.id))
    .limit(1)

  if (existing) {
    const shortName = player.name && player.name.trim().length > 0 ? player.name : null
    const updateSet: { name: string; shortName?: string; updatedAt: ReturnType<typeof sql> } = {
      name: fullName,
      updatedAt: sql`now()`,
    }
    if (shortName !== null) {
      updateSet.shortName = shortName
    }
    await db.update(players)
      .set(updateSet)
      .where(eq(players.id, existing.id))
  }
}

async function upsertPlayerStats(entry: ApiFootballPlayerEntry): Promise<number> {
  const [playerRow] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.externalId, entry.player.id))
    .limit(1)

  if (!playerRow) return 0

  let count = 0
  for (const stat of filterValidStats(entry.statistics)) {
    await upsertSingleStat(playerRow.id, stat)
    count++
  }
  return count
}

async function upsertSingleStat(playerId: string, stat: ApiFootballPlayerStat): Promise<void> {
  await db.insert(playerStats).values({
    id: crypto.randomUUID(),
    playerId,
    season: stat.league.season,
    leagueName: stat.league.name!,
    appearances: stat.games.appearences ?? 0,
    goals: stat.goals.total ?? 0,
    assists: stat.goals.assists ?? 0,
    conceded: stat.goals.conceded ?? 0,
    passes: stat.passes.total ?? 0,
    keyPasses: stat.passes.key ?? 0,
    passAccuracy: stat.passes.accuracy ?? null,
    duelsTotal: stat.duels.total ?? 0,
    duelsWon: stat.duels.won ?? 0,
    yellowCards: stat.cards.yellow ?? 0,
    redCards: stat.cards.red ?? 0,
  }).onConflictDoUpdate({
    target: [playerStats.playerId, playerStats.season, playerStats.leagueName],
    set: {
      appearances: sql`excluded.appearances`,
      goals: sql`excluded.goals`,
      assists: sql`excluded.assists`,
      conceded: sql`excluded.conceded`,
      passes: sql`excluded.passes`,
      keyPasses: sql`excluded.key_passes`,
      passAccuracy: sql`excluded.pass_accuracy`,
      duelsTotal: sql`excluded.duels_total`,
      duelsWon: sql`excluded.duels_won`,
      yellowCards: sql`excluded.yellow_cards`,
      redCards: sql`excluded.red_cards`,
      updatedAt: sql`now()`,
    },
  })
}
