import { eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, auditLogs } from '../db/schema/index.js'
import type { AdminUser } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

function toApiUser(row: typeof users.$inferSelect): AdminUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    bannedAt: row.bannedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getUsers(): Promise<AdminUser[]> {
  const rows = await db
    .select()
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(users.createdAt)

  return rows.map(toApiUser)
}

export async function updateUserRole(
  userId: string,
  role: 'user' | 'admin',
  actorId: string,
): Promise<AdminUser> {
  if (userId === actorId) {
    throw new AppError(403, 'Cannot change your own role')
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!existing[0]) throw new AppError(404, 'User not found')

  const rows = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to update user role')

  await db.insert(auditLogs).values({
    actorId,
    action: 'role_change',
    entityType: 'user',
    entityId: userId,
    previousValue: { role: existing[0].role },
    newValue: { role },
  })

  return toApiUser(row)
}

export async function banUser(
  userId: string,
  ban: boolean,
  actorId: string,
): Promise<AdminUser> {
  if (userId === actorId) {
    throw new AppError(403, 'Cannot ban yourself')
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!existing[0]) throw new AppError(404, 'User not found')

  const bannedAt = ban ? new Date() : null

  const rows = await db
    .update(users)
    .set({ bannedAt, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to update user ban status')

  await db.insert(auditLogs).values({
    actorId,
    action: 'ban',
    entityType: 'user',
    entityId: userId,
    previousValue: { bannedAt: existing[0].bannedAt?.toISOString() ?? null },
    newValue: { bannedAt: bannedAt?.toISOString() ?? null },
  })

  return toApiUser(row)
}
