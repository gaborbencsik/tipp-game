-- ============================================================
-- NB I 29. forduló (2026. április 10-13.)
-- Futtatható közvetlenül a prod DB-n
-- ============================================================

BEGIN;

INSERT INTO matches (id, home_team_id, away_team_id, venue_id, stage, group_name, match_number, scheduled_at, status)
VALUES
  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'PAFC'),
    (SELECT id FROM teams WHERE short_code = 'ETO'),
    NULL, 'group', NULL, NULL,
    '2026-04-10 17:45:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'FTC'),
    (SELECT id FROM teams WHERE short_code = 'DVTK'),
    NULL, 'group', NULL, NULL,
    '2026-04-10 20:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KBSC'),
    (SELECT id FROM teams WHERE short_code = 'UJP'),
    NULL, 'group', NULL, NULL,
    '2026-04-11 15:15:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'MTK'),
    (SELECT id FROM teams WHERE short_code = 'ZTE'),
    NULL, 'group', NULL, NULL,
    '2026-04-11 17:45:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'NYIR'),
    (SELECT id FROM teams WHERE short_code = 'PAKS'),
    NULL, 'group', NULL, NULL,
    '2026-04-11 20:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KISV'),
    (SELECT id FROM teams WHERE short_code = 'DVSC'),
    NULL, 'group', NULL, NULL,
    '2026-04-13 20:00:00+02', 'scheduled')
;

COMMIT;
