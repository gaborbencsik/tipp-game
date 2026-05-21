import { sql, isNull, and, eq, or, exists } from 'drizzle-orm'
import { db } from '../db/client.js'
import { scoringConfigs, groups, groupMembers } from '../db/schema/index.js'

/**
 * Idempotens freeze: ráteszi a `frozen_at = now()`-t a globális default config-ra
 * és minden olyan csoport override config-ra, amelyhez a `userId` tartozik.
 * Csak a még nem zárolt sorokat érinti (`frozen_at IS NULL`).
 */
export async function freezeApplicableConfigs(userId: string): Promise<void> {
  const now = new Date()

  await db
    .update(scoringConfigs)
    .set({ frozenAt: now })
    .where(
      and(
        isNull(scoringConfigs.frozenAt),
        or(
          eq(scoringConfigs.isGlobalDefault, true),
          exists(
            db
              .select({ one: sql`1` })
              .from(groups)
              .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
              .where(
                and(
                  eq(groupMembers.userId, userId),
                  eq(groups.scoringConfigId, scoringConfigs.id),
                ),
              ),
          ),
        ),
      ),
    )
}
