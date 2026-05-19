import { runSync } from './sync.service.js'
import { buildConfig, createFootballApiClient } from './football-api.service.js'
import type { SyncMode, SyncRunResult } from '../types/index.js'

export interface LeagueConfig {
  readonly externalId: number
  readonly internalId: string
  readonly season: number
}

export interface ConfiguredLeagueDescriptor {
  readonly name: string
  readonly externalId: number
  readonly season: number
}

interface LeagueEnvSpec {
  readonly name: string
  readonly externalIdEnv: string
  readonly internalIdEnv: string
  readonly season: number
}

const LEAGUE_SPECS: readonly LeagueEnvSpec[] = [
  { name: 'VB', externalIdEnv: 'FOOTBALL_API_WC_LEAGUE_ID', internalIdEnv: 'FOOTBALL_INTERNAL_WC_LEAGUE_ID', season: 2026 },
  { name: 'NB I', externalIdEnv: 'FOOTBALL_API_NBI_LEAGUE_ID', internalIdEnv: 'FOOTBALL_INTERNAL_NBI_LEAGUE_ID', season: 2025 },
]

function getConfiguredLeagues(): LeagueConfig[] {
  const leagues: LeagueConfig[] = []
  for (const spec of LEAGUE_SPECS) {
    const externalId = process.env[spec.externalIdEnv]
    const internalId = process.env[spec.internalIdEnv]
    if (externalId && internalId) {
      leagues.push({ externalId: Number(externalId), internalId, season: spec.season })
    }
  }
  return leagues
}

export function getConfiguredLeagueDescriptors(): ConfiguredLeagueDescriptor[] {
  const descriptors: ConfiguredLeagueDescriptor[] = []
  for (const spec of LEAGUE_SPECS) {
    const externalId = process.env[spec.externalIdEnv]
    const internalId = process.env[spec.internalIdEnv]
    if (externalId && internalId) {
      descriptors.push({ name: spec.name, externalId: Number(externalId), season: spec.season })
    }
  }
  return descriptors
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
