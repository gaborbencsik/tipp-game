import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  groupMembers,
  groupGlobalTypeSubscriptions,
  specialPredictions,
} from '../db/schema/index.js'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTx = typeof db | Tx

interface SourceTip {
  readonly userId: string
  readonly typeId: string
  readonly answer: string
}

async function pickRepresentativeTipsForUserAndTypes(
  exec: DbOrTx,
  userId: string,
  typeIds: readonly string[],
): Promise<SourceTip[]> {
  if (typeIds.length === 0) return []
  const rows = await exec
    .select({
      userId: specialPredictions.userId,
      typeId: specialPredictions.typeId,
      answer: specialPredictions.answer,
      groupId: specialPredictions.groupId,
    })
    .from(specialPredictions)
    .where(and(
      eq(specialPredictions.userId, userId),
      sql`${specialPredictions.typeId} IN (${sql.join(typeIds.map(id => sql`${id}::uuid`), sql`, `)})`,
    ))

  const byType = new Map<string, { tip: SourceTip; fromNonNullGroup: boolean }>()
  for (const r of rows) {
    const tip: SourceTip = { userId: r.userId, typeId: r.typeId, answer: r.answer }
    const fromNonNullGroup = r.groupId !== null
    const existing = byType.get(r.typeId)
    if (!existing || (!existing.fromNonNullGroup && fromNonNullGroup)) {
      byType.set(r.typeId, { tip, fromNonNullGroup })
    }
  }
  return Array.from(byType.values()).map(v => v.tip)
}

async function upsertTip(
  exec: DbOrTx,
  userId: string,
  typeId: string,
  groupId: string,
  answer: string,
): Promise<void> {
  await exec
    .insert(specialPredictions)
    .values({ userId, typeId, groupId, answer })
    .onConflictDoNothing({
      target: [specialPredictions.userId, specialPredictions.typeId, specialPredictions.groupId],
    })
}

export async function replicateUserTipsToGroup(
  userId: string,
  groupId: string,
  exec: DbOrTx = db,
): Promise<void> {
  const subs = await exec
    .select({ globalTypeId: groupGlobalTypeSubscriptions.globalTypeId })
    .from(groupGlobalTypeSubscriptions)
    .where(eq(groupGlobalTypeSubscriptions.groupId, groupId))

  const typeIds = subs.map(s => s.globalTypeId)
  if (typeIds.length === 0) return

  const tips = await pickRepresentativeTipsForUserAndTypes(exec, userId, typeIds)
  for (const tip of tips) {
    await upsertTip(exec, userId, tip.typeId, groupId, tip.answer)
  }
}

export async function replicateGroupSubscriptionToMembers(
  groupId: string,
  globalTypeId: string,
  exec: DbOrTx = db,
): Promise<void> {
  const members = await exec
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))

  for (const { userId } of members) {
    const tips = await pickRepresentativeTipsForUserAndTypes(exec, userId, [globalTypeId])
    const tip = tips[0]
    if (tip) await upsertTip(exec, userId, globalTypeId, groupId, tip.answer)
  }
}
