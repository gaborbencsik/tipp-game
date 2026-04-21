import { desc, eq, ilike, sql, and, type SQL } from 'drizzle-orm'
import { db } from '../db/client.js'
import { waitlistEntries } from '../db/schema/index.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type WaitlistSource = 'hero' | 'footer' | 'admin'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export interface WaitlistEntry {
  readonly id: string
  readonly email: string
  readonly source: WaitlistSource
  readonly createdAt: string
}

export interface WaitlistFilters {
  readonly source?: WaitlistSource
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

export async function addWaitlistEntry(email: string, source: WaitlistSource): Promise<WaitlistEntry> {
  const normalizedEmail = email.toLowerCase().trim()

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw new AppError(400, 'Invalid email')
  }

  try {
    const rows = await db
      .insert(waitlistEntries)
      .values({ email: normalizedEmail, source })
      .returning()

    const row = rows[0]
    if (!row) throw new AppError(500, 'Failed to create waitlist entry')

    return {
      id: row.id,
      email: row.email,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    }
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === '23505') throw new AppError(409, 'Email already on waitlist')
    throw err
  }
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  const rows = await db
    .delete(waitlistEntries)
    .where(eq(waitlistEntries.id, id))
    .returning({ id: waitlistEntries.id })

  if (rows.length === 0) {
    throw new AppError(404, 'Waitlist entry not found')
  }
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
