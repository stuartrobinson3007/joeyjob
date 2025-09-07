ALTER TABLE "subscription" ALTER COLUMN "plan" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "reference_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "status" SET DEFAULT 'incomplete';--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "period_start" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "period_end" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "trial_start" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "trial_end" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false;