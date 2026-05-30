-- US-945 follow-up: align teams.group with the official 2025-12-05 FIFA WC 2026 final draw.
-- Match by name in BOTH api-football (prod) and Hungarian (dev seed) spellings. Names and
-- country_code are preserved — only the group letter is updated. Teams not in the 48
-- finalists end up with group=NULL so they stop appearing in the all_groups_standing picker.

UPDATE "teams" SET "group" = NULL WHERE "team_type" = 'national';

UPDATE "teams" SET "group" = 'A' WHERE "team_type" = 'national' AND "name" IN ('Czech Republic','Csehország','Mexico','Mexikó','South Africa','Dél-afrikai Köztársaság','South Korea','Dél-Korea');
UPDATE "teams" SET "group" = 'B' WHERE "team_type" = 'national' AND "name" IN ('Bosnia & Herzegovina','Bosznia-Hercegovina','Canada','Kanada','Qatar','Katar','Switzerland','Svájc');
UPDATE "teams" SET "group" = 'C' WHERE "team_type" = 'national' AND "name" IN ('Brazil','Brazília','Haiti','Morocco','Marokkó','Scotland','Skócia');
UPDATE "teams" SET "group" = 'D' WHERE "team_type" = 'national' AND "name" IN ('Australia','Ausztrália','Paraguay','Türkiye','Törökország','USA');
UPDATE "teams" SET "group" = 'E' WHERE "team_type" = 'national' AND "name" IN ('Curaçao','Ecuador','Germany','Németország','Ivory Coast','Elefántcsontpart');
UPDATE "teams" SET "group" = 'F' WHERE "team_type" = 'national' AND "name" IN ('Japan','Japán','Netherlands','Hollandia','Sweden','Svédország','Tunisia','Tunézia');
UPDATE "teams" SET "group" = 'G' WHERE "team_type" = 'national' AND "name" IN ('Belgium','Egypt','Egyiptom','Iran','Irán','New Zealand','Új-Zéland');
UPDATE "teams" SET "group" = 'H' WHERE "team_type" = 'national' AND "name" IN ('Cape Verde Islands','Zöld-foki Köztársaság','Saudi Arabia','Szaúd-Arábia','Spain','Spanyolország','Uruguay');
UPDATE "teams" SET "group" = 'I' WHERE "team_type" = 'national' AND "name" IN ('France','Franciaország','Iraq','Irak','Norway','Norvégia','Senegal','Szenegál');
UPDATE "teams" SET "group" = 'J' WHERE "team_type" = 'national' AND "name" IN ('Algeria','Algéria','Argentina','Argentína','Austria','Ausztria','Jordan','Jordánia');
UPDATE "teams" SET "group" = 'K' WHERE "team_type" = 'national' AND "name" IN ('Colombia','Kolumbia','Congo DR','Kongói DK','Portugal','Portugália','Uzbekistan','Üzbegisztán');
UPDATE "teams" SET "group" = 'L' WHERE "team_type" = 'national' AND "name" IN ('Croatia','Horvátország','England','Anglia','Ghana','Ghána','Panama');

DO $$
DECLARE
  assigned int;
BEGIN
  SELECT COUNT(*) INTO assigned FROM "teams" WHERE "team_type" = 'national' AND "group" IS NOT NULL;
  IF assigned <> 48 THEN
    RAISE WARNING '0051_fix_wc2026_groups: expected 48 national teams with group, got %', assigned;
  END IF;
END $$;
