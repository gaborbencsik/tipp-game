-- FIFA World Cup 2026 – csapatok
-- Forrás: tournament JSON (48 csapat, 12 csoport, A–L)
-- country_code: ISO 3166-1 alpha-2 (US-806 migrációhoz előkészítve, jelenleg nincs oszlop)
-- ON CONFLICT (short_code) DO NOTHING → idempotens, újrafuttatható

INSERT INTO teams (id, name, short_code, flag_url, "group")
VALUES

  -- ── Csoport A ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Mexico',          'MEX', NULL, 'A'), -- mx
  (gen_random_uuid(), 'South Africa',    'RSA', NULL, 'A'), -- za
  (gen_random_uuid(), 'South Korea',     'KOR', NULL, 'A'), -- kr
  (gen_random_uuid(), 'Czech Republic',  'CZE', NULL, 'A'), -- cz

  -- ── Csoport B ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Canada',                  'CAN', NULL, 'B'), -- ca
  (gen_random_uuid(), 'Bosnia and Herzegovina',  'BIH', NULL, 'B'), -- ba
  (gen_random_uuid(), 'Qatar',                   'QAT', NULL, 'B'), -- qa
  (gen_random_uuid(), 'Switzerland',             'SUI', NULL, 'B'), -- ch

  -- ── Csoport C ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Brazil',   'BRA', NULL, 'C'), -- br
  (gen_random_uuid(), 'Morocco',  'MAR', NULL, 'C'), -- ma
  (gen_random_uuid(), 'Haiti',    'HAI', NULL, 'C'), -- ht
  (gen_random_uuid(), 'Scotland', 'SCO', NULL, 'C'), -- gb-sct

  -- ── Csoport D ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'USA',       'USA', NULL, 'D'), -- us
  (gen_random_uuid(), 'Paraguay',  'PAR', NULL, 'D'), -- py
  (gen_random_uuid(), 'Australia', 'AUS', NULL, 'D'), -- au
  (gen_random_uuid(), 'Turkey',    'TUR', NULL, 'D'), -- tr

  -- ── Csoport E ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Germany',      'GER', NULL, 'E'), -- de
  (gen_random_uuid(), 'Curacao',      'CUW', NULL, 'E'), -- cw
  (gen_random_uuid(), 'Ivory Coast',  'CIV', NULL, 'E'), -- ci
  (gen_random_uuid(), 'Ecuador',      'ECU', NULL, 'E'), -- ec

  -- ── Csoport F ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Netherlands', 'NED', NULL, 'F'), -- nl
  (gen_random_uuid(), 'Japan',       'JPN', NULL, 'F'), -- jp
  (gen_random_uuid(), 'Sweden',      'SWE', NULL, 'F'), -- se
  (gen_random_uuid(), 'Tunisia',     'TUN', NULL, 'F'), -- tn

  -- ── Csoport G ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Belgium',     'BEL', NULL, 'G'), -- be
  (gen_random_uuid(), 'Egypt',       'EGY', NULL, 'G'), -- eg
  (gen_random_uuid(), 'Iran',        'IRN', NULL, 'G'), -- ir
  (gen_random_uuid(), 'New Zealand', 'NZL', NULL, 'G'), -- nz

  -- ── Csoport H ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Spain',        'ESP', NULL, 'H'), -- es
  (gen_random_uuid(), 'Cape Verde',   'CPV', NULL, 'H'), -- cv
  (gen_random_uuid(), 'Saudi Arabia', 'KSA', NULL, 'H'), -- sa
  (gen_random_uuid(), 'Uruguay',      'URU', NULL, 'H'), -- uy

  -- ── Csoport I ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'France',  'FRA', NULL, 'I'), -- fr
  (gen_random_uuid(), 'Senegal', 'SEN', NULL, 'I'), -- sn
  (gen_random_uuid(), 'Iraq',    'IRQ', NULL, 'I'), -- iq
  (gen_random_uuid(), 'Norway',  'NOR', NULL, 'I'), -- no

  -- ── Csoport J ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Argentina', 'ARG', NULL, 'J'), -- ar
  (gen_random_uuid(), 'Algeria',   'ALG', NULL, 'J'), -- dz
  (gen_random_uuid(), 'Austria',   'AUT', NULL, 'J'), -- at
  (gen_random_uuid(), 'Jordan',    'JOR', NULL, 'J'), -- jo

  -- ── Csoport K ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'Portugal', 'POR', NULL, 'K'), -- pt
  (gen_random_uuid(), 'DR Congo', 'COD', NULL, 'K'), -- cd
  (gen_random_uuid(), 'Uzbekistan', 'UZB', NULL, 'K'), -- uz
  (gen_random_uuid(), 'Colombia', 'COL', NULL, 'K'), -- co

  -- ── Csoport L ──────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'England', 'ENG', NULL, 'L'), -- gb-eng
  (gen_random_uuid(), 'Croatia', 'CRO', NULL, 'L'), -- hr
  (gen_random_uuid(), 'Ghana',   'GHA', NULL, 'L'), -- gh
  (gen_random_uuid(), 'Panama',  'PAN', NULL, 'L') -- pa

ON CONFLICT (short_code) DO NOTHING;
