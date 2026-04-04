import { db } from '../db/client.js'
import { users } from '../db/schema/index.js'
import { and, eq, isNull } from 'drizzle-orm'
import type { AuthenticatedUser, DbUser } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export async function upsertUser(user: AuthenticatedUser): Promise<DbUser> {
  // First attempt: upsert on supabase_id
  const bySupabaseId = await db
    .insert(users)
    .values({
      supabaseId: user.supabaseId,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    })
    .onConflictDoUpdate({
      target: users.supabaseId,
      set: {
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        updatedAt: new Date(),
      },
    })
    .returning()
    .catch(async (err: unknown) => {
      const code =
        (err as { code?: string }).code ??
        ((err as { cause?: { code?: string } }).cause?.code)
      if (code !== '23505') throw err
      // Duplicate email from a different supabase_id – update that row instead
      const rows = await db
        .update(users)
        .set({
          supabaseId: user.supabaseId,
          avatarUrl: user.avatarUrl,
          role: user.role,
          updatedAt: new Date(),
        })
        .where(eq(users.email, user.email))
        .returning()
      return rows
    })

  const row = bySupabaseId[0]
  if (!row) throw new Error('upsertUser: no row returned')

  return {
    id: row.id,
    supabaseId: row.supabaseId,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? null,
    role: row.role,
  }
}

export async function updateProfile(userId: string, displayName: string): Promise<DbUser> {
  const rows = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(404, 'User not found')

  return {
    id: row.id,
    supabaseId: row.supabaseId,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? null,
    role: row.role,
  }
}
