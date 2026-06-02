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

interface LeagueEnvSpec {
  readonly name: string
  readonly externalIdEnv: string
  readonly internalIdEnv: string
  readonly season: number
  readonly dateRange?: { readonly from: string; readonly to: string }
  readonly fixtureAllowlist?: readonly number[]
}

const LEAGUE_SPECS: readonly LeagueEnvSpec[] = [
  { name: 'VB', externalIdEnv: 'FOOTBALL_API_WC_LEAGUE_ID', internalIdEnv: 'FOOTBALL_INTERNAL_WC_LEAGUE_ID', season: 2026 },
]

function getConfiguredLeagues(): LeagueConfig[] {
  const result: LeagueConfig[] = []
  for (const spec of LEAGUE_SPECS) {
    const externalId = process.env[spec.externalIdEnv]
    if (!externalId) continue

    const internalId = process.env[spec.internalIdEnv]
    if (!internalId) continue

    result.push({
      externalId: Number(externalId),
      season: spec.season,
      internalId,
      ...(spec.dateRange ? { dateRange: spec.dateRange } : {}),
      ...(spec.fixtureAllowlist ? { fixtureAllowlist: spec.fixtureAllowlist } : {}),
    })
  }
  return result
}

export function getConfiguredLeagueDescriptors(): ConfiguredLeagueDescriptor[] {
  const descriptors: ConfiguredLeagueDescriptor[] = []
  for (const spec of LEAGUE_SPECS) {
    const externalId = process.env[spec.externalIdEnv]
    if (!externalId) continue

    const internalId = process.env[spec.internalIdEnv]
    if (!internalId) continue
    descriptors.push({ name: spec.name, externalId: Number(externalId), season: spec.season })
  }
  return descriptors
}

export async function runAllLeagues(mode: SyncMode): Promise<SyncRunResult[]> {
  const leaguesToRun = getConfiguredLeagues()
  if (leaguesToRun.length === 0) {
    throw new Error('No leagues configured. Set FOOTBALL_API_*_LEAGUE_ID and matching FOOTBALL_INTERNAL_*_LEAGUE_ID.')
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
