import { pgTable, text, timestamp, boolean, integer, json, decimal } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'
import { customAlphabet } from 'nanoid'

// Custom ID generator for forms: 12 characters, lowercase letters and numbers only
const generateFormId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12)

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  language: text('language').default('en').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Better Auth requires these fields for OAuth providers
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  idToken: text('id_token'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'),
  impersonatedBy: text('impersonated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  
  // Contact information
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  
  // Location and locale
  timezone: text('timezone').default('America/New_York').notNull(),
  currency: text('currency'),
  
  // Address fields
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressPostalCode: text('address_postal_code'),
  addressCountry: text('address_country'),
  
  // Provider integration
  providerType: text('provider_type'), // 'simpro', 'minuba', etc.
  providerCompanyId: text('provider_company_id'), // Company ID from provider
  // providerData removed - now stored in provider-specific tables

  // Billing fields
  currentPlan: text('current_plan').default('pro').notNull(), // Cached from Stripe for quick access
  stripeCustomerId: text('stripe_customer_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: text('metadata'),
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

// Better Auth Stripe subscription table
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull(), // Can be userId or organizationId
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').default('incomplete'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  seats: integer('seats'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Custom todos table
export const todos = pgTable('todos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  description: text('description'),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
  completed: boolean('completed').default(false).notNull(),
  priority: integer('priority').default(3).notNull(),
  dueDate: timestamp('due_date'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Booking-related tables

// Services that can be booked
export const services = pgTable('services', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  duration: integer('duration').notNull(), // in minutes
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  maxAdvanceBookingDays: integer('max_advance_booking_days').default(30),
  minAdvanceBookingHours: integer('min_advance_booking_hours').default(24),
  bufferTimeBefore: integer('buffer_time_before').default(0), // in minutes
  bufferTimeAfter: integer('buffer_time_after').default(0), // in minutes
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Form configurations for booking forms
export const bookingForms = pgTable('booking_forms', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateFormId()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  // Form editor configuration
  formConfig: json('form_config'), // Full form editor state: serviceTree, baseQuestions, etc.
  theme: text('theme').default('light'), // light | dark
  primaryColor: text('primary_color').default('#3B82F6'),
  // Legacy fields for backward compatibility  
  fields: json('fields'), // Array of FormFieldConfig objects (legacy)
  serviceId: text('service_id')
    .references(() => services.id, { onDelete: 'cascade' }), // Legacy reference
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
})

// Note: Availability is managed through Simpro API, not stored locally

// Individual bookings - redesigned with denormalized service data
export const bookings = pgTable('bookings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  formId: text('form_id')
    .references(() => bookingForms.id, { onDelete: 'set null' }),
  
  // Service Information (Denormalized from form config)
  serviceName: text('service_name').notNull(),
  serviceDescription: text('service_description'),
  serviceDuration: integer('service_duration').notNull(), // minutes
  servicePrice: decimal('service_price', { precision: 10, scale: 2 }).notNull(),
  
  // Customer Information
  customerId: text('customer_id')
    .references(() => user.id, { onDelete: 'set null' }),
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  customerCompany: text('customer_company'),
  
  // Scheduling (all times stored in UTC)
  bookingStartAt: timestamp('booking_start_at').notNull(), // UTC timestamp
  bookingEndAt: timestamp('booking_end_at').notNull(), // UTC timestamp
  customerTimezone: text('customer_timezone').notNull(), // e.g., 'America/New_York'
  
  // Employee Assignment (denormalized)
  assignedEmployeeId: text('assigned_employee_id')
    .references(() => organizationEmployees.id, { onDelete: 'set null' }),
  assignedEmployeeName: text('assigned_employee_name'),
  assignedEmployeeEmail: text('assigned_employee_email'),
  
  // Form Responses (Structured JSON)
  formResponses: json('form_responses').notNull().$type<{
    contactInfo?: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      company?: string;
    };
    address?: {
      street: string;
      street2?: string;
      city: string;
      state: string;
      zip: string;
      country?: string;
    };
    customQuestions: Array<{
      questionId: string;
      questionText: string;
      questionType: string;
      answer: any;
      fieldName: string;
    }>;
    serviceQuestions?: Array<{
      questionId: string;
      questionText: string;
      questionType: string;
      answer: any;
    }>;
  }>(),
  
  // Status Management
  status: text('status').default('pending').notNull(), // pending, confirmed, cancelled, completed, no-show
  statusChangedAt: timestamp('status_changed_at'),
  statusChangedBy: text('status_changed_by')
    .references(() => user.id, { onDelete: 'set null' }),
  cancellationReason: text('cancellation_reason'),
  
  // Notes
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  
  // Metadata
  confirmationCode: text('confirmation_code').notNull(),
  bookingSource: text('booking_source').default('web').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  // Timestamps
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Booking status change log for audit trail
export const bookingStatusHistory = pgTable('booking_status_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  bookingId: text('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  reason: text('reason'),
  notes: text('notes'),
  changedBy: text('changed_by')
    .references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Employee management tables for Simpro integration

// Organization-specific employee selections from Simpro
export const organizationEmployees = pgTable('organization_employees', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  // Simpro employee data
  simproEmployeeId: integer('simpro_employee_id').notNull(),
  simproEmployeeName: text('simpro_employee_name').notNull(),
  simproEmployeeEmail: text('simpro_employee_email'),
  isEnabled: boolean('is_enabled').default(false).notNull(), // Available for bookings in JoeyJob
  isRemoved: boolean('is_removed').default(false).notNull(), // No longer exists in Simpro
  // Sync metadata
  lastSyncAt: timestamp('last_sync_at'),
  syncError: text('sync_error'),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Service-specific employee assignments
export const serviceEmployees = pgTable('service_employees', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  serviceId: text('service_id')
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  organizationEmployeeId: text('organization_employee_id')
    .references(() => organizationEmployees.id, { onDelete: 'cascade' })
    .notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Booking employee assignments (tracking who is assigned to each booking)
export const bookingEmployees = pgTable('booking_employees', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  bookingId: text('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull(),
  organizationEmployeeId: text('organization_employee_id')
    .references(() => organizationEmployees.id, { onDelete: 'cascade' })
    .notNull(),
  // Simpro integration data
  simproJobId: integer('simpro_job_id'),
  simproCustomerId: integer('simpro_customer_id'),
  simproScheduleId: integer('simpro_schedule_id'),
  simproSiteId: integer('simpro_site_id'),
  // Status tracking
  simproStatus: text('simpro_status'), // pending, scheduled, completed, cancelled
  simproSyncError: text('simpro_sync_error'),
  lastSimproSync: timestamp('last_simpro_sync'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Provider-specific configuration tables

// Simpro company configuration
export const simproCompanies = pgTable('simpro_companies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull(), // Permanent, non-expiring token
  buildName: text('build_name').notNull(),
  domain: text('domain').notNull(),
  companyId: text('company_id').notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
