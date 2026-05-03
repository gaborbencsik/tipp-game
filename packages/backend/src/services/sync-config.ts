import type { SyncMode } from '../types/index.js'

export const VALID_SYNC_MODES: readonly SyncMode[] = ['off', 'final_only', 'adaptive', 'full_live']

let currentMode: SyncMode = parseSyncMode(process.env['FOOTBALL_SYNC_MODE'])

function parseSyncMode(value: string | undefined): SyncMode {
  if (value && (VALID_SYNC_MODES as readonly string[]).includes(value)) {
    return value as SyncMode
  }
  return 'off'
}

export function getSyncMode(): SyncMode {
  return currentMode
}

export function setSyncMode(mode: SyncMode): void {
  currentMode = mode
}
