import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from '../src/db/client.js'
import pg from 'pg'
import crypto from 'node:crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function ensureMigrationJournal(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) AS "exists"
    `)
    if (rows[0].exists) return

    console.log('No drizzle.__drizzle_migrations table found — bootstrapping from journal...')

    const migrationsFolder = path.join(__dirname, '../src/db/migrations')
    const journalPath = path.join(migrationsFolder, 'meta/_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
      entries: { tag: string; when: number }[]
    }

    await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"')
    await client.query(`
      CREATE TABLE "drizzle"."__drizzle_migrations" (
        id serial PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `)

    for (const entry of journal.entries) {
      const sql = readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), 'utf-8')
      const hash = crypto.createHash('sha256').update(sql).digest('hex')
      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when],
      )
    }

    console.log(`  Marked ${journal.entries.length} existing migrations as applied.`)
  } finally {
    await client.end()
  }
}

async function runMigrations(): Promise<void> {
  await ensureMigrationJournal()
  console.log('Running migrations...')
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../src/db/migrations'),
  })
  console.log('Migrations complete.')
  process.exit(0)
}

runMigrations().catch((err: unknown) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
