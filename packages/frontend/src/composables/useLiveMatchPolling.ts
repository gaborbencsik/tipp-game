import type { Match } from '../types/index.js'

/**
 * Returns true if at least one match in the list is currently in play.
 * Used to gate polling of live-only data (e.g. virtual points) so we
 * don't waste egress when nothing can change.
 */
export function hasAnyLiveMatch(matches: ReadonlyArray<Pick<Match, 'status'>>): boolean {
  return matches.some(m => m.status === 'live')
}
