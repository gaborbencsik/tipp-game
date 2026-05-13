-- Custom migration: populate polymarket_slug for all 72 WC2026 group stage matches
-- Slug pattern: fifwc-{home_code}-{away_code}-{YYYY-MM-DD} (US Eastern date)
-- Team codes verified against live Polymarket Gamma API (previous session)
-- Safe to re-run: only updates where polymarket_slug IS NULL

-- Ensure column exists (idempotent guard for migration ordering)
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "polymarket_slug" text;--> statement-breakpoint

-- Matchday 1
UPDATE matches m SET polymarket_slug = 'fifwc-mex-rsa-2026-06-11' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Mexico' AND t2.name = 'South Africa';--> statement-breakpoint

UPDATE matches m SET polymarket_slug = 'fifwc-kr-cze-2026-06-11' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'South Korea' AND t2.name = 'Czech Republic';

UPDATE matches m SET polymarket_slug = 'fifwc-can-bih-2026-06-12' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Canada' AND t2.name = 'Bosnia & Herzegovina';

UPDATE matches m SET polymarket_slug = 'fifwc-usa-par-2026-06-12' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'USA' AND t2.name = 'Paraguay';

UPDATE matches m SET polymarket_slug = 'fifwc-qat-che-2026-06-13' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Qatar' AND t2.name = 'Switzerland';

UPDATE matches m SET polymarket_slug = 'fifwc-bra-mar-2026-06-13' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Brazil' AND t2.name = 'Morocco';

UPDATE matches m SET polymarket_slug = 'fifwc-hai-sco-2026-06-13' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Haiti' AND t2.name = 'Scotland';

UPDATE matches m SET polymarket_slug = 'fifwc-aus-tur-2026-06-14' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Australia' AND t2.name = 'Türkiye';

UPDATE matches m SET polymarket_slug = 'fifwc-ger-kor-2026-06-14' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Germany' AND t2.name = 'Curaçao';

UPDATE matches m SET polymarket_slug = 'fifwc-nld-jpn-2026-06-14' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Netherlands' AND t2.name = 'Japan';

UPDATE matches m SET polymarket_slug = 'fifwc-civ-ecu-2026-06-14' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Ivory Coast' AND t2.name = 'Ecuador';

UPDATE matches m SET polymarket_slug = 'fifwc-swe-tun-2026-06-14' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Sweden' AND t2.name = 'Tunisia';

UPDATE matches m SET polymarket_slug = 'fifwc-esp-cvi-2026-06-15' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Spain' AND t2.name = 'Cape Verde Islands';

UPDATE matches m SET polymarket_slug = 'fifwc-bel-egy-2026-06-15' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Belgium' AND t2.name = 'Egypt';

UPDATE matches m SET polymarket_slug = 'fifwc-ksa-ury-2026-06-15' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Saudi Arabia' AND t2.name = 'Uruguay';

UPDATE matches m SET polymarket_slug = 'fifwc-irn-nzl-2026-06-15' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Iran' AND t2.name = 'New Zealand';

UPDATE matches m SET polymarket_slug = 'fifwc-fra-sen-2026-06-16' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'France' AND t2.name = 'Senegal';

UPDATE matches m SET polymarket_slug = 'fifwc-irq-nor-2026-06-16' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Iraq' AND t2.name = 'Norway';

UPDATE matches m SET polymarket_slug = 'fifwc-arg-alg-2026-06-16' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Argentina' AND t2.name = 'Algeria';

UPDATE matches m SET polymarket_slug = 'fifwc-aut-jor-2026-06-17' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Austria' AND t2.name = 'Jordan';

UPDATE matches m SET polymarket_slug = 'fifwc-prt-cdr-2026-06-17' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Portugal' AND t2.name = 'Congo DR';

UPDATE matches m SET polymarket_slug = 'fifwc-eng-hrv-2026-06-17' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'England' AND t2.name = 'Croatia';

UPDATE matches m SET polymarket_slug = 'fifwc-gha-pan-2026-06-17' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Ghana' AND t2.name = 'Panama';

UPDATE matches m SET polymarket_slug = 'fifwc-uzb-col-2026-06-17' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Uzbekistan' AND t2.name = 'Colombia';

-- Matchday 2
UPDATE matches m SET polymarket_slug = 'fifwc-cze-rsa-2026-06-18' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Czech Republic' AND t2.name = 'South Africa';

UPDATE matches m SET polymarket_slug = 'fifwc-che-bih-2026-06-18' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Switzerland' AND t2.name = 'Bosnia & Herzegovina';

UPDATE matches m SET polymarket_slug = 'fifwc-can-qat-2026-06-18' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Canada' AND t2.name = 'Qatar';

UPDATE matches m SET polymarket_slug = 'fifwc-mex-kr-2026-06-18' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Mexico' AND t2.name = 'South Korea';

UPDATE matches m SET polymarket_slug = 'fifwc-usa-aus-2026-06-19' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'USA' AND t2.name = 'Australia';

UPDATE matches m SET polymarket_slug = 'fifwc-sco-mar-2026-06-19' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Scotland' AND t2.name = 'Morocco';

UPDATE matches m SET polymarket_slug = 'fifwc-bra-hai-2026-06-19' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Brazil' AND t2.name = 'Haiti';

UPDATE matches m SET polymarket_slug = 'fifwc-tur-par-2026-06-19' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Türkiye' AND t2.name = 'Paraguay';

UPDATE matches m SET polymarket_slug = 'fifwc-nld-swe-2026-06-20' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Netherlands' AND t2.name = 'Sweden';

UPDATE matches m SET polymarket_slug = 'fifwc-ger-civ-2026-06-20' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Germany' AND t2.name = 'Ivory Coast';

UPDATE matches m SET polymarket_slug = 'fifwc-ecu-kor-2026-06-20' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Ecuador' AND t2.name = 'Curaçao';

UPDATE matches m SET polymarket_slug = 'fifwc-tun-jpn-2026-06-21' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Tunisia' AND t2.name = 'Japan';

UPDATE matches m SET polymarket_slug = 'fifwc-esp-ksa-2026-06-21' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Spain' AND t2.name = 'Saudi Arabia';

UPDATE matches m SET polymarket_slug = 'fifwc-bel-irn-2026-06-21' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Belgium' AND t2.name = 'Iran';

UPDATE matches m SET polymarket_slug = 'fifwc-ury-cvi-2026-06-21' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Uruguay' AND t2.name = 'Cape Verde Islands';

UPDATE matches m SET polymarket_slug = 'fifwc-nzl-egy-2026-06-21' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'New Zealand' AND t2.name = 'Egypt';

UPDATE matches m SET polymarket_slug = 'fifwc-arg-aut-2026-06-22' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Argentina' AND t2.name = 'Austria';

UPDATE matches m SET polymarket_slug = 'fifwc-fra-irq-2026-06-22' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'France' AND t2.name = 'Iraq';

UPDATE matches m SET polymarket_slug = 'fifwc-nor-sen-2026-06-22' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Norway' AND t2.name = 'Senegal';

UPDATE matches m SET polymarket_slug = 'fifwc-jor-alg-2026-06-22' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Jordan' AND t2.name = 'Algeria';

UPDATE matches m SET polymarket_slug = 'fifwc-prt-uzb-2026-06-23' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Portugal' AND t2.name = 'Uzbekistan';

UPDATE matches m SET polymarket_slug = 'fifwc-eng-gha-2026-06-23' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'England' AND t2.name = 'Ghana';

UPDATE matches m SET polymarket_slug = 'fifwc-pan-hrv-2026-06-23' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Panama' AND t2.name = 'Croatia';

UPDATE matches m SET polymarket_slug = 'fifwc-col-cdr-2026-06-23' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Colombia' AND t2.name = 'Congo DR';

-- Matchday 3
UPDATE matches m SET polymarket_slug = 'fifwc-che-can-2026-06-24' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Switzerland' AND t2.name = 'Canada';

UPDATE matches m SET polymarket_slug = 'fifwc-bih-qat-2026-06-24' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Bosnia & Herzegovina' AND t2.name = 'Qatar';

UPDATE matches m SET polymarket_slug = 'fifwc-sco-bra-2026-06-24' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Scotland' AND t2.name = 'Brazil';

UPDATE matches m SET polymarket_slug = 'fifwc-mar-hai-2026-06-24' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Morocco' AND t2.name = 'Haiti';

UPDATE matches m SET polymarket_slug = 'fifwc-cze-mex-2026-06-24' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Czech Republic' AND t2.name = 'Mexico';

UPDATE matches m SET polymarket_slug = 'fifwc-rsa-kr-2026-06-24' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'South Africa' AND t2.name = 'South Korea';

UPDATE matches m SET polymarket_slug = 'fifwc-ecu-ger-2026-06-25' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Ecuador' AND t2.name = 'Germany';

UPDATE matches m SET polymarket_slug = 'fifwc-kor-civ-2026-06-25' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Curaçao' AND t2.name = 'Ivory Coast';

UPDATE matches m SET polymarket_slug = 'fifwc-tun-nld-2026-06-25' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Tunisia' AND t2.name = 'Netherlands';

UPDATE matches m SET polymarket_slug = 'fifwc-jpn-swe-2026-06-25' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Japan' AND t2.name = 'Sweden';

UPDATE matches m SET polymarket_slug = 'fifwc-par-aus-2026-06-25' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Paraguay' AND t2.name = 'Australia';

UPDATE matches m SET polymarket_slug = 'fifwc-tur-usa-2026-06-25' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Türkiye' AND t2.name = 'USA';

UPDATE matches m SET polymarket_slug = 'fifwc-sen-irq-2026-06-26' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Senegal' AND t2.name = 'Iraq';

UPDATE matches m SET polymarket_slug = 'fifwc-nor-fra-2026-06-26' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Norway' AND t2.name = 'France';

UPDATE matches m SET polymarket_slug = 'fifwc-cvi-ksa-2026-06-26' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Cape Verde Islands' AND t2.name = 'Saudi Arabia';

UPDATE matches m SET polymarket_slug = 'fifwc-ury-esp-2026-06-26' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Uruguay' AND t2.name = 'Spain';

UPDATE matches m SET polymarket_slug = 'fifwc-nzl-bel-2026-06-26' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'New Zealand' AND t2.name = 'Belgium';

UPDATE matches m SET polymarket_slug = 'fifwc-egy-irn-2026-06-26' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Egypt' AND t2.name = 'Iran';

UPDATE matches m SET polymarket_slug = 'fifwc-pan-eng-2026-06-27' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Panama' AND t2.name = 'England';

UPDATE matches m SET polymarket_slug = 'fifwc-hrv-gha-2026-06-27' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Croatia' AND t2.name = 'Ghana';

UPDATE matches m SET polymarket_slug = 'fifwc-cdr-uzb-2026-06-27' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Congo DR' AND t2.name = 'Uzbekistan';

UPDATE matches m SET polymarket_slug = 'fifwc-col-prt-2026-06-27' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Colombia' AND t2.name = 'Portugal';

UPDATE matches m SET polymarket_slug = 'fifwc-alg-aut-2026-06-27' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Algeria' AND t2.name = 'Austria';

UPDATE matches m SET polymarket_slug = 'fifwc-jor-arg-2026-06-27' FROM teams t1, teams t2, leagues l WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id AND l.short_name = 'WC2026' AND m.polymarket_slug IS NULL AND t1.name = 'Jordan' AND t2.name = 'Argentina';
