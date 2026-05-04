import { runSync } from './sync.service.js'
import { buildConfig, createFootballApiClient } from './football-api.service.js'
import type { SyncMode, SyncRunResult } from '../types/index.js'

export interface LeagueConfig {
  readonly externalId: number
  readonly internalId: string
  readonly season: number
}

function getConfiguredLeagues(): LeagueConfig[] {
  const leagues: LeagueConfig[] = []

  const wcLeagueId = process.env['FOOTBALL_API_WC_LEAGUE_ID']
  const wcInternalId = process.env['FOOTBALL_INTERNAL_WC_LEAGUE_ID']
  if (wcLeagueId && wcInternalId) {
    leagues.push({ externalId: Number(wcLeagueId), internalId: wcInternalId, season: 2026 })
  }

  const nbiLeagueId = process.env['FOOTBALL_API_NBI_LEAGUE_ID']
  const nbiInternalId = process.env['FOOTBALL_INTERNAL_NBI_LEAGUE_ID']
  if (nbiLeagueId && nbiInternalId) {
    leagues.push({ externalId: Number(nbiLeagueId), internalId: nbiInternalId, season: 2025 })
  }

  return leagues
}

export async function runAllLeagues(mode: SyncMode): Promise<SyncRunResult[]> {
  const leagues = getConfiguredLeagues()
  if (leagues.length === 0) {
    throw new Error('No leagues configured. Set FOOTBALL_INTERNAL_WC_LEAGUE_ID and/or FOOTBALL_INTERNAL_NBI_LEAGUE_ID.')
  }

  const config = buildConfig()
  const client = createFootballApiClient(config)
  const results: SyncRunResult[] = []

  for (const league of leagues) {
    const result = await runSync(league.externalId, league.internalId, league.season, client, mode)
    results.push(result)
  }

  return results
}
