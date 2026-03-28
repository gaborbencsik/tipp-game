import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './client.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigrations(): Promise<void> {
  console.log('Running migrations...')
  await migrate(db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
  })
  console.log('Migrations complete.')
  process.exit(0)
}

runMigrations().catch((err: unknown) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
