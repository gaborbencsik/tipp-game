import crypto from 'node:crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface JournalEntry {
  readonly idx: number
  readonly tag: string
  readonly when: number
}

export interface Journal {
  readonly entries: readonly JournalEntry[]
}

interface AppliedRow {
  readonly hash: string
  readonly created_at: string | number | null
}

export interface MigrationLoader {
  readonly loadJournal: () => Journal
  readonly loadSql: (tag: string) => string
}

export interface DbExecutor {
  query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: readonly AppliedRow[] }>
}

export interface MigrationRunResult {
  readonly applied: readonly string[]
  readonly skipped: number
}

interface AppliedKeys {
  readonly hashes: ReadonlySet<string>
  readonly createdAts: ReadonlySet<number>
}

const DEFAULT_MIGRATIONS_FOLDER = path.join(__dirname, 'migrations')

export function fileMigrationLoader(folder: string = DEFAULT_MIGRATIONS_FOLDER): MigrationLoader {
  return {
    loadJournal: () => JSON.parse(readFileSync(path.join(folder, 'meta/_journal.json'), 'utf-8')) as Journal,
    loadSql: (tag) => readFileSync(path.join(folder, `${tag}.sql`), 'utf-8'),
  }
}

export function hashSql(sql: string): string {
  return crypto.createHash('sha256').update(sql).digest('hex')
}

export function splitStatements(sql: string): readonly string[] {
  return sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

async function ensureTrackingTable(client: DbExecutor): Promise<void> {
  await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"')
  await client.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)
}

async function getAppliedKeys(client: DbExecutor): Promise<AppliedKeys> {
  const { rows } = await client.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations')
  const hashes = new Set<string>()
  const createdAts = new Set<number>()
  for (const row of rows) {
    hashes.add(row.hash)
    if (row.created_at !== null && row.created_at !== undefined) {
      const n = typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at
      if (Number.isFinite(n)) createdAts.add(n)
    }
  }
  return { hashes, createdAts }
}

function isApplied(applied: AppliedKeys, hash: string, when: number): boolean {
  return applied.hashes.has(hash) || applied.createdAts.has(when)
}

async function applyMigration(
  client: DbExecutor,
  entry: JournalEntry,
  sql: string,
  hash: string,
): Promise<void> {
  const statements = splitStatements(sql)
  await client.query('BEGIN')
  try {
    for (const statement of statements) {
      await client.query(statement)
    }
    await client.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [hash, entry.when],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

export async function runMigrationsOnClient(
  client: DbExecutor,
  loader: MigrationLoader = fileMigrationLoader(),
): Promise<MigrationRunResult> {
  await ensureTrackingTable(client)
  const journal = loader.loadJournal()
  const appliedKeys = await getAppliedKeys(client)

  const sortedEntries = [...journal.entries].sort((a, b) => a.idx - b.idx)
  const applied: string[] = []
  let skipped = 0

  for (const entry of sortedEntries) {
    const sql = loader.loadSql(entry.tag)
    const hash = hashSql(sql)
    if (isApplied(appliedKeys, hash, entry.when)) {
      skipped++
      continue
    }
    console.log(`  Applying ${entry.tag}...`)
    await applyMigration(client, entry, sql, hash)
    applied.push(entry.tag)
  }

  const finalKeys = await getAppliedKeys(client)
  const missing: string[] = []
  for (const entry of sortedEntries) {
    const hash = hashSql(loader.loadSql(entry.tag))
    if (!isApplied(finalKeys, hash, entry.when)) {
      missing.push(entry.tag)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Migration verify failed — these journal entries are not tracked as applied: ${missing.join(', ')}`,
    )
  }

  return { applied, skipped }
}
