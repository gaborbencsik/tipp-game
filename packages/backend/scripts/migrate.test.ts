import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  runMigrationsOnClient,
  hashSql,
  splitStatements,
  type DbExecutor,
  type Journal,
  type MigrationLoader,
} from '../src/db/migrator.js'

interface FakeRow {
  readonly hash: string
  readonly created_at: number | null
}

function createFakeClient(seedRows: ReadonlyArray<FakeRow> = []): {
  client: DbExecutor
  executed: string[]
  insertedHashes: string[]
  rows: FakeRow[]
} {
  const rows: FakeRow[] = [...seedRows]
  const insertedHashes: string[] = []
  const executed: string[] = []

  const client: DbExecutor = {
    query: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      executed.push(sql.trim().split('\n')[0])
      if (sql.trim().startsWith('SELECT hash, created_at FROM drizzle.__drizzle_migrations')) {
        return { rows: [...rows] }
      }
      if (sql.trim().startsWith('INSERT INTO drizzle.__drizzle_migrations')) {
        const hash = params![0] as string
        const createdAt = params![1] as number
        insertedHashes.push(hash)
        rows.push({ hash, created_at: createdAt })
        return { rows: [] }
      }
      return { rows: [] }
    }),
  }

  return { client, executed, insertedHashes, rows }
}

function createLoader(entries: Array<{ idx: number; tag: string; when: number; sql: string }>): MigrationLoader {
  const journal: Journal = {
    entries: entries.map(e => ({ idx: e.idx, tag: e.tag, when: e.when })),
  }
  const sqlMap = new Map(entries.map(e => [e.tag, e.sql]))
  return {
    loadJournal: () => journal,
    loadSql: (tag: string) => {
      const sql = sqlMap.get(tag)
      if (!sql) throw new Error(`No SQL fixture for ${tag}`)
      return sql
    },
  }
}

describe('migrate runner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('splitStatements', () => {
    it('splits on --> statement-breakpoint and trims', () => {
      const sql = 'CREATE TABLE a;--> statement-breakpoint\nALTER TABLE a ADD COLUMN x int;'
      expect(splitStatements(sql)).toEqual([
        'CREATE TABLE a;',
        'ALTER TABLE a ADD COLUMN x int;',
      ])
    })

    it('returns single element when no breakpoint', () => {
      expect(splitStatements('CREATE TABLE x;')).toEqual(['CREATE TABLE x;'])
    })

    it('drops empty fragments', () => {
      const sql = 'CREATE TABLE a;--> statement-breakpoint\n\n--> statement-breakpoint\nALTER TABLE a;'
      expect(splitStatements(sql)).toEqual(['CREATE TABLE a;', 'ALTER TABLE a;'])
    })
  })

  describe('hashSql', () => {
    it('produces stable sha256 for the same input', () => {
      expect(hashSql('CREATE TABLE x;')).toBe(hashSql('CREATE TABLE x;'))
    })

    it('produces different hashes for different SQL', () => {
      expect(hashSql('CREATE TABLE x;')).not.toBe(hashSql('CREATE TABLE x;\n'))
    })
  })

  describe('runMigrationsOnClient', () => {
    it('applies all migrations against an empty tracking table', async () => {
      const { client, insertedHashes } = createFakeClient()
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual(['0000_a', '0001_b'])
      expect(result.skipped).toBe(0)
      expect(insertedHashes).toHaveLength(2)
      expect(insertedHashes).toContain(hashSql('CREATE TABLE a;'))
      expect(insertedHashes).toContain(hashSql('CREATE TABLE b;'))
    })

    it('skips migrations whose hash is already in the tracking table', async () => {
      const { client } = createFakeClient([
        { hash: hashSql('CREATE TABLE a;'), created_at: 100 },
      ])
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual(['0001_b'])
      expect(result.skipped).toBe(1)
    })

    it('returns idempotent result when everything is already applied', async () => {
      const { client } = createFakeClient([
        { hash: hashSql('CREATE TABLE a;'), created_at: 100 },
        { hash: hashSql('CREATE TABLE b;'), created_at: 200 },
      ])
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual([])
      expect(result.skipped).toBe(2)
    })

    it('treats a journal entry as applied when only the when timestamp matches an existing row', async () => {
      // Simulates a legacy DB where a different hash algorithm wrote rows whose
      // hashes do not match what this runner would compute today, but the
      // created_at values still equal the journal `when` timestamps.
      const { client } = createFakeClient([
        { hash: 'legacy-hash-from-old-drizzle', created_at: 100 },
        { hash: 'another-legacy-hash', created_at: 200 },
      ])
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
        { idx: 2, tag: '0002_c', when: 300, sql: 'CREATE TABLE c;' }, // genuinely new
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual(['0002_c'])
      expect(result.skipped).toBe(2)
    })

    it('skips on hash match even when created_at row does not exist', async () => {
      // Hash is the primary key; created_at is a fallback only.
      const { client } = createFakeClient([
        { hash: hashSql('CREATE TABLE a;'), created_at: 999_999 }, // mismatched created_at
      ])
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual([])
      expect(result.skipped).toBe(1)
    })

    it('applies non-monotonic when entries in idx order', async () => {
      const { client } = createFakeClient()
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 500, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 100, sql: 'CREATE TABLE b;' },
        { idx: 2, tag: '0002_c', when: 200, sql: 'CREATE TABLE c;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual(['0000_a', '0001_b', '0002_c'])
    })

    it('processes entries in idx order even if journal array is shuffled', async () => {
      const { client } = createFakeClient()
      const loader = createLoader([
        { idx: 2, tag: '0002_c', when: 300, sql: 'CREATE TABLE c;' },
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual(['0000_a', '0001_b', '0002_c'])
    })

    it('runs each migration inside a BEGIN/COMMIT transaction', async () => {
      const { client, executed } = createFakeClient()
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
      ])

      await runMigrationsOnClient(client, loader)

      const txStart = executed.indexOf('BEGIN')
      const create = executed.findIndex(s => s.startsWith('CREATE TABLE a'))
      const insert = executed.findIndex(s => s.startsWith('INSERT INTO drizzle.__drizzle_migrations'))
      const commit = executed.indexOf('COMMIT')
      expect(txStart).toBeGreaterThanOrEqual(0)
      expect(create).toBeGreaterThan(txStart)
      expect(insert).toBeGreaterThan(create)
      expect(commit).toBeGreaterThan(insert)
    })

    it('rolls back the transaction when a statement fails', async () => {
      const rows: FakeRow[] = []
      const executed: string[] = []
      const client: DbExecutor = {
        query: vi.fn(async (sql: string, params?: readonly unknown[]) => {
          executed.push(sql.trim().split('\n')[0])
          if (sql.includes('FAIL_HERE')) {
            throw new Error('boom')
          }
          if (sql.trim().startsWith('SELECT hash, created_at FROM drizzle.__drizzle_migrations')) {
            return { rows: [...rows] }
          }
          if (sql.trim().startsWith('INSERT INTO drizzle.__drizzle_migrations')) {
            rows.push({ hash: params![0] as string, created_at: params![1] as number })
            return { rows: [] }
          }
          return { rows: [] }
        }),
      }
      const loader = createLoader([
        { idx: 0, tag: '0000_bad', when: 100, sql: 'FAIL_HERE;' },
      ])

      await expect(runMigrationsOnClient(client, loader)).rejects.toThrow('boom')
      expect(executed).toContain('ROLLBACK')
      expect(rows).toHaveLength(0)
    })

    it('splits statement-breakpoint SQL into separate query calls', async () => {
      const { client, executed } = createFakeClient()
      const loader = createLoader([
        {
          idx: 0,
          tag: '0000_multi',
          when: 100,
          sql: 'CREATE TABLE a;--> statement-breakpoint\nALTER TABLE a ADD COLUMN x int;',
        },
      ])

      await runMigrationsOnClient(client, loader)

      const createCount = executed.filter(s => s.startsWith('CREATE TABLE a')).length
      const alterCount = executed.filter(s => s.startsWith('ALTER TABLE a')).length
      expect(createCount).toBe(1)
      expect(alterCount).toBe(1)
    })

    it('verify-step throws when a journal entry is missing from tracking table', async () => {
      // Simulate a buggy state: client silently swallows INSERT (no rows recorded)
      const executed: string[] = []
      const client: DbExecutor = {
        query: vi.fn(async (sql: string) => {
          executed.push(sql.trim().split('\n')[0])
          if (sql.trim().startsWith('SELECT hash, created_at FROM drizzle.__drizzle_migrations')) {
            return { rows: [] }
          }
          return { rows: [] }
        }),
      }
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
      ])

      await expect(runMigrationsOnClient(client, loader)).rejects.toThrow(
        /Migration verify failed.*0000_a/,
      )
    })
  })

  describe('baselineUpToIdx option', () => {
    it('records hash + when for entries idx<=N without executing their SQL', async () => {
      const { client, executed, insertedHashes } = createFakeClient()
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
        { idx: 2, tag: '0002_c', when: 300, sql: 'CREATE TABLE c;' },
      ])

      const result = await runMigrationsOnClient(client, loader, { baselineUpToIdx: 1 })

      expect(result.baselined).toEqual(['0000_a', '0001_b'])
      expect(result.applied).toEqual(['0002_c'])
      expect(insertedHashes).toContain(hashSql('CREATE TABLE a;'))
      expect(insertedHashes).toContain(hashSql('CREATE TABLE b;'))
      expect(insertedHashes).toContain(hashSql('CREATE TABLE c;'))
      // 0000_a / 0001_b SQL must NOT have been executed
      expect(executed.some(s => s.startsWith('CREATE TABLE a'))).toBe(false)
      expect(executed.some(s => s.startsWith('CREATE TABLE b'))).toBe(false)
      // 0002_c SQL MUST have been executed
      expect(executed.some(s => s.startsWith('CREATE TABLE c'))).toBe(true)
    })

    it('does not double-baseline entries already tracked by hash', async () => {
      const { client, insertedHashes } = createFakeClient([
        { hash: hashSql('CREATE TABLE a;'), created_at: 100 },
      ])
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader, { baselineUpToIdx: 1 })

      expect(result.baselined).toEqual(['0001_b'])
      expect(result.applied).toEqual([])
      expect(result.skipped).toBe(2)
      // 0000_a was already there — should not be inserted again
      expect(insertedHashes.filter(h => h === hashSql('CREATE TABLE a;'))).toHaveLength(0)
      expect(insertedHashes).toContain(hashSql('CREATE TABLE b;'))
    })

    it('does not double-baseline entries already tracked by created_at fallback', async () => {
      const { client, insertedHashes } = createFakeClient([
        { hash: 'legacy-different-hash', created_at: 100 },
      ])
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
      ])

      const result = await runMigrationsOnClient(client, loader, { baselineUpToIdx: 0 })

      expect(result.baselined).toEqual([])
      expect(result.skipped).toBe(1)
      expect(insertedHashes).toHaveLength(0)
    })

    it('does not execute BEGIN/COMMIT for baselined entries', async () => {
      const { client, executed } = createFakeClient()
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
      ])

      await runMigrationsOnClient(client, loader, { baselineUpToIdx: 0 })

      expect(executed).not.toContain('BEGIN')
      expect(executed).not.toContain('COMMIT')
    })

    it('baselines in idx order even with shuffled journal', async () => {
      const { client, insertedHashes } = createFakeClient()
      const loader = createLoader([
        { idx: 2, tag: '0002_c', when: 300, sql: 'CREATE TABLE c;' },
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader, { baselineUpToIdx: 2 })

      expect(result.baselined).toEqual(['0000_a', '0001_b', '0002_c'])
      expect(insertedHashes).toHaveLength(3)
    })
  })
})
