ALTER TABLE "booking_forms" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "current_plan" SET DEFAULT 'pro';