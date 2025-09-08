ALTER TABLE "subscription" DROP CONSTRAINT "subscription_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "stripe_current_period_end";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "stripe_current_period_start";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "stripe_cancel_at";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "stripe_cancel_at_period_end";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "stripe_trial_start";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "stripe_trial_end";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "limits";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "metadata";