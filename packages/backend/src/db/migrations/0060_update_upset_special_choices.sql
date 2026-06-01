-- US-936 follow-up: refresh Upset Special team list and weighted points to the latest tip-board.
-- Rebuilds the choices JSONB from the canonical 24-team set; preserves existing minPicks/maxPicks (2/2).
-- Matches the row by input_type + is_global (not by hardcoded UUID) so it works regardless of how
-- the prod row was originally created. No-op if the row or matching teams are missing.

DO $$
DECLARE
  team_choices jsonb;
  affected integer;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('teamId', t.id, 'points', tp.points) ORDER BY tp.points DESC)
    INTO team_choices
    FROM (
      VALUES
        ('Spain',       'Spanyolország', 18),
        ('France',      'Franciaország', 18),
        ('England',     'Anglia',        17),
        ('Brazil',      'Brazília',      17),
        ('Argentina',   'Argentína',     16),
        ('Portugal',    'Portugália',    16),
        ('Germany',     'Németország',   15),
        ('Netherlands', 'Hollandia',     15),
        ('Norway',      'Norvégia',      14),
        ('Belgium',     'Belgium',       14),
        ('Colombia',    'Kolumbia',      12),
        ('Morocco',     'Marokkó',       12),
        ('Japan',       'Japán',         10),
        ('Uruguay',     'Uruguay',       10),
        ('USA',         'USA',            8),
        ('Mexico',      'Mexikó',         8),
        ('Croatia',     'Horvátország',   6),
        ('Switzerland', 'Svájc',          6),
        ('Ecuador',     'Ecuador',        5),
        ('Senegal',     'Szenegál',       5),
        ('Turkey',      'Türkiye',        4),
        ('Sweden',      'Svédország',     4),
        ('Austria',     'Ausztria',       2),
        ('Canada',      'Kanada',         2)
    ) AS tp(en_name, hu_name, points)
    JOIN LATERAL (
      SELECT id FROM "teams"
      WHERE name = tp.hu_name OR name = tp.en_name
      ORDER BY CASE WHEN name = tp.hu_name THEN 0 ELSE 1 END
      LIMIT 1
    ) t ON true;

  IF team_choices IS NULL OR jsonb_array_length(team_choices) < 2 THEN
    RAISE NOTICE 'Upset Special refresh skipped: fewer than 2 matching teams found';
    RETURN;
  END IF;

  UPDATE "special_prediction_types"
     SET "options" = jsonb_build_object(
           'maxPicks', 2,
           'minPicks', 2,
           'choices', team_choices
         ),
         "updated_at" = now()
   WHERE "input_type" = 'multi_team_weighted'
     AND "is_global" = true;

  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN
    RAISE NOTICE 'Upset Special refresh: no global multi_team_weighted row found — nothing updated';
  END IF;
END $$;

