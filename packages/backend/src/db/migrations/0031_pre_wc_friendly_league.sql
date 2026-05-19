INSERT INTO leagues (name, short_name, created_at, updated_at)
SELECT 'Pre-VB Edzőmeccsek', 'PRE-VB', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM leagues WHERE short_name = 'PRE-VB'
);
