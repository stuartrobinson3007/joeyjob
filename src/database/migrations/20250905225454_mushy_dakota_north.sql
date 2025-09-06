CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"stripe_customer_id" text,
	"stripe_current_period_end" timestamp,
	"stripe_current_period_start" timestamp,
	"stripe_cancel_at" timestamp,
	"stripe_cancel_at_period_end" boolean,
	"stripe_trial_start" timestamp,
	"stripe_trial_end" timestamp,
	"reference_id" text,
	"seats" integer,
	"status" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "current_plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "plan_limits" jsonb;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;