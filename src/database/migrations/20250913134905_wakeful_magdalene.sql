ALTER TABLE "bookings" RENAME COLUMN "duration" TO "service_duration";--> statement-breakpoint
ALTER TABLE "bookings" RENAME COLUMN "price" TO "service_price";--> statement-breakpoint
ALTER TABLE "bookings" RENAME COLUMN "form_data" TO "form_responses";--> statement-breakpoint
ALTER TABLE "bookings" RENAME COLUMN "notes" TO "customer_notes";--> statement-breakpoint
ALTER TABLE "bookings" RENAME COLUMN "source" TO "booking_source";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "service_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "service_description" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "customer_company" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "customer_timezone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "assigned_employee_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "assigned_employee_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "assigned_employee_email" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "status_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "status_changed_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "address_state" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "address_postal_code" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "address_country" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "provider_type" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "provider_company_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "provider_data" json;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_employee_id_organization_employees_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."organization_employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_changed_by_user_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "service_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "reminder_sent";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "reminder_sent_at";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "simpro_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "simpro_build_name";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "simpro_domain";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "simpro_company_id";