ALTER TABLE "organization_employees" RENAME COLUMN "is_active" TO "is_enabled";--> statement-breakpoint
ALTER TABLE "organization_employees" ADD COLUMN "is_removed" boolean DEFAULT false NOT NULL;