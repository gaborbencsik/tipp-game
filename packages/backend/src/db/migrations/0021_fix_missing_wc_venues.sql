-- Custom migration: assign missing WC 2026 venues by team names
-- Source: FIFA.com / NBCSports confirmed schedule
-- Safe to re-run: only updates where venue_id IS NULL

UPDATE matches m
SET venue_id = (SELECT id FROM venues WHERE name = 'Levi''s Stadium' LIMIT 1)
FROM teams t1, teams t2, leagues l
WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id
  AND l.short_name = 'WC2026' AND m.venue_id IS NULL
  AND (
    (t1.name = 'Qatar' AND t2.name = 'Switzerland')
    OR (t1.name = 'Austria' AND t2.name = 'Jordan')
    OR (t1.name ILIKE 'Turk%' AND t2.name = 'Paraguay')
    OR (t1.name = 'Jordan' AND t2.name = 'Algeria')
    OR (t1.name = 'Paraguay' AND t2.name = 'Australia')
  );

UPDATE matches m
SET venue_id = (SELECT id FROM venues WHERE name = 'AT&T Stadium' LIMIT 1)
FROM teams t1, teams t2, leagues l
WHERE m.home_team_id = t1.id AND m.away_team_id = t2.id AND m.league_id = l.id
  AND l.short_name = 'WC2026' AND m.venue_id IS NULL
  AND (
    (t1.name = 'Netherlands' AND t2.name = 'Japan')
    OR (t1.name = 'England' AND t2.name = 'Croatia')
    OR (t1.name = 'Argentina' AND t2.name = 'Austria')
    OR (t1.name = 'Japan' AND t2.name = 'Sweden')
    OR (t1.name = 'Jordan' AND t2.name = 'Argentina')
  );
