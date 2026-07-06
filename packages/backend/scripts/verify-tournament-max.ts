/* eslint-disable no-console */
// Ad-hoc: DB → same `computeTypeMaxPoints` helper as the leaderboard service.
// Run:   DATABASE_URL=... npx tsx packages/backend/scripts/verify-tournament-max.ts
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { specialPredictionTypes, specialPredictions } from '../src/db/schema/index.js'
import { computeTypeMaxPoints } from '../src/services/tournament-max.service.js'

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: specialPredictionTypes.id,
      inputType: specialPredictionTypes.inputType,
      options: specialPredictionTypes.options,
      points: specialPredictionTypes.points,
      correctAnswer: specialPredictionTypes.correctAnswer,
    })
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
      isNotNull(specialPredictionTypes.correctAnswer),
      sql`trim(${specialPredictionTypes.correctAnswer}) <> ''`,
    ))

  let total = 0
  for (const r of rows) {
    const max = computeTypeMaxPoints(r)
    total += max
    console.log(`${r.inputType.padEnd(24)} id=${r.id}  max=${max}`)
  }
  console.log(`\nTOTAL tournamentMaxPoints = ${total}`)

  const perUser = await db
    .select({
      userId: specialPredictions.userId,
      pts: sql<number>`coalesce(sum(${specialPredictions.points}), 0)`,
    })
    .from(specialPredictions)
    .innerJoin(specialPredictionTypes, eq(specialPredictions.typeId, specialPredictionTypes.id))
    .where(and(
      eq(specialPredictionTypes.isGlobal, true),
    ))
    .groupBy(specialPredictions.userId)

  for (const u of perUser) {
    const pts = Number(u.pts)
    const rate = total > 0 ? Math.round((pts / total) * 100) : null
    console.log(`user ${u.userId}  specialPredictionPoints=${pts}  successRate=${rate}%`)
  }
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
