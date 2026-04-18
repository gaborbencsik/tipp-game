CREATE TYPE "public"."team_type" AS ENUM('national', 'club');--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "team_type" "team_type" DEFAULT 'national' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "country_code" varchar(10);