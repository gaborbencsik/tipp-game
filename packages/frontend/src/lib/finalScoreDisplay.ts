import type { MatchResult } from '../types/index.js'

// BUG-011: knockout meccsnél a rendes játékidős állás mellett a hosszabbítás
// utáni végeredményt is megjelenítjük, tizenegyeseknél a büntetőpárbaj-jelzést.
// A rendes játékidős állás (`homeGoals/awayGoals`) mindig ott marad — csak
// +1 sor (pl. "hosszabbítás után 3 – 2" vagy "tizenegyesekkel") jelenik meg.
//
// A `finalScoreDisplay` egy strukturált tokent ad vissza (i18n-mentes), a
// tényleges címkét a `finalScoreExtraLabel` állítja elő a vue-i18n `t`
// függvényével — így új nyelv hozzáadásához csak a locale-fájlokat kell bővíteni.

export type FinalScoreExtraKind =
  | 'extra_time_with_score'   // ET + van ET score → "hosszabbítás után 3 – 2"
  | 'extra_time'              // ET, de ET score nincs → "hosszabbítás után"
  | 'penalties'               // PK → "tizenegyesekkel"

export interface FinalScoreExtra {
  readonly kind: FinalScoreExtraKind
  readonly extraTimeHomeGoals: number | null
  readonly extraTimeAwayGoals: number | null
}

export interface FinalScoreDisplay {
  readonly regular: string             // "1 – 1" – rendes játékidős állás
  readonly extra: FinalScoreExtra | null
}

function extraKind(result: MatchResult): FinalScoreExtra | null {
  const outcome = result.outcomeAfterDraw
  if (outcome === 'extra_time_home' || outcome === 'extra_time_away') {
    if (result.extraTimeHomeGoals != null && result.extraTimeAwayGoals != null) {
      return {
        kind: 'extra_time_with_score',
        extraTimeHomeGoals: result.extraTimeHomeGoals,
        extraTimeAwayGoals: result.extraTimeAwayGoals,
      }
    }
    return { kind: 'extra_time', extraTimeHomeGoals: null, extraTimeAwayGoals: null }
  }
  if (outcome === 'penalties_home' || outcome === 'penalties_away') {
    return { kind: 'penalties', extraTimeHomeGoals: null, extraTimeAwayGoals: null }
  }
  return null
}

export function finalScoreDisplay(result: MatchResult | null | undefined): FinalScoreDisplay | null {
  if (!result) return null
  return {
    regular: `${result.homeGoals} – ${result.awayGoals}`,
    extra: extraKind(result),
  }
}

// A vue-i18n `t` szignatúrája szigorúbb (`Record<string, unknown> | number`), de
// itt csak string/number értékeket adunk át; a `TranslateFn` egy szűkített
// alias, ami elfogadja a mi call-site-jainkat, és nem függ a vue-i18n típusától.
type TranslateFn = (key: string, params?: Readonly<Record<string, string | number>>) => string

export function finalScoreExtraLabel(
  extra: FinalScoreExtra | null,
  t: TranslateFn,
): string | null {
  if (!extra) return null
  if (extra.kind === 'extra_time_with_score') {
    return t('matches.finalScoreExtraTimeWithScore', {
      home: extra.extraTimeHomeGoals ?? 0,
      away: extra.extraTimeAwayGoals ?? 0,
    })
  }
  if (extra.kind === 'extra_time') return t('matches.finalScoreExtraTime')
  return t('matches.finalScorePenalties')
}
