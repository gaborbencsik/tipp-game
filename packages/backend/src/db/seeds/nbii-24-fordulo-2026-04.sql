-- ============================================================
-- NB II 24. forduló (2026. április 5.)
-- Futtatható közvetlenül a prod DB-n
-- Megjegyzés: KTE (Kecskeméti TE) itt NB II-ként szerepel a képen,
--             de ellenőrizd hogy nem ütközik-e NB I-es KTE rekorddal.
-- ============================================================

BEGIN;

INSERT INTO teams (id, name, short_code, flag_url, "group") VALUES
  (gen_random_uuid(), 'Mezőkövesd Zsóry FC',              'MZS', NULL, NULL),
  (gen_random_uuid(), 'Videoton FC Fehérvár',             'VID', NULL, NULL),
  (gen_random_uuid(), 'Karcagi SC',                       'KRC', NULL, NULL),
  (gen_random_uuid(), 'FC Ajka',                          'AJK', NULL, NULL),
  (gen_random_uuid(), 'HR-Rent Kozármisleny',             'KOZ', NULL, NULL),
  (gen_random_uuid(), 'Budafoki MTE',                     'BMT', NULL, NULL),
  (gen_random_uuid(), 'Szeged-Csanád Grosics Akadémia',  'SZG', NULL, NULL),
  (gen_random_uuid(), 'Vasas FC',                         'VAS', NULL, NULL),
  (gen_random_uuid(), 'Tiszakécskei LC',                  'TLC', NULL, NULL),
  (gen_random_uuid(), 'Budapest Honvéd FC',               'HON', NULL, NULL),
  (gen_random_uuid(), 'Kecskeméti TE',                    'KTE', NULL, NULL),
  (gen_random_uuid(), 'Szentlőrinc',                      'SZL', NULL, NULL),
  (gen_random_uuid(), 'Soroksár SC',                      'SOR', NULL, NULL),
  (gen_random_uuid(), 'BVSC-Zugló',                       'BVS', NULL, NULL),
  (gen_random_uuid(), 'Békéscsaba 1912 Előre',            'BCS', NULL, NULL),
  (gen_random_uuid(), 'Aqvital FC Csákvár',               'AQV', NULL, NULL)
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO matches (id, home_team_id, away_team_id, venue_id, stage, group_name, match_number, scheduled_at, status)
VALUES
  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'MZS'),
    (SELECT id FROM teams WHERE short_code = 'VID'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 16:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KRC'),
    (SELECT id FROM teams WHERE short_code = 'AJK'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 16:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KOZ'),
    (SELECT id FROM teams WHERE short_code = 'BMT'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'SZG'),
    (SELECT id FROM teams WHERE short_code = 'VAS'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'TLC'),
    (SELECT id FROM teams WHERE short_code = 'HON'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'KTE'),
    (SELECT id FROM teams WHERE short_code = 'SZL'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 17:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'SOR'),
    (SELECT id FROM teams WHERE short_code = 'BVS'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 19:00:00+02', 'scheduled'),

  (gen_random_uuid(),
    (SELECT id FROM teams WHERE short_code = 'BCS'),
    (SELECT id FROM teams WHERE short_code = 'AQV'),
    NULL, 'group', NULL, NULL,
    '2026-04-05 19:00:00+02', 'scheduled')
;

COMMIT;
