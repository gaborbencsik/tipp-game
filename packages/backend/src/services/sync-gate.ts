import type { SyncMode } from '../types/index.js'

export interface GateDecision {
  readonly run: boolean
  readonly reason: string
}

const MINUTES = 60 * 1000

const INTERVALS: Readonly<Record<Exclude<SyncMode, 'off'>, number | { live: number; idle: number }>> = {
  final_only: 30 * MINUTES,
  adaptive: { live: 2 * MINUTES, idle: 15 * MINUTES },
  full_live: 1 * MINUTES,
}

export function shouldRunSync(
  mode: SyncMode,
  lastRunAt: Date | null,
  hasLiveMatch: boolean,
  now: Date,
): GateDecision {
  if (mode === 'off') {
    return { run: false, reason: 'sync disabled' }
  }

  const elapsed = lastRunAt ? now.getTime() - lastRunAt.getTime() : Infinity
  const config = INTERVALS[mode]

  const requiredInterval = typeof config === 'number'
    ? config
    : hasLiveMatch ? config.live : config.idle

  const requiredMinutes = requiredInterval / MINUTES

  if (elapsed >= requiredInterval) {
    return { run: true, reason: 'interval elapsed' }
  }

  return { run: false, reason: `interval not elapsed (need ${requiredMinutes}m)` }
}
