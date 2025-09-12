DROP TABLE "availability_overrides" CASCADE;--> statement-breakpoint
DROP TABLE "availability_patterns" CASCADE;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_start_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_end_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "booking_date";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "end_time";