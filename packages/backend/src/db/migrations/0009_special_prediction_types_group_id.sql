ALTER TABLE "special_prediction_types" ADD COLUMN "group_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "special_prediction_types" ADD CONSTRAINT "special_prediction_types_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spt_group_idx" ON "special_prediction_types" USING btree ("group_id");
