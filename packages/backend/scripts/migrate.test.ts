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
}

function createFakeClient(): {
  client: DbExecutor
  executed: string[]
  insertedHashes: string[]
} {
  const insertedHashes: string[] = []
  const executed: string[] = []

  const client: DbExecutor = {
    query: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      executed.push(sql.trim().split('\n')[0])
      if (sql.trim().startsWith('SELECT hash FROM drizzle.__drizzle_migrations')) {
        const rows: FakeRow[] = insertedHashes.map(hash => ({ hash }))
        return { rows }
      }
      if (sql.trim().startsWith('INSERT INTO drizzle.__drizzle_migrations')) {
        insertedHashes.push(params![0] as string)
        return { rows: [] }
      }
      return { rows: [] }
    }),
  }

  return { client, executed, insertedHashes }
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
      expect(hashSql('CREATE TABLE x;')).not.toBe(hashSql('CREATE TABLE y;'))
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
      const { client, insertedHashes } = createFakeClient()
      // Pre-populate the first migration as applied
      insertedHashes.push(hashSql('CREATE TABLE a;'))

      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual(['0001_b'])
      expect(result.skipped).toBe(1)
    })

    it('returns idempotent result when everything is already applied', async () => {
      const { client, insertedHashes } = createFakeClient()
      insertedHashes.push(hashSql('CREATE TABLE a;'))
      insertedHashes.push(hashSql('CREATE TABLE b;'))

      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 100, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 200, sql: 'CREATE TABLE b;' },
      ])

      const result = await runMigrationsOnClient(client, loader)

      expect(result.applied).toEqual([])
      expect(result.skipped).toBe(2)
    })

    it('applies non-monotonic when entries in idx order', async () => {
      const { client } = createFakeClient()
      // Order in the journal array (idx-sorted), regardless of `when` values
      const loader = createLoader([
        { idx: 0, tag: '0000_a', when: 500, sql: 'CREATE TABLE a;' },
        { idx: 1, tag: '0001_b', when: 100, sql: 'CREATE TABLE b;' }, // older when
        { idx: 2, tag: '0002_c', when: 200, sql: 'CREATE TABLE c;' }, // older than 0
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
      const insertedHashes: string[] = []
      const executed: string[] = []
      const client: DbExecutor = {
        query: vi.fn(async (sql: string, params?: readonly unknown[]) => {
          executed.push(sql.trim().split('\n')[0])
          if (sql.includes('FAIL_HERE')) {
            throw new Error('boom')
          }
          if (sql.trim().startsWith('SELECT hash FROM drizzle.__drizzle_migrations')) {
            return { rows: insertedHashes.map(hash => ({ hash })) }
          }
          if (sql.trim().startsWith('INSERT INTO drizzle.__drizzle_migrations')) {
            insertedHashes.push(params![0] as string)
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
      expect(insertedHashes).toHaveLength(0)
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
      // Simulate a buggy state: client silently swallows INSERT (does NOT record applied hashes)
      const executed: string[] = []
      const client: DbExecutor = {
        query: vi.fn(async (sql: string) => {
          executed.push(sql.trim().split('\n')[0])
          // Always returns empty applied set, regardless of inserts
          if (sql.trim().startsWith('SELECT hash FROM drizzle.__drizzle_migrations')) {
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
})
