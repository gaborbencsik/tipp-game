import pg from 'pg'
import { runMigrationsOnClient } from './migrator.js'

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    console.log('Running migrations...')
    const result = await runMigrationsOnClient(client)
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
