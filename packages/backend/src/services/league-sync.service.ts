import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { leagues, auditLogs } from '../db/schema/index.js'
import { runSync } from './sync.service.js'
import { syncPlayersForLeague } from './player-sync.service.js'
import { buildConfig, createFootballApiClient } from './football-api.service.js'
import type { LeagueSyncSummary, SyncMode } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

// Per-league on-demand sync (US-956). Reuses runSync for match+team sync, then
// runs the league-scoped player sync. The global runAllLeagues path is untouched.
// HARD RULE (US-949): an archived league is NEVER synced.
export async function runLeagueSync(leagueId: string, actorId: string): Promise<LeagueSyncSummary> {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1)
  if (!league) throw new AppError(404, 'League not found')
  if (league.status === 'archived') throw new AppError(409, 'Archived league cannot be synced')
  if (league.externalId === null || league.season === null) {
    throw new AppError(400, 'League has no external id / season configured')
  }

  const client = createFootballApiClient(buildConfig())
  const mode: SyncMode = 'full_live'
  const dateRange =
    league.syncFrom && league.syncTo
      ? { from: league.syncFrom.toISOString(), to: league.syncTo.toISOString() }
      : undefined

  // Step 1: match + team sync (reuse runSync — do NOT reimplement).
  const syncResult = await runSync({
    leagueExternalId: league.externalId,
    leagueInternalId: league.id,
    season: league.season,
    client,
    mode,
    ...(dateRange ? { dateRange } : {}),
    ...(league.fixtureAllowlist ? { fixtureAllowlist: league.fixtureAllowlist } : {}),
  })

  // Step 2: league-scoped player sync (after teams exist).
  const playerResult = await syncPlayersForLeague(client, league.id, league.season)

  const errors = [...syncResult.errors, ...playerResult.errors]
  const playersUpserted = playerResult.inserted + playerResult.updated

  await db.insert(auditLogs).values({
    actorId,
    action: 'league_sync_run',
    entityType: 'league',
    entityId: league.id,
    previousValue: null,
    newValue: {
      matchesUpserted: syncResult.fixturesUpserted,
      teamsUpserted: syncResult.teamsUpserted,
      playersUpserted,
      errors,
    },
  })

  return {
    matchesUpserted: syncResult.fixturesUpserted,
    teamsUpserted: syncResult.teamsUpserted,
    playersUpserted,
    errors,
  }
}
