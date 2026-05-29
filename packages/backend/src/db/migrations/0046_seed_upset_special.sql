-- US-936: Upset Special — global multi_team_weighted bonus type.
-- Build the choices JSONB by joining 24 favorite team names with their weighted points.
-- If fewer than 2 favorite teams exist in the DB (fresh dev environments without team sync), skip seeding.

DO $$
DECLARE
  team_choices jsonb;
  expected_id uuid := '33333333-aaaa-bbbb-cccc-000000000936';
BEGIN
  IF EXISTS (SELECT 1 FROM "special_prediction_types" WHERE "id" = expected_id) THEN
    RETURN;
  END IF;

  SELECT jsonb_agg(jsonb_build_object('teamId', t.id, 'points', tp.points) ORDER BY tp.points DESC)
    INTO team_choices
    FROM (
      VALUES
        ('Spain', 'Spanyolország', 18),
        ('France', 'Franciaország', 17),
        ('Argentina', 'Argentína', 16),
        ('England', 'Anglia', 15),
        ('Brazil', 'Brazília', 15),
        ('Germany', 'Németország', 14),
        ('Portugal', 'Portugália', 13),
        ('Netherlands', 'Hollandia', 12),
        ('Belgium', 'Belgium', 11),
        ('Italy', 'Olaszország', 10),
        ('Croatia', 'Horvátország', 9),
        ('Uruguay', 'Uruguay', 8),
        ('Morocco', 'Marokkó', 8),
        ('Switzerland', 'Svájc', 7),
        ('Denmark', 'Dánia', 7),
        ('USA', 'USA', 6),
        ('Japan', 'Japán', 6),
        ('Mexico', 'Mexikó', 5),
        ('Senegal', 'Szenegál', 5),
        ('South Korea', 'Dél-Korea', 4),
        ('Canada', 'Kanada', 3),
        ('Ecuador', 'Ecuador', 3),
        ('Australia', 'Ausztrália', 2),
        ('Saudi Arabia', 'Szaúd-Arábia', 2)
    ) AS tp(en_name, hu_name, points)
    JOIN LATERAL (
      SELECT id FROM "teams"
      WHERE name = tp.hu_name OR name = tp.en_name
      ORDER BY CASE WHEN name = tp.hu_name THEN 0 ELSE 1 END
      LIMIT 1
    ) t ON true;

  IF team_choices IS NULL OR jsonb_array_length(team_choices) < 2 THEN
    RAISE NOTICE 'US-936 seed skipped: fewer than 2 favorite teams found in teams table';
    RETURN;
  END IF;

  INSERT INTO "special_prediction_types" (
    "id", "group_id", "name", "description", "input_type",
    "deadline", "points", "is_global", "is_active", "options"
  ) VALUES (
    expected_id,
    NULL,
    'Upset Special – kiesett csapatok',
    'Melyik 2 favoritnak végét ér a csoportköre? Válassz pontosan 2 csapatot, akik szerinted nem jutnak túl a csoportkörön. A pontérték csapatonként változó (2–18p).',
    'multi_team_weighted',
    '2026-06-11 02:00:00+00',
    0,
    true,
    true,
    jsonb_build_object(
      'maxPicks', 2,
      'minPicks', 2,
      'choices', team_choices
    )
  );
END $$;
