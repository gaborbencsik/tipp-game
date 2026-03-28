import { db } from '../db/client.js'
import { users } from '../db/schema/index.js'
import type { AuthenticatedUser, DbUser } from '../types/index.js'

export async function upsertUser(user: AuthenticatedUser): Promise<DbUser> {
  const rows = await db
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
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        updatedAt: new Date(),
      },
    })
    .returning()

  const row = rows[0]
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
