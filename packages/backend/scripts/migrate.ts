import pg from 'pg'
import { runMigrationsOnClient, type MigrationRunOptions } from '../src/db/migrator.js'

function parseBaselineEnv(): MigrationRunOptions {
  const raw = process.env.AUTO_BASELINE_UP_TO_IDX
  if (!raw) return {}
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid AUTO_BASELINE_UP_TO_IDX value: ${raw}`)
  }
  return { baselineUpToIdx: n }
}

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const options = parseBaselineEnv()
    if (typeof options.baselineUpToIdx === 'number') {
      console.log(`AUTO_BASELINE_UP_TO_IDX=${options.baselineUpToIdx} — baselining entries up to idx ${options.baselineUpToIdx}.`)
    }
    console.log('Running migrations...')
    const result = await runMigrationsOnClient(client, undefined, options)
    if (result.baselined.length > 0) {
      console.log(`Baselined ${result.baselined.length} migration(s) without executing SQL.`)
    }
    if (result.applied.length === 0) {
      console.log(`Up to date — ${result.skipped} migration(s) already applied.`)
    } else {
      console.log(`Applied ${result.applied.length} migration(s), skipped ${result.skipped}.`)
    }
  } finally {
    await client.end()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
