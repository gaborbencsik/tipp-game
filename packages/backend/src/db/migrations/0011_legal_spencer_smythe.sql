CREATE TABLE "group_global_type_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"global_type_id" uuid NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "special_predictions_unique";--> statement-breakpoint
ALTER TABLE "special_prediction_types" ALTER COLUMN "group_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "special_prediction_types" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "special_predictions" ADD COLUMN "group_id" uuid;--> statement-breakpoint
UPDATE special_predictions sp SET group_id = spt.group_id FROM special_prediction_types spt WHERE sp.type_id = spt.id AND spt.group_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "group_global_type_subscriptions" ADD CONSTRAINT "group_global_type_subscriptions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_global_type_subscriptions" ADD CONSTRAINT "group_global_type_subscriptions_global_type_id_special_prediction_types_id_fk" FOREIGN KEY ("global_type_id") REFERENCES "public"."special_prediction_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ggts_unique" ON "group_global_type_subscriptions" USING btree ("group_id","global_type_id");--> statement-breakpoint
CREATE INDEX "ggts_group_idx" ON "group_global_type_subscriptions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "ggts_global_type_idx" ON "group_global_type_subscriptions" USING btree ("global_type_id");--> statement-breakpoint
ALTER TABLE "special_predictions" ADD CONSTRAINT "special_predictions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "special_predictions_group_idx" ON "special_predictions" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "special_predictions_unique" ON "special_predictions" USING btree ("user_id","type_id","group_id");