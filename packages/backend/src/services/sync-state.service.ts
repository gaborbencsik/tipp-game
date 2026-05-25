import { eq, and, sql, lt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { syncState, matches } from '../db/schema/index.js'
import type { SyncMode, RecalcResult, RecalcStatus } from '../types/index.js'

export interface SyncStateRow {
  readonly mode: SyncMode
  readonly lastSuccessfulSyncAt: Date | null
  readonly apiCallsToday: number
  readonly apiCallsDate: string | null
  readonly syncInProgress: boolean
  readonly polymarketSyncEnabled: boolean
  readonly lastPolymarketSyncAt: Date | null
  readonly playerSyncEnabled: boolean
  readonly lastPlayerSyncAt: Date | null
  readonly transfermarktSyncEnabled: boolean
  readonly lastTransfermarktSyncAt: Date | null
  readonly rawStatsSyncEnabled: boolean
  readonly lastRawStatsSyncAt: Date | null
  readonly rawStatsSkipFresh: boolean
  readonly recalcInProgress: boolean
  readonly lastRecalcResult: RecalcResult | null
  readonly insightsSyncEnabled: boolean
  readonly lastInsightsSyncAt: Date | null
}

const DEFAULT_STATE: SyncStateRow = {
  mode: 'off',
  lastSuccessfulSyncAt: null,
  apiCallsToday: 0,
  apiCallsDate: null,
  syncInProgress: false,
  polymarketSyncEnabled: false,
  lastPolymarketSyncAt: null,
  playerSyncEnabled: false,
  lastPlayerSyncAt: null,
  transfermarktSyncEnabled: false,
  lastTransfermarktSyncAt: null,
  rawStatsSyncEnabled: false,
  lastRawStatsSyncAt: null,
  rawStatsSkipFresh: false,
  recalcInProgress: false,
  lastRecalcResult: null,
  insightsSyncEnabled: false,
  lastInsightsSyncAt: null,
}

export async function getSyncState(): Promise<SyncStateRow> {
  const [row] = await db.select().from(syncState).limit(1)
  if (!row) return DEFAULT_STATE
  return {
    mode: row.mode as SyncMode,
    lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
    apiCallsToday: row.apiCallsToday,
    apiCallsDate: row.apiCallsDate,
    syncInProgress: row.syncInProgress,
    polymarketSyncEnabled: row.polymarketSyncEnabled,
    lastPolymarketSyncAt: row.lastPolymarketSyncAt,
    playerSyncEnabled: row.playerSyncEnabled,
    lastPlayerSyncAt: row.lastPlayerSyncAt,
    transfermarktSyncEnabled: row.transfermarktSyncEnabled,
    lastTransfermarktSyncAt: row.lastTransfermarktSyncAt,
    rawStatsSyncEnabled: row.rawStatsSyncEnabled,
    lastRawStatsSyncAt: row.lastRawStatsSyncAt,
    rawStatsSkipFresh: row.rawStatsSkipFresh,
    recalcInProgress: row.recalcInProgress,
    lastRecalcResult: (row.lastRecalcResult as RecalcResult | null) ?? null,
    insightsSyncEnabled: row.insightsSyncEnabled,
    lastInsightsSyncAt: row.lastInsightsSyncAt,
  }
}

export async function setSyncMode(mode: SyncMode): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (existing) {
    await db.update(syncState)
      .set({ mode, updatedAt: sql`now()` })
      .where(eq(syncState.id, existing.id))
  } else {
    await db.insert(syncState).values({
      id: crypto.randomUUID(),
      mode,
    })
  }
}

export async function markSyncStarted(): Promise<boolean> {
  const staleThreshold = sql`now() - interval '10 minutes'`
  const rows = await db.update(syncState)
    .set({ syncInProgress: true, updatedAt: sql`now()` })
    .where(
      and(
        eq(syncState.syncInProgress, false),
      )
    )
    .returning({ id: syncState.id })

  if (rows.length > 0) return true

  // Check for stale lock
  const staleRows = await db.update(syncState)
    .set({ syncInProgress: true, updatedAt: sql`now()` })
    .where(
      and(
        eq(syncState.syncInProgress, true),
        lt(syncState.updatedAt, sql`now() - interval '10 minutes'`),
      )
    )
    .returning({ id: syncState.id })

  return staleRows.length > 0
}

export async function markSyncFinished(success: boolean): Promise<void> {
  const setFields: Record<string, unknown> = {
    syncInProgress: false,
    updatedAt: sql`now()`,
  }
  if (success) {
    setFields.lastSuccessfulSyncAt = sql`now()`
  }
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (!existing) return
  await db.update(syncState).set(setFields).where(eq(syncState.id, existing.id))
}

export async function incrementApiCalls(count: number): Promise<void> {
  const [row] = await db.select({ id: syncState.id, apiCallsDate: syncState.apiCallsDate }).from(syncState).limit(1)
  if (!row) return

  const today = new Date().toISOString().slice(0, 10)
  if (row.apiCallsDate !== today) {
    await db.update(syncState)
      .set({ apiCallsToday: count, apiCallsDate: today, updatedAt: sql`now()` })
      .where(eq(syncState.id, row.id))
  } else {
    await db.update(syncState)
      .set({ apiCallsToday: sql`${syncState.apiCallsToday} + ${count}`, updatedAt: sql`now()` })
      .where(eq(syncState.id, row.id))
  }
}

export async function hasLiveMatch(): Promise<boolean> {
  const [row] = await db.select({ id: matches.id })
    .from(matches)
    .where(eq(matches.status, 'live'))
    .limit(1)
  return row !== undefined
}

export async function setPolymarketSyncEnabled(enabled: boolean): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (existing) {
    await db.update(syncState)
      .set({ polymarketSyncEnabled: enabled, updatedAt: sql`now()` })
      .where(eq(syncState.id, existing.id))
  } else {
    await db.insert(syncState).values({
      id: crypto.randomUUID(),
      polymarketSyncEnabled: enabled,
    })
  }
}

export async function markPolymarketSyncFinished(): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (!existing) return
  await db.update(syncState)
    .set({ lastPolymarketSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(syncState.id, existing.id))
}

export async function setPlayerSyncEnabled(enabled: boolean): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (existing) {
    await db.update(syncState)
      .set({ playerSyncEnabled: enabled, updatedAt: sql`now()` })
      .where(eq(syncState.id, existing.id))
  } else {
    await db.insert(syncState).values({
      id: crypto.randomUUID(),
      playerSyncEnabled: enabled,
    })
  }
}

export async function markPlayerSyncFinished(): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (!existing) return
  await db.update(syncState)
    .set({ lastPlayerSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(syncState.id, existing.id))
}

export async function setTransfermarktSyncEnabled(enabled: boolean): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (existing) {
    await db.update(syncState)
      .set({ transfermarktSyncEnabled: enabled, updatedAt: sql`now()` })
      .where(eq(syncState.id, existing.id))
  } else {
    await db.insert(syncState).values({
      id: crypto.randomUUID(),
      transfermarktSyncEnabled: enabled,
    })
  }
}

export async function markTransfermarktSyncFinished(): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (!existing) return
  await db.update(syncState)
    .set({ lastTransfermarktSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(syncState.id, existing.id))
}

export async function setRawStatsSyncEnabled(enabled: boolean): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (existing) {
    await db.update(syncState)
      .set({ rawStatsSyncEnabled: enabled, updatedAt: sql`now()` })
      .where(eq(syncState.id, existing.id))
  } else {
    await db.insert(syncState).values({
      id: crypto.randomUUID(),
      rawStatsSyncEnabled: enabled,
    })
  }
}

export async function setRawStatsSkipFresh(skipFresh: boolean): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (existing) {
    await db.update(syncState)
      .set({ rawStatsSkipFresh: skipFresh, updatedAt: sql`now()` })
      .where(eq(syncState.id, existing.id))
  } else {
    await db.insert(syncState).values({
      id: crypto.randomUUID(),
      rawStatsSkipFresh: skipFresh,
    })
  }
}

export async function markRawStatsSyncFinished(): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (!existing) return
  await db.update(syncState)
    .set({ lastRawStatsSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(syncState.id, existing.id))
}

export async function setInsightsSyncEnabled(enabled: boolean): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (existing) {
    await db.update(syncState)
      .set({ insightsSyncEnabled: enabled, updatedAt: sql`now()` })
      .where(eq(syncState.id, existing.id))
  } else {
    await db.insert(syncState).values({
      id: crypto.randomUUID(),
      insightsSyncEnabled: enabled,
    })
  }
}

export async function markInsightsSyncFinished(): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (!existing) return
  await db.update(syncState)
    .set({ lastInsightsSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(syncState.id, existing.id))
}

export async function markRecalcStarted(): Promise<boolean> {
  const rows = await db.update(syncState)
    .set({ recalcInProgress: true, updatedAt: sql`now()` })
    .where(
      and(
        eq(syncState.recalcInProgress, false),
        eq(syncState.syncInProgress, false),
      )
    )
    .returning({ id: syncState.id })

  return rows.length > 0
}

export async function markRecalcFinished(result: RecalcResult): Promise<void> {
  const [existing] = await db.select({ id: syncState.id }).from(syncState).limit(1)
  if (!existing) return
  await db.update(syncState)
    .set({
      recalcInProgress: false,
      lastRecalcResult: result,
      updatedAt: sql`now()`,
    })
    .where(eq(syncState.id, existing.id))
}

export async function getRecalcStatus(): Promise<RecalcStatus> {
  const [row] = await db
    .select({
      recalcInProgress: syncState.recalcInProgress,
      lastRecalcResult: syncState.lastRecalcResult,
    })
    .from(syncState)
    .limit(1)

  if (!row) return { status: 'idle', lastResult: null }

  return {
    status: row.recalcInProgress ? 'running' : 'idle',
    lastResult: (row.lastRecalcResult as RecalcResult | null) ?? null,
  }
}
