import { computed, ref, onUnmounted, getCurrentInstance } from 'vue'
import type { ComputedRef } from 'vue'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'

// Mirrors `packages/backend/src/jobs/daily-match-review.job.ts` window:
// 17:00 Budapest (today) → 07:00 Budapest (tomorrow). DST-aware via Intl.
const TIMEZONE = 'Europe/Budapest'
const WINDOW_START_HOUR_BUDAPEST = 17
const WINDOW_END_HOUR_BUDAPEST = 7

export interface UsePendingTodayCountReturn {
  readonly pendingTodayCount: ComputedRef<number>
}

interface BudapestParts {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
}

function getBudapestParts(date: Date): BudapestParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (t: string): string => parts.find(p => p.type === t)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    // `en-CA` returns hour 24 at midnight; normalize to 0.
    hour: Number(get('hour')) % 24,
  }
}

function budapestUtcOffsetHours(dateKey: string): number {
  // Anchor at noon UTC on the given Budapest day; the local hour minus 12 is the offset.
  const noonAtUtc = new Date(`${dateKey}T12:00:00Z`)
  const hourAtTz = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(noonAtUtc),
  )
  return hourAtTz - 12
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function budapestHourToUtc(dateKey: string, hour: number): Date {
  const offset = budapestUtcOffsetHours(dateKey)
  const utc = new Date(`${dateKey}T00:00:00Z`)
  utc.setUTCHours(hour - offset)
  return utc
}

interface WindowBoundsUtc {
  readonly startUtc: Date
  readonly endUtc: Date
}

export function computeWindowBoundsUtc(now: Date): WindowBoundsUtc {
  const bp = getBudapestParts(now)
  const todayKey = `${bp.year}-${pad(bp.month)}-${pad(bp.day)}`

  if (bp.hour < WINDOW_END_HOUR_BUDAPEST) {
    // We are in the tail of yesterday's evening window: yesterday 17:00 → today 07:00.
    const yesterdayKey = addDaysToDateKey(todayKey, -1)
    return {
      startUtc: budapestHourToUtc(yesterdayKey, WINDOW_START_HOUR_BUDAPEST),
      endUtc: budapestHourToUtc(todayKey, WINDOW_END_HOUR_BUDAPEST),
    }
  }
  // Daytime or evening: window is today 17:00 → tomorrow 07:00.
  const tomorrowKey = addDaysToDateKey(todayKey, 1)
  return {
    startUtc: budapestHourToUtc(todayKey, WINDOW_START_HOUR_BUDAPEST),
    endUtc: budapestHourToUtc(tomorrowKey, WINDOW_END_HOUR_BUDAPEST),
  }
}

export function usePendingTodayCount(): UsePendingTodayCountReturn {
  const matchesStore = useMatchesStore()
  const predictionsStore = usePredictionsStore()
  const now = ref(new Date())

  const intervalId: ReturnType<typeof setInterval> = setInterval(() => {
    now.value = new Date()
  }, 60_000)

  if (getCurrentInstance()) {
    onUnmounted(() => {
      clearInterval(intervalId)
    })
  }

  const pendingTodayCount = computed<number>(() => {
    const { startUtc, endUtc } = computeWindowBoundsUtc(now.value)
    const startMs = startUtc.getTime()
    const endMs = endUtc.getTime()
    const nowMs = now.value.getTime()

    return matchesStore.matches.filter(m => {
      if (m.status !== 'scheduled') return false
      const scheduledMs = new Date(m.scheduledAt).getTime()
      if (scheduledMs < startMs || scheduledMs >= endMs) return false
      if (scheduledMs <= nowMs) return false
      return !predictionsStore.predictionByMatchId(m.id)
    }).length
  })

  return { pendingTodayCount }
}
