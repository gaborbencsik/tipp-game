ALTER TABLE "group_leagues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leagues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE drizzle."__drizzle_migrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO leagues (name, short_name, created_at, updated_at)
VALUES
  ('FIFA World Cup 2026', 'VB', NOW(), NOW()),
  ('NB I 2025/26', 'NB I', NOW(), NOW())
ON CONFLICT DO NOTHING;
