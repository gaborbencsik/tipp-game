import { db } from '../db/client.js'
import { users } from '../db/schema/index.js'
import { eq } from 'drizzle-orm'
import type { AuthenticatedUser, DbUser } from '../types/index.js'

export async function upsertUser(user: AuthenticatedUser): Promise<DbUser> {
  // First attempt: upsert on supabase_id
  const bySupabaseId = await db
    .insert(users)
    .values({
      supabaseId: user.supabaseId,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.supabaseId,
      set: {
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        updatedAt: new Date(),
      },
    })
    .returning()
    .catch(async (err: unknown) => {
      const code = (err as { code?: string }).code
      if (code !== '23505') throw err
      // Duplicate email from a different supabase_id – update that row instead
      const rows = await db
        .update(users)
        .set({
          supabaseId: user.supabaseId,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
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
