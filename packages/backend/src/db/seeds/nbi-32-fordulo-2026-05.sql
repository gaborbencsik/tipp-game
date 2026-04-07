-- ============================================================
-- NB I 32. forduló (2026. május 2.)
-- Futtatható közvetlenül a prod DB-n
-- ============================================================

BEGIN;

INSERT INTO matches (id, home_team_id, away_team_id, venue_id, stage, group_name, match_number, scheduled_at, status)
VALUES
  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KBSC'),
    (SELECT id FROM teams WHERE short_code = 'KISV'),
    NULL, 'group', NULL, NULL,
    '2026-05-02 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'MTK'),
    (SELECT id FROM teams WHERE short_code = 'NYIR'),
    NULL, 'group', NULL, NULL,
    '2026-05-02 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'ZTE'),
    (SELECT id FROM teams WHERE short_code = 'PAFC'),
    NULL, 'group', NULL, NULL,
    '2026-05-02 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'UJP'),
    (SELECT id FROM teams WHERE short_code = 'FTC'),
    NULL, 'group', NULL, NULL,
    '2026-05-02 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'PAKS'),
    (SELECT id FROM teams WHERE short_code = 'DVSC'),
    NULL, 'group', NULL, NULL,
    '2026-05-02 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'ETO'),
    (SELECT id FROM teams WHERE short_code = 'DVTK'),
    NULL, 'group', NULL, NULL,
    '2026-05-02 17:00:00+02', 'scheduled')
;

COMMIT;
