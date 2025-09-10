import { pgTable, text, timestamp, boolean, integer, json, decimal } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

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
  // SimPro-specific fields
  simproId: text('simpro_id'),
  simproBuildName: text('simpro_build_name'),
  simproDomain: text('simpro_domain'),
  simproCompanyId: text('simpro_company_id'),
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
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
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
    .$defaultFn(() => nanoid()),
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
})

// Availability patterns (recurring availability rules)
export const availabilityPatterns = pgTable('availability_patterns', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: text('service_id')
    .references(() => services.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6, Sunday=0
  startTime: text('start_time').notNull(), // HH:mm format
  endTime: text('end_time').notNull(), // HH:mm format
  isActive: boolean('is_active').default(true).notNull(),
  effectiveFrom: timestamp('effective_from').notNull(),
  effectiveUntil: timestamp('effective_until'),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Specific availability overrides (exceptions to patterns)
export const availabilityOverrides = pgTable('availability_overrides', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: text('service_id')
    .references(() => services.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),
  startTime: text('start_time'), // null means unavailable all day
  endTime: text('end_time'),
  isAvailable: boolean('is_available').notNull(),
  reason: text('reason'),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Individual bookings
export const bookings = pgTable('bookings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: text('service_id')
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  formId: text('form_id')
    .references(() => bookingForms.id, { onDelete: 'set null' }),
  // Customer information (can be guest or registered user)
  customerId: text('customer_id')
    .references(() => user.id, { onDelete: 'set null' }),
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  // Booking details
  bookingDate: timestamp('booking_date').notNull(),
  startTime: text('start_time').notNull(), // HH:mm format
  endTime: text('end_time').notNull(), // HH:mm format
  duration: integer('duration').notNull(), // in minutes
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  // Status management
  status: text('status').default('pending').notNull(), // pending, confirmed, cancelled, completed, no-show
  cancellationReason: text('cancellation_reason'),
  notes: text('notes'),
  internalNotes: text('internal_notes'), // Staff-only notes
  // Form submission data
  formData: json('form_data'), // Customer's form responses
  // Metadata
  source: text('source').default('web').notNull(), // web, api, admin, etc.
  confirmationCode: text('confirmation_code').notNull(),
  reminderSent: boolean('reminder_sent').default(false),
  reminderSentAt: timestamp('reminder_sent_at'),
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
