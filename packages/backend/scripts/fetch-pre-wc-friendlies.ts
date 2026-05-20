import { writeFileSync } from 'fs'
import { buildConfig, createFootballApiClient } from '../src/services/football-api.service.js'
import {
  PRE_VB_FIXTURE_GROUPS,
  PRE_VB_GROUP_SHORT_NAMES,
  PRE_VB_ALL_FIXTURE_IDS,
  type PreVbGroupShortName,
} from '../src/constants/pre-vb-fixture-groups.js'
import type { ApiFootballFixture, ApiFootballTeamEntry } from '../src/types/index.js'

const LEAGUE_ID = 10
const SEASON = 2026
const FROM = '2026-05-01'
const TO = '2026-07-10'

function fmtTeam(t: ApiFootballTeamEntry): string {
  const code = t.code ? `[${t.code}]` : '[—]'
  return `${t.name} ${code}`
}

function formatRow(f: ApiFootballFixture, suffix = ''): string {
  const id = String(f.fixture.id).padEnd(8)
  const date = f.fixture.date.slice(0, 16).replace('T', ' ')
  const home = fmtTeam(f.teams.home)
  const away = fmtTeam(f.teams.away)
  const base = `  ${id} ${date}  ${home}  vs  ${away}`
  return suffix ? `${base}    ${suffix}` : base
}

function groupOf(fixtureId: number): PreVbGroupShortName | null {
  for (const sn of PRE_VB_GROUP_SHORT_NAMES) {
    if (PRE_VB_FIXTURE_GROUPS[sn].includes(fixtureId)) return sn
  }
  return null
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const jsonOut = args.find((a) => a.startsWith('--json'))?.split('=')[1] ?? null

  const config = buildConfig()
  const client = createFootballApiClient(config)

  console.error(`Fetching league=${LEAGUE_ID} season=${SEASON} from=${FROM} to=${TO}…`)
  const response = await client.fetchFixtures({ league: LEAGUE_ID, season: SEASON, from: FROM, to: TO })
  console.error(`Got ${response.results} fixtures.\n`)

  const apiFixtures = response.response
  const apiIdSet = new Set(apiFixtures.map((f) => f.fixture.id))
  const curatedSet = new Set(PRE_VB_ALL_FIXTURE_IDS)

  const matchedByGroup: Record<PreVbGroupShortName, ApiFootballFixture[]> = {
    'PRE-VB-1': [],
    'PRE-VB-2': [],
    'PRE-VB-3': [],
  }
  const orphansFromApi: ApiFootballFixture[] = []
  for (const f of apiFixtures) {
    const g = groupOf(f.fixture.id)
    if (g) matchedByGroup[g].push(f)
    else orphansFromApi.push(f)
  }
  for (const sn of PRE_VB_GROUP_SHORT_NAMES) {
    matchedByGroup[sn].sort((a, b) => a.fixture.date.localeCompare(b.fixture.date))
  }

  const missingFromApi = [...curatedSet].filter((id) => !apiIdSet.has(id))

  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(` KURÁLT meccsek az API-ban — ${PRE_VB_ALL_FIXTURE_IDS.length - missingFromApi.length}/${PRE_VB_ALL_FIXTURE_IDS.length}`)
  console.log('═══════════════════════════════════════════════════════════════════')
  for (const sn of PRE_VB_GROUP_SHORT_NAMES) {
    const list = matchedByGroup[sn]
    console.log(`\n  ── ${sn} — ${list.length}/${PRE_VB_FIXTURE_GROUPS[sn].length} db ──`)
    for (const f of list) console.log(formatRow(f))
  }

  if (missingFromApi.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════════')
    console.log(` HIÁNYZÓ kurált fixture id-k (nincsenek az API-válaszban) — ${missingFromApi.length}`)
    console.log('═══════════════════════════════════════════════════════════════════')
    for (const id of missingFromApi) {
      const g = groupOf(id)
      console.log(`  ${String(id).padEnd(8)} (csoport: ${g ?? '?'})`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════')
  console.log(` API-ban szereplő, de NEM kurált fixture-ök — ${orphansFromApi.length}`)
  console.log(' (csak diagnosztika; nem kerülnek a DB-be)')
  console.log('═══════════════════════════════════════════════════════════════════')
  const sortedOrphans = [...orphansFromApi].sort((a, b) => a.fixture.date.localeCompare(b.fixture.date))
  for (const f of sortedOrphans) console.log(formatRow(f))

  console.log('\n───────────────────────────────────────────────────────────────────')
  console.log(`Összesen API: ${apiFixtures.length} | Kurált: ${PRE_VB_ALL_FIXTURE_IDS.length} | Egyezik: ${PRE_VB_ALL_FIXTURE_IDS.length - missingFromApi.length} | Hiányzik: ${missingFromApi.length} | Plusz az API-ban: ${orphansFromApi.length}`)
  console.log('───────────────────────────────────────────────────────────────────')
  console.log('\nA kurált csoportok forrása: packages/backend/src/constants/pre-vb-fixture-groups.ts')
  console.log('Új meccs felvételéhez ezt a fájlt kell szerkeszteni és commit-olni.')

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(response, null, 2))
    console.error(`\nJSON dump → ${jsonOut}`)
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Error: ${message}`)
  process.exit(1)
})
