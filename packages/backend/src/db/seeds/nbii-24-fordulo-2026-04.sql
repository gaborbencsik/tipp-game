-- ============================================================
-- NB II 24. forduló (2026. április 5.)
-- Futtatható közvetlenül a prod DB-n
-- ============================================================

BEGIN;

INSERT INTO teams (id, name, short_code, flag_url, "group") VALUES
  (gen_random_uuid(), 'Mezőkövesd Zsóry FC',              'MZFC', NULL, NULL),
  (gen_random_uuid(), 'Videoton FC Fehérvár',             'VIDI', NULL, NULL),
  (gen_random_uuid(), 'Karcagi SC',                       'KRC',  NULL, NULL),
  (gen_random_uuid(), 'FC Ajka',                          'AJKA', NULL, NULL),
  (gen_random_uuid(), 'HR-Rent Kozármisleny',             'KOZ',  NULL, NULL),
  (gen_random_uuid(), 'Budafoki MTE',                     'BMTE', NULL, NULL),
  (gen_random_uuid(), 'Szeged-Csanád Grosics Akadémia',  'SCGA', NULL, NULL),
  (gen_random_uuid(), 'Vasas FC',                         'VAS',  NULL, NULL),
  (gen_random_uuid(), 'Tiszakécskei LC',                  'TKLC', NULL, NULL),
  (gen_random_uuid(), 'Budapest Honvéd FC',               'BHFC', NULL, NULL),
  (gen_random_uuid(), 'Kecskeméti TE',                    'KTE',  NULL, NULL),
  (gen_random_uuid(), 'Szentlőrinc',                      'SZLR', NULL, NULL),
  (gen_random_uuid(), 'Soroksár SC',                      'SOR',  NULL, NULL),
  (gen_random_uuid(), 'BVSC-Zugló',                       'BVSC', NULL, NULL),
  (gen_random_uuid(), 'Békéscsaba 1912 Előre',            'BCSE', NULL, NULL),
  (gen_random_uuid(), 'Aqvital FC Csákvár',               'AQVT', NULL, NULL)
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO matches (id, home_team_id, away_team_id, venue_id, stage, group_name, match_number, scheduled_at, status)
VALUES
  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'MZFC'),
    (SELECT id FROM teams WHERE short_code = 'VIDI'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 16:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KRC'),
    (SELECT id FROM teams WHERE short_code = 'AJKA'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 16:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KOZ'),
    (SELECT id FROM teams WHERE short_code = 'BMTE'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'SCGA'),
    (SELECT id FROM teams WHERE short_code = 'VAS'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'TKLC'),
    (SELECT id FROM teams WHERE short_code = 'BHFC'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KTE'),
    (SELECT id FROM teams WHERE short_code = 'SZLR'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'SOR'),
    (SELECT id FROM teams WHERE short_code = 'BVSC'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 19:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'BCSE'),
    (SELECT id FROM teams WHERE short_code = 'AQVT'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 19:00:00+02', 'scheduled')
;

COMMIT;
