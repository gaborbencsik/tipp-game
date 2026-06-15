/**
 * Resolves the display name for a player.
 *
 * Rule: keep the full `name` when it is short enough to read comfortably
 * (3 or fewer whitespace-separated words). Use `shortName` only when the
 * full name is longer than that AND a non-null short name is available.
 * Falls back to `name` if no short name is available.
 *
 * Example:
 *   - "Agustín Giay" (2 words)            → "Agustín Giay"
 *   - "Alexis Mac Allister" (3 words)     → "Alexis Mac Allister"
 *   - "Damián E. Martínez Romero" (4)     → shortName "E. Martínez"
 *   - "Vinícius José Paixão de O. Jr" (6) → shortName "Vinícius Júnior"
 */
const KEEP_NAME_MAX_WORDS = 3

export interface PlayerNameInput {
  readonly name: string
  readonly shortName: string | null
}

export function resolvePlayerDisplayName(player: PlayerNameInput): string {
  const trimmed = player.name.trim()
  if (trimmed.length === 0) {
    return player.shortName ?? player.name
  }

  const wordCount = trimmed.split(/\s+/).length
  if (wordCount <= KEEP_NAME_MAX_WORDS) {
    return player.name
  }

  return player.shortName ?? player.name
}
