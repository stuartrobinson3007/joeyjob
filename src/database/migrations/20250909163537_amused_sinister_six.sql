ALTER TABLE "booking_forms" ALTER COLUMN "fields" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_forms" ADD COLUMN "form_config" json;--> statement-breakpoint
ALTER TABLE "booking_forms" ADD COLUMN "theme" text DEFAULT 'light';--> statement-breakpoint
ALTER TABLE "booking_forms" ADD COLUMN "primary_color" text DEFAULT '#3B82F6';