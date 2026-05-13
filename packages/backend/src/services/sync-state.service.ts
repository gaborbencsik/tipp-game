import { eq, and, sql, lt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { syncState, matches } from '../db/schema/index.js'
import type { SyncMode } from '../types/index.js'

export interface SyncStateRow {
  readonly mode: SyncMode
  readonly lastSuccessfulSyncAt: Date | null
  readonly apiCallsToday: number
  readonly apiCallsDate: string | null
  readonly syncInProgress: boolean
  readonly polymarketSyncEnabled: boolean
}

const DEFAULT_STATE: SyncStateRow = {
  mode: 'off',
  lastSuccessfulSyncAt: null,
  apiCallsToday: 0,
  apiCallsDate: null,
  syncInProgress: false,
  polymarketSyncEnabled: false,
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
