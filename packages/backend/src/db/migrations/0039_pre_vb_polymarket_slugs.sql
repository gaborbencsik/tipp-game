-- Custom migration: populate polymarket_slug for PRE-VB friendly matches
-- Slugs validated against Polymarket Gamma API (FIFA Friendly series_id=10238)
-- URL pattern: https://polymarket.com/sports/fifa-friendlies/{slug}
-- Slug pattern: fif-{home_code}-{away_code}-{YYYY-MM-DD}  (US Eastern date)
--
-- Note on home/away: a few Polymarket slugs use a reversed pairing vs. the project's
-- match record (e.g. project "Denmark vs Congo DR" → slug "fif-cdr-den-2026-06-03").
-- The slug is just a URL identifier — we still attach it to the project's match row
-- regardless of orientation.
--
-- Coverage: 61 of 65 PRE-VB matches have a Polymarket market.
-- No market for: Iran-Gambia, Andorra-Iraq, S.Korea-Trinidad, Brazil-Egypt.
--
-- Safe to re-run: only updates where polymarket_slug IS NULL.

-- ===========================================================================
-- PRE-VB-1
-- ===========================================================================

UPDATE matches m SET polymarket_slug = 'fif-mex-gha-2026-05-22' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Mexico' AND t2.name = 'Ghana';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-mar-buru-2026-05-26' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Morocco' AND t2.name = 'Burundi';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-egy-rus-2026-05-28' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Egypt' AND t2.name = 'Russia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-ire-qat-2026-05-28' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Rep. Of Ireland' AND t2.name = 'Qatar';--> statement-breakpoint

-- Iran vs Gambia (2026-05-29) — no Polymarket market

UPDATE matches m SET polymarket_slug = 'fif-rsa-nca-2026-05-29' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'South Africa' AND t2.name = 'Nicaragua';--> statement-breakpoint

-- Andorra vs Iraq (2026-05-29) — no Polymarket market

UPDATE matches m SET polymarket_slug = 'fif-bih-mac-2026-05-29' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Bosnia & Herzegovina' AND t2.name = 'FYR Macedonia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-sco-kor-2026-05-30' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Scotland' AND t2.name = 'Curaçao';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-ecu-ksa-2026-05-30' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Ecuador' AND t2.name = 'Saudi Arabia';--> statement-breakpoint

-- South Korea vs Trinidad and Tobago (2026-05-31) — no Polymarket market

UPDATE matches m SET polymarket_slug = 'fif-mex-aus-2026-05-30' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Mexico' AND t2.name = 'Australia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-jpn-isl-2026-05-31' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Japan' AND t2.name = 'Iceland';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-che-jor-2026-05-31' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Switzerland' AND t2.name = 'Jordan';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-cvi-ser-2026-05-31' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Cape Verde Islands' AND t2.name = 'Serbia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-cze-kvx-2026-05-31' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Czech Republic' AND t2.name = 'Kosovo';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-ger-fin-2026-05-31' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Germany' AND t2.name = 'Finland';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-usa-sen-2026-05-31' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'USA' AND t2.name = 'Senegal';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-bra-pan-2026-05-31' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Brazil' AND t2.name = 'Panama';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-tur-mac-2026-06-01' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Türkiye' AND t2.name = 'FYR Macedonia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-nor-swe-2026-06-01' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-1' AND m.polymarket_slug IS NULL AND t1.name = 'Norway' AND t2.name = 'Sweden';--> statement-breakpoint

-- ===========================================================================
-- PRE-VB-2
-- ===========================================================================

UPDATE matches m SET polymarket_slug = 'fif-aut-tun-2026-06-01' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Austria' AND t2.name = 'Tunisia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-col-cri-2026-06-01' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Colombia' AND t2.name = 'Costa Rica';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-can-uzb-2026-06-01' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Canada' AND t2.name = 'Uzbekistan';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-hrv-bel-2026-06-02' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Croatia' AND t2.name = 'Belgium';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-mar-mad-2026-06-02' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Morocco' AND t2.name = 'Madagascar';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-wal-gha-2026-06-02' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Wales' AND t2.name = 'Ghana';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-hai-nzl-2026-06-02' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Haiti' AND t2.name = 'New Zealand';--> statement-breakpoint

-- Project: Denmark vs Congo DR — Polymarket reversed: fif-cdr-den-2026-06-03
UPDATE matches m SET polymarket_slug = 'fif-cdr-den-2026-06-03' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Denmark' AND t2.name = 'Congo DR';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-nld-alg-2026-06-03' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Netherlands' AND t2.name = 'Algeria';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-pan-dom-2026-06-03' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Panama' AND t2.name = 'Dominican Republic';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-kr-slv-2026-06-03' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'South Korea' AND t2.name = 'El Salvador';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-swe-grc-2026-06-04' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Sweden' AND t2.name = 'Greece';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-esp-irq-2026-06-04' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Spain' AND t2.name = 'Iraq';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-fra-civ-2026-06-04' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'France' AND t2.name = 'Ivory Coast';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-gua-cze-2026-06-04' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Guatemala' AND t2.name = 'Czech Republic';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-mex-ser-2026-06-04' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Mexico' AND t2.name = 'Serbia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-par-nca-2026-06-05' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Paraguay' AND t2.name = 'Nicaragua';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-can-ire-2026-06-05' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Canada' AND t2.name = 'Rep. Of Ireland';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-hai-per-2026-06-05' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Haiti' AND t2.name = 'Peru';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-bel-tun-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Belgium' AND t2.name = 'Tunisia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-prt-chl-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'Portugal' AND t2.name = 'Chile';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-usa-ger-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-2' AND m.polymarket_slug IS NULL AND t1.name = 'USA' AND t2.name = 'Germany';--> statement-breakpoint

-- ===========================================================================
-- PRE-VB-3
-- ===========================================================================

UPDATE matches m SET polymarket_slug = 'fif-aus-che-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Australia' AND t2.name = 'Switzerland';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-pan-bih-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Panama' AND t2.name = 'Bosnia & Herzegovina';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-eng-nzl-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'England' AND t2.name = 'New Zealand';--> statement-breakpoint

-- Brazil vs Egypt (2026-06-06) — no Polymarket market

UPDATE matches m SET polymarket_slug = 'fif-bol-sco-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Bolivia' AND t2.name = 'Scotland';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-qat-slv-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Qatar' AND t2.name = 'El Salvador';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-ven-tur-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Venezuela' AND t2.name = 'Türkiye';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-kor-aru-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Curaçao' AND t2.name = 'Aruba';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-arg-hnd-2026-06-06' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Argentina' AND t2.name = 'Honduras';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-hrv-slv1-2026-06-07' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Croatia' AND t2.name = 'Slovenia';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-mar-nor-2026-06-07' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Morocco' AND t2.name = 'Norway';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-ecu-gua-2026-06-07' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Ecuador' AND t2.name = 'Guatemala';--> statement-breakpoint

-- Project: Colombia vs Jordan — Polymarket reversed: fif-jor-col-2026-06-07
UPDATE matches m SET polymarket_slug = 'fif-jor-col-2026-06-07' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Colombia' AND t2.name = 'Jordan';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-nld-uzb-2026-06-08' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Netherlands' AND t2.name = 'Uzbekistan';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-fra-nir-2026-06-08' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'France' AND t2.name = 'Northern Ireland';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-per-esp-2026-06-08' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Peru' AND t2.name = 'Spain';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-cdr-chl-2026-06-09' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Congo DR' AND t2.name = 'Chile';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-ksa-sen-2026-06-09' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Saudi Arabia' AND t2.name = 'Senegal';--> statement-breakpoint

-- Project: Iceland vs Argentina — Polymarket reversed: fif-arg-isl-2026-06-09
UPDATE matches m SET polymarket_slug = 'fif-arg-isl-2026-06-09' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Iceland' AND t2.name = 'Argentina';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-prt-nga-2026-06-10' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Portugal' AND t2.name = 'Nigeria';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-eng-cri-2026-06-10' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'England' AND t2.name = 'Costa Rica';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fif-aut-gua-2026-06-11' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'PRE-VB-3' AND m.polymarket_slug IS NULL AND t1.name = 'Austria' AND t2.name = 'Guatemala';
