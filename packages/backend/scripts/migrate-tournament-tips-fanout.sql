-- One-off migration: fan out existing tournament-level (group_id IS NULL)
-- special_predictions rows into each user's eligible groups, then drop the NULL rows.
--
-- Idempotent: ON CONFLICT DO NOTHING avoids overwriting any per-group rows
-- that already exist (e.g. from later writes after the fan-out fix shipped).

BEGIN;

INSERT INTO special_predictions (user_id, type_id, group_id, answer, points, created_at, updated_at)
SELECT
  sp.user_id,
  sp.type_id,
  gm.group_id,
  sp.answer,
  sp.points,
  sp.created_at,
  sp.updated_at
FROM special_predictions sp
JOIN group_members gm
  ON gm.user_id = sp.user_id
JOIN group_global_type_subscriptions ggs
  ON ggs.group_id = gm.group_id
 AND ggs.global_type_id = sp.type_id
WHERE sp.group_id IS NULL
ON CONFLICT (user_id, type_id, group_id) DO NOTHING;

DELETE FROM special_predictions WHERE group_id IS NULL;

COMMIT;
