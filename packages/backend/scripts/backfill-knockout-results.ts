/**
 * BUG-011 backfill: re-syncs every configured league in FULL mode so that
 * finished knockout matches get their `match_results` rewritten under the
 * new semantics — `home_goals/away_goals` = 90-minute score, new
 * `extra_time_*` columns filled in, `outcome_after_draw` populated for ET
 * AND PK. Points are recalculated inside `upsertResults`.
 *
 * Usage (from packages/backend):
 *   API_FOOTBALL_KEY=... \
 *   FOOTBALL_API_WC_LEAGUE_ID=... FOOTBALL_INTERNAL_WC_LEAGUE_ID=... \
 *   tsx scripts/backfill-knockout-results.ts
 */

import { runAllLeagues } from '../src/services/sync-runner.js'

async function main(): Promise<void> {
  const results = await runAllLeagues('full')
  for (const r of results) {
    console.log(JSON.stringify(r, null, 2))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
