CREATE TABLE "simpro_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"access_token" text NOT NULL,
	"build_name" text NOT NULL,
	"domain" text NOT NULL,
	"company_id" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simpro_companies" ADD CONSTRAINT "simpro_companies_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "access_token";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "refresh_token";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "access_token_expires_at";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "refresh_token_expires_at";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "provider_data";