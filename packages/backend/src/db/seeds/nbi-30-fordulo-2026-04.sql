-- ============================================================
-- NB I 30. forduló (2026. április 17-19.)
-- Futtatható közvetlenül a prod DB-n
-- ============================================================

BEGIN;

INSERT INTO matches (id, home_team_id, away_team_id, venue_id, stage, group_name, match_number, scheduled_at, status)
VALUES
  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'UJP'),
    (SELECT id FROM teams WHERE short_code = 'NYIR'),
    NULL, 'group', NULL, NULL,
    '2026-04-17 20:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'ZTE'),
    (SELECT id FROM teams WHERE short_code = 'KBSC'),
    NULL, 'group', NULL, NULL,
    '2026-04-18 14:15:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'MTK'),
    (SELECT id FROM teams WHERE short_code = 'KISV'),
    NULL, 'group', NULL, NULL,
    '2026-04-18 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'DVTK'),
    (SELECT id FROM teams WHERE short_code = 'DVSC'),
    NULL, 'group', NULL, NULL,
    '2026-04-18 19:30:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'PAKS'),
    (SELECT id FROM teams WHERE short_code = 'PAFC'),
    NULL, 'group', NULL, NULL,
    '2026-04-19 14:15:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'ETO'),
    (SELECT id FROM teams WHERE short_code = 'FTC'),
    NULL, 'group', NULL, NULL,
    '2026-04-19 19:30:00+02', 'scheduled')
;

COMMIT;
