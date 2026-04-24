-- ============================================================
-- NB I 31. forduló (2026. április 24–26.)
-- Futtatható közvetlenül a prod DB-n
-- ============================================================

BEGIN;

INSERT INTO matches (id, home_team_id, away_team_id, venue_id, stage, group_name, match_number, scheduled_at, status)
VALUES
  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KBSC'),
    (SELECT id FROM teams WHERE short_code = 'MTK'),
    NULL, 'group', NULL, NULL,
    '2026-04-24 20:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KISV'),
    (SELECT id FROM teams WHERE short_code = 'DVTK'),
    NULL, 'group', NULL, NULL,
    '2026-04-25 14:30:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'PAFC'),
    (SELECT id FROM teams WHERE short_code = 'UJP'),
    NULL, 'group', NULL, NULL,
    '2026-04-25 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'NYIR'),
    (SELECT id FROM teams WHERE short_code = 'ZTE'),
    NULL, 'group', NULL, NULL,
    '2026-04-25 19:30:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'FTC'),
    (SELECT id FROM teams WHERE short_code = 'PAKS'),
    NULL, 'group', NULL, NULL,
    '2026-04-26 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'DVSC'),
    (SELECT id FROM teams WHERE short_code = 'ETO'),
    NULL, 'group', NULL, NULL,
    '2026-04-26 19:30:00+02', 'scheduled')
;

COMMIT;
