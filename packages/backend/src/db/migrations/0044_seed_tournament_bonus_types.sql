INSERT INTO "special_prediction_types" (
  "id", "group_id", "name", "description", "input_type",
  "deadline", "points", "is_global", "is_active"
) VALUES
  (
    '11111111-1111-1111-1111-000000000001',
    NULL,
    'Csoportkör – legtöbb gólt szerző csapat',
    'Melyik csapat szerzett a legtöbb gólt a csoportkörben?',
    'team_select',
    '2026-06-11 02:00:00+00',
    3, true, true
  ),
  (
    '11111111-1111-1111-1111-000000000002',
    NULL,
    'Csoportkör – legkevesebb gólt szerző csapat',
    'Melyik csapat szerzett a legkevesebb gólt a csoportkörben?',
    'team_select',
    '2026-06-11 02:00:00+00',
    3, true, true
  ),
  (
    '11111111-1111-1111-1111-000000000003',
    NULL,
    'Csoportkör – legtöbb gólt kapó csapat',
    'Melyik csapat kapott a legtöbb gólt a csoportkörben?',
    'team_select',
    '2026-06-11 02:00:00+00',
    3, true, true
  ),
  (
    '11111111-1111-1111-1111-000000000004',
    NULL,
    'Csoportkör – legkevesebb gólt kapó csapat',
    'Melyik csapat kapott a legkevesebb gólt a csoportkörben?',
    'team_select',
    '2026-06-11 02:00:00+00',
    3, true, true
  )
ON CONFLICT ("id") DO NOTHING;
