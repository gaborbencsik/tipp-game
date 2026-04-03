-- ============================================================
-- NB I 28. forduló (2026. április 4-5.)
-- Futtatható közvetlenül a prod DB-n
-- ============================================================

BEGIN;

INSERT INTO teams (id, name, short_code, flag_url, "group") VALUES
  (gen_random_uuid(), 'ZTE FC',                        'ZTE',  NULL, NULL),
  (gen_random_uuid(), 'Kisvárda Master Good',           'KISV', NULL, NULL),
  (gen_random_uuid(), 'Paksi FC',                      'PAKS', NULL, NULL),
  (gen_random_uuid(), 'Kolorcity Kazincbarcika SC',    'KBSC', NULL, NULL),
  (gen_random_uuid(), 'Újpest FC',                     'UJP',  NULL, NULL),
  (gen_random_uuid(), 'MTK Budapest',                  'MTK',  NULL, NULL),
  (gen_random_uuid(), 'Diósgyőri VTK',                 'DVTK', NULL, NULL),
  (gen_random_uuid(), 'Puskás Akadémia FC',            'PAFC', NULL, NULL),
  (gen_random_uuid(), 'Debreceni VSC',                 'DVSC', NULL, NULL),
  (gen_random_uuid(), 'Ferencvárosi TC',               'FTC',  NULL, NULL),
  (gen_random_uuid(), 'Győri ETO FC',                  'ETO',  NULL, NULL),
  (gen_random_uuid(), 'Nyíregyháza Spartacus FC',      'NYIR', NULL, NULL)
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO matches (id, home_team_id, away_team_id, venue_id, stage, group_name, match_number, scheduled_at, status)
VALUES
  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'ZTE'),
    (SELECT id FROM teams WHERE short_code = 'KISV'),
    NULL, 'group', NULL, NULL,
    '2026-04-04 14:30:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'PAKS'),
    (SELECT id FROM teams WHERE short_code = 'KBSC'),
    NULL, 'group', NULL, NULL,
    '2026-04-04 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'UJP'),
    (SELECT id FROM teams WHERE short_code = 'MTK'),
    NULL, 'group', NULL, NULL,
    '2026-04-04 19:30:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'DVTK'),
    (SELECT id FROM teams WHERE short_code = 'PAFC'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 14:30:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'DVSC'),
    (SELECT id FROM teams WHERE short_code = 'FTC'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'ETO'),
    (SELECT id FROM teams WHERE short_code = 'NYIR'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 19:30:00+02', 'scheduled')
;

COMMIT;
