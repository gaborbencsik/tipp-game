-- Rename the existing PRE-VB league to PRE-VB-1 (1st chunk of split friendlies)
-- and create two more leagues with deterministic UUIDs for the 2nd and 3rd chunks.
UPDATE leagues
   SET name = 'Pre-VB Edzőmeccsek 1.', short_name = 'PRE-VB-1', updated_at = NOW()
 WHERE short_name = 'PRE-VB';

INSERT INTO leagues (id, name, short_name, created_at, updated_at)
SELECT '79893d98-595b-4488-9436-f3a75c7b2786', 'Pre-VB Edzőmeccsek 2.', 'PRE-VB-2', NOW(), NOW()
 WHERE NOT EXISTS (SELECT 1 FROM leagues WHERE short_name = 'PRE-VB-2');

INSERT INTO leagues (id, name, short_name, created_at, updated_at)
SELECT '79893d98-595b-4488-9436-f3a75c7b2787', 'Pre-VB Edzőmeccsek 3.', 'PRE-VB-3', NOW(), NOW()
 WHERE NOT EXISTS (SELECT 1 FROM leagues WHERE short_name = 'PRE-VB-3');
