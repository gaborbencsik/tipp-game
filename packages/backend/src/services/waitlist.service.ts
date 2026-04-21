import { desc, eq, ilike, sql, and, type SQL } from 'drizzle-orm'
import { db } from '../db/client.js'
import { waitlistEntries } from '../db/schema/index.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface WaitlistEntry {
  readonly id: string
  readonly email: string
  readonly source: 'hero' | 'footer'
  readonly createdAt: string
}

export interface WaitlistFilters {
  readonly source?: 'hero' | 'footer'
  readonly search?: string
}

export interface WaitlistListResult {
  readonly totalCount: number
  readonly entries: WaitlistEntry[]
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 255
}

export async function addToWaitlist(email: string, source: 'hero' | 'footer'): Promise<void> {
  await db
    .insert(waitlistEntries)
    .values({ email: email.toLowerCase().trim(), source })
    .onConflictDoNothing()
}

export async function getWaitlistEntries(filters?: WaitlistFilters): Promise<WaitlistListResult> {
  const conditions: SQL[] = []

  if (filters?.source) {
    conditions.push(eq(waitlistEntries.source, filters.source))
  }

  if (filters?.search) {
    conditions.push(ilike(waitlistEntries.email, `%${filters.search}%`))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [countResult, entries] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(waitlistEntries)
      .where(where),
    db
      .select()
      .from(waitlistEntries)
      .where(where)
      .orderBy(desc(waitlistEntries.createdAt)),
  ])

  return {
    totalCount: countResult[0]?.count ?? 0,
    entries: entries.map((row) => ({
      id: row.id,
      email: row.email,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}
