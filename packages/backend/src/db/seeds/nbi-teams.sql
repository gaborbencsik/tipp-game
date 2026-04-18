-- ============================================================
-- NB I 2025/26 csapatok
-- ============================================================

BEGIN;

INSERT INTO teams (id, name, short_code, flag_url, "group", team_type, country_code, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Ferencváros',           'FTC',  '/logos/ftc.svg',  'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Puskás Akadémia',        'PAFC', '/logos/pafc.svg', 'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Paksi FC',               'PAKS', '/logos/paks.svg', 'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Debreceni VSC',          'DVSC', '/logos/dvsc.svg', 'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'MTK Budapest',           'MTK',  '/logos/mtk.svg',  'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Győri ETO',              'ETO',  '/logos/eto.png',  'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Kisvárda FC',            'KISV', '/logos/kisv.png', 'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'ZTE FC',                 'ZTE',  '/logos/zte.svg',  'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Újpest FC',              'UJP',  '/logos/ujp.svg',  'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Nyíregyháza Spartacus',  'NYIR', '/logos/nyir.svg',              'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'DVTK',                   'DVTK', '/logos/dvtk.svg', 'NB I', 'club', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Kolorcity Kazincbarcika SC', 'KBSC', '/logos/kbsc.png',              'NB I', 'club', NULL, NOW(), NOW())
ON CONFLICT (short_code) DO NOTHING;

COMMIT;
