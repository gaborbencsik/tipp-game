import { runSync, runSplitSync } from './sync.service.js'
import { buildConfig, createFootballApiClient } from './football-api.service.js'
import {
  PRE_VB_FIXTURE_GROUPS,
  PRE_VB_GROUP_SHORT_NAMES,
  type PreVbGroupShortName,
} from '../constants/pre-vb-fixture-groups.js'
import { db } from '../db/client.js'
import { leagues } from '../db/schema/index.js'
import { inArray } from 'drizzle-orm'
import type { SyncMode, SyncRunResult } from '../types/index.js'

export interface StaticGroupSpec {
  readonly shortName: string
  readonly allowlist: readonly number[]
}

export interface LeagueConfig {
  readonly externalId: number
  readonly internalId?: string
  readonly staticGroups?: readonly StaticGroupSpec[]
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
  readonly internalIdEnv?: string
  readonly season: number
  readonly dateRange?: { readonly from: string; readonly to: string }
  readonly fixtureAllowlist?: readonly number[]
  readonly staticGroups?: readonly StaticGroupSpec[]
}

const PRE_VB_STATIC_GROUPS: readonly StaticGroupSpec[] = PRE_VB_GROUP_SHORT_NAMES.map(
  (shortName: PreVbGroupShortName) => ({
    shortName,
    allowlist: PRE_VB_FIXTURE_GROUPS[shortName],
  })
)

const LEAGUE_SPECS: readonly LeagueEnvSpec[] = [
  { name: 'VB', externalIdEnv: 'FOOTBALL_API_WC_LEAGUE_ID', internalIdEnv: 'FOOTBALL_INTERNAL_WC_LEAGUE_ID', season: 2026 },
  { name: 'NB I', externalIdEnv: 'FOOTBALL_API_NBI_LEAGUE_ID', internalIdEnv: 'FOOTBALL_INTERNAL_NBI_LEAGUE_ID', season: 2025 },
  {
    name: 'Pre-VB Edzőmeccsek',
    externalIdEnv: 'FOOTBALL_API_FRIENDLY_LEAGUE_ID',
    season: 2026,
    dateRange: { from: '2026-05-01', to: '2026-07-10' },
    staticGroups: PRE_VB_STATIC_GROUPS,
  },
]

function getConfiguredLeagues(): LeagueConfig[] {
  const result: LeagueConfig[] = []
  for (const spec of LEAGUE_SPECS) {
    const externalId = process.env[spec.externalIdEnv]
    if (!externalId) continue

    if (spec.staticGroups) {
      result.push({
        externalId: Number(externalId),
        season: spec.season,
        staticGroups: spec.staticGroups,
        ...(spec.dateRange ? { dateRange: spec.dateRange } : {}),
      })
      continue
    }

    if (!spec.internalIdEnv) continue
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

    if (spec.staticGroups) {
      descriptors.push({ name: spec.name, externalId: Number(externalId), season: spec.season })
      continue
    }

    if (!spec.internalIdEnv) continue
    const internalId = process.env[spec.internalIdEnv]
    if (!internalId) continue
    descriptors.push({ name: spec.name, externalId: Number(externalId), season: spec.season })
  }
  return descriptors
}

async function lookupLeagueIdsByShortName(shortNames: readonly string[]): Promise<string[]> {
  const rows = await db
    .select({ id: leagues.id, shortName: leagues.shortName })
    .from(leagues)
    .where(inArray(leagues.shortName, shortNames as string[]))
  const idByShortName = new Map(rows.map((r) => [r.shortName, r.id]))
  const ordered: string[] = []
  for (const name of shortNames) {
    const id = idByShortName.get(name)
    if (!id) throw new Error(`League short_name not found in DB: ${name}`)
    ordered.push(id)
  }
  return ordered
}

export async function runAllLeagues(mode: SyncMode): Promise<SyncRunResult[]> {
  const leaguesToRun = getConfiguredLeagues()
  if (leaguesToRun.length === 0) {
    throw new Error('No leagues configured. Set FOOTBALL_API_*_LEAGUE_ID (and matching FOOTBALL_INTERNAL_*_LEAGUE_ID for non-split leagues).')
  }

  const config = buildConfig()
  const client = createFootballApiClient(config)
  const results: SyncRunResult[] = []

  for (const league of leaguesToRun) {
    if (league.staticGroups) {
      const shortNames = league.staticGroups.map((g) => g.shortName)
      const internalIds = await lookupLeagueIdsByShortName(shortNames)
      const groups = league.staticGroups.map((g, i) => ({
        internalId: internalIds[i]!,
        allowlist: g.allowlist,
      }))
      const splitResults = await runSplitSync({
        leagueExternalId: league.externalId,
        groups,
        season: league.season,
        client,
        mode,
        ...(league.dateRange ? { dateRange: league.dateRange } : {}),
      })
      results.push(...splitResults)
      continue
    }

    if (league.internalId) {
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
  }

  return results
}
