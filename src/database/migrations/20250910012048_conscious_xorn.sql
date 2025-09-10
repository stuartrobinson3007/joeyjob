CREATE TABLE "booking_employees" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"organization_employee_id" text NOT NULL,
	"simpro_job_id" integer,
	"simpro_customer_id" integer,
	"simpro_schedule_id" integer,
	"simpro_site_id" integer,
	"simpro_status" text,
	"simpro_sync_error" text,
	"last_simpro_sync" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_employees" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"simpro_employee_id" integer NOT NULL,
	"simpro_employee_name" text NOT NULL,
	"simpro_employee_email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_on_schedule" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"sync_error" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_employees" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"organization_employee_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_employees" ADD CONSTRAINT "booking_employees_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_employees" ADD CONSTRAINT "booking_employees_organization_employee_id_organization_employees_id_fk" FOREIGN KEY ("organization_employee_id") REFERENCES "public"."organization_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_employees" ADD CONSTRAINT "organization_employees_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_employees" ADD CONSTRAINT "organization_employees_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_employees" ADD CONSTRAINT "service_employees_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_employees" ADD CONSTRAINT "service_employees_organization_employee_id_organization_employees_id_fk" FOREIGN KEY ("organization_employee_id") REFERENCES "public"."organization_employees"("id") ON DELETE cascade ON UPDATE no action;