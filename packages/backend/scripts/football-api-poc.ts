import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const API_KEY = process.env['FOOTBALL_API_KEY']
const BASE_URL = process.env['FOOTBALL_API_BASE_URL'] ?? 'https://v3.football.api-sports.io'
const OUTPUT_DIR = join(import.meta.dirname, '../tests/fixtures')

if (!API_KEY) {
  console.error('FOOTBALL_API_KEY env var is required. Get one at https://dashboard.api-football.com/register')
  process.exit(1)
}

// ─── Config ────────────────────────────────────────────────────────────────────

const LEAGUES = [
  { id: 1, season: '2022', name: 'FIFA World Cup 2022' },
  { id: 271, season: '2022', name: 'NB I 2022/23' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchApi(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(endpoint, BASE_URL)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  console.log(`  GET ${endpoint} ${JSON.stringify(params)}`)
  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY! } })

  const remaining = res.headers.get('x-ratelimit-remaining')
  const limit = res.headers.get('x-ratelimit-requests-limit')
  console.log(`  Rate limit: ${remaining}/${limit} remaining`)

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }

  return res.json()
}

function save(filename: string, data: unknown): void {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(join(OUTPUT_DIR, filename), JSON.stringify(data, null, 2))
  console.log(`  → Saved: tests/fixtures/${filename}`)
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════')
  console.log(' Football API POC – Data Fetch')
  console.log('═══════════════════════════════════════════════════════\n')

  for (const league of LEAGUES) {
    console.log(`\n── ${league.name} (league=${league.id}, season=${league.season}) ──\n`)

    // Teams
    console.log('[Teams]')
    const teams = await fetchApi('/teams', { league: String(league.id), season: league.season })
    save(`api-football-teams-league-${league.id}.json`, teams)

    // Fixtures
    console.log('[Fixtures]')
    const fixtures = await fetchApi('/fixtures', { league: String(league.id), season: league.season })
    save(`api-football-fixtures-league-${league.id}.json`, fixtures)
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(' Done.')
  console.log('═══════════════════════════════════════════════════════')
}

run().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
