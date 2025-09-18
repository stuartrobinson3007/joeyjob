ALTER TABLE "bookings" ALTER COLUMN "service_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "price" DROP NOT NULL;