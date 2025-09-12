ALTER TABLE "organization" ADD COLUMN "timezone" text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_employees" DROP COLUMN "display_on_schedule";