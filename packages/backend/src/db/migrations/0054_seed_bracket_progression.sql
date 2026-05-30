-- US-946: Bracket-progression global type — single record covering the full WC2026 knockout bracket
-- (32 matches: 16 Last 32 + 8 Last 16 + 4 QF + 2 SF + final + bronze).
--
-- Slot codes:
--   W_<X>1   → group X winner (US-945 groups[X][0])
--   RU_<X>1  → group X runner-up (US-945 groups[X][1])
--   3rd_<5L> → 3rd-placed team mapped to this slot via FIFA Annex C (5-letter combo of candidate groups)
--   <matchId>       → winner of the upstream match
--   <matchId_loser> → loser of the upstream match (only used by bronze)
--
-- Bracket pairings follow the official 2026 FIFA WC schedule (matches 73–104) and Annex C of the
-- competition regulations.

DO $$
DECLARE
  expected_id uuid := '44444444-aaaa-bbbb-cccc-000000000946';
  template jsonb := '[
    {"id":"l32_m1","round":"last_32","slotA":"W_E1","slotB":"3rd_ABCDF","winnerTo":"l16_m1"},
    {"id":"l32_m2","round":"last_32","slotA":"W_I1","slotB":"3rd_CDFGH","winnerTo":"l16_m1"},
    {"id":"l32_m3","round":"last_32","slotA":"RU_A1","slotB":"RU_B1","winnerTo":"l16_m2"},
    {"id":"l32_m4","round":"last_32","slotA":"W_F1","slotB":"RU_C1","winnerTo":"l16_m2"},
    {"id":"l32_m5","round":"last_32","slotA":"W_C1","slotB":"RU_F1","winnerTo":"l16_m3"},
    {"id":"l32_m6","round":"last_32","slotA":"RU_E1","slotB":"RU_I1","winnerTo":"l16_m3"},
    {"id":"l32_m7","round":"last_32","slotA":"W_A1","slotB":"3rd_CEFHI","winnerTo":"l16_m4"},
    {"id":"l32_m8","round":"last_32","slotA":"W_L1","slotB":"3rd_EHIJK","winnerTo":"l16_m4"},
    {"id":"l32_m9","round":"last_32","slotA":"RU_K1","slotB":"RU_L1","winnerTo":"l16_m5"},
    {"id":"l32_m10","round":"last_32","slotA":"W_H1","slotB":"RU_J1","winnerTo":"l16_m5"},
    {"id":"l32_m11","round":"last_32","slotA":"W_D1","slotB":"3rd_BEFIJ","winnerTo":"l16_m6"},
    {"id":"l32_m12","round":"last_32","slotA":"W_G1","slotB":"3rd_AEHIJ","winnerTo":"l16_m6"},
    {"id":"l32_m13","round":"last_32","slotA":"W_J1","slotB":"RU_H1","winnerTo":"l16_m7"},
    {"id":"l32_m14","round":"last_32","slotA":"RU_D1","slotB":"RU_G1","winnerTo":"l16_m7"},
    {"id":"l32_m15","round":"last_32","slotA":"W_B1","slotB":"3rd_EFGIJ","winnerTo":"l16_m8"},
    {"id":"l32_m16","round":"last_32","slotA":"W_K1","slotB":"3rd_DEIJL","winnerTo":"l16_m8"},
    {"id":"l16_m1","round":"last_16","slotA":"<l32_m1>","slotB":"<l32_m2>","winnerTo":"qf_m1"},
    {"id":"l16_m2","round":"last_16","slotA":"<l32_m3>","slotB":"<l32_m4>","winnerTo":"qf_m1"},
    {"id":"l16_m3","round":"last_16","slotA":"<l32_m5>","slotB":"<l32_m6>","winnerTo":"qf_m3"},
    {"id":"l16_m4","round":"last_16","slotA":"<l32_m7>","slotB":"<l32_m8>","winnerTo":"qf_m3"},
    {"id":"l16_m5","round":"last_16","slotA":"<l32_m9>","slotB":"<l32_m10>","winnerTo":"qf_m2"},
    {"id":"l16_m6","round":"last_16","slotA":"<l32_m11>","slotB":"<l32_m12>","winnerTo":"qf_m2"},
    {"id":"l16_m7","round":"last_16","slotA":"<l32_m13>","slotB":"<l32_m14>","winnerTo":"qf_m4"},
    {"id":"l16_m8","round":"last_16","slotA":"<l32_m15>","slotB":"<l32_m16>","winnerTo":"qf_m4"},
    {"id":"qf_m1","round":"qf","slotA":"<l16_m1>","slotB":"<l16_m2>","winnerTo":"sf_m1"},
    {"id":"qf_m2","round":"qf","slotA":"<l16_m5>","slotB":"<l16_m6>","winnerTo":"sf_m1"},
    {"id":"qf_m3","round":"qf","slotA":"<l16_m3>","slotB":"<l16_m4>","winnerTo":"sf_m2"},
    {"id":"qf_m4","round":"qf","slotA":"<l16_m7>","slotB":"<l16_m8>","winnerTo":"sf_m2"},
    {"id":"sf_m1","round":"sf","slotA":"<qf_m1>","slotB":"<qf_m2>","winnerTo":"final"},
    {"id":"sf_m2","round":"sf","slotA":"<qf_m3>","slotB":"<qf_m4>","winnerTo":"final"},
    {"id":"final","round":"final","slotA":"<sf_m1>","slotB":"<sf_m2>","winnerTo":null},
    {"id":"bronze","round":"bronze","slotA":"<sf_m1_loser>","slotB":"<sf_m2_loser>","winnerTo":null}
  ]'::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM "special_prediction_types" WHERE "id" = expected_id) THEN
    RETURN;
  END IF;

  INSERT INTO "special_prediction_types" (
    "id", "group_id", "name", "description", "input_type",
    "deadline", "points", "is_global", "is_active", "options"
  ) VALUES (
    expected_id,
    NULL,
    'Bracket-progresszió',
    'Tippeld meg minden mérkőzés győztesét a torna kieséses ágán.',
    'bracket_progression',
    '2026-06-11 02:00:00+00',
    0,
    true,
    true,
    jsonb_build_object('bracketTemplate', jsonb_build_object('matches', template))
  );
END $$;
