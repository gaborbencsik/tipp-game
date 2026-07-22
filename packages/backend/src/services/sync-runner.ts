import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { leagues } from '../db/schema/index.js'
import { runSync } from './sync.service.js'
import { buildConfig, createFootballApiClient } from './football-api.service.js'
import type { SyncMode, SyncRunResult } from '../types/index.js'

export interface LeagueConfig {
  readonly externalId: number
  readonly internalId: string
  readonly season: number
  readonly dateRange?: { readonly from: string; readonly to: string }
  readonly fixtureAllowlist?: readonly number[]
}

export interface ConfiguredLeagueDescriptor {
  readonly name: string
  readonly externalId: number
  readonly season: number
}

// Only leagues with sync_enabled = true AND status = 'active' are synced.
// HARD RULE: an archived league is NEVER synced, even if sync_enabled = true.
async function getSyncableLeagues(): Promise<(typeof leagues.$inferSelect)[]> {
  return db
    .select()
    .from(leagues)
    .where(and(eq(leagues.syncEnabled, true), eq(leagues.status, 'active')))
}

async function getConfiguredLeagues(): Promise<LeagueConfig[]> {
  const rows = await getSyncableLeagues()
  const result: LeagueConfig[] = []
  for (const row of rows) {
    if (row.externalId === null || row.season === null) continue
    const dateRange =
      row.syncFrom && row.syncTo
        ? { from: row.syncFrom.toISOString(), to: row.syncTo.toISOString() }
        : undefined
    result.push({
      externalId: row.externalId,
      internalId: row.id,
      season: row.season,
      ...(dateRange ? { dateRange } : {}),
      ...(row.fixtureAllowlist ? { fixtureAllowlist: row.fixtureAllowlist } : {}),
    })
  }
  return result
}

export async function getConfiguredLeagueDescriptors(): Promise<ConfiguredLeagueDescriptor[]> {
  const rows = await getSyncableLeagues()
  const descriptors: ConfiguredLeagueDescriptor[] = []
  for (const row of rows) {
    if (row.externalId === null || row.season === null) continue
    descriptors.push({ name: row.shortName, externalId: row.externalId, season: row.season })
  }
  return descriptors
}

export async function runAllLeagues(mode: SyncMode): Promise<SyncRunResult[]> {
  const leaguesToRun = await getConfiguredLeagues()
  if (leaguesToRun.length === 0) {
    throw new Error('No active leagues in DB. Enable sync on a league (sync_enabled = true, status = active) with external_id and season set.')
  }

  const config = buildConfig()
  const client = createFootballApiClient(config)
  const results: SyncRunResult[] = []

  for (const league of leaguesToRun) {
    const result = await runSync({
      leagueExternalId: league.externalId,
      leagueInternalId: league.internalId,
      season: league.season,
      client,
      mode,
      ...(league.dateRange ? { dateRange: league.dateRange } : {}),
      ...(league.fixtureAllowlist ? { fixtureAllowlist: league.fixtureAllowlist } : {}),
    })
    results.push(result)
  }

  return results
}
