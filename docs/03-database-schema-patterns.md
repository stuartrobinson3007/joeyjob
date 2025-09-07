# Database Schema & Patterns Implementation Guide

This document provides comprehensive guidance for implementing database schemas and patterns using Drizzle ORM with PostgreSQL, focusing on multi-tenant architecture, relationship management, and type-safe database operations.

## 🚨 Critical Rules

- **ALWAYS use Drizzle ORM** - Never write raw SQL queries
- **MUST include schema in database connection** - Required for type safety and relations
- **ALWAYS use consistent timestamp patterns** - Use `.defaultNow().notNull()` for all timestamps
- **NEVER bypass foreign key constraints** - All relationships must be properly constrained
- **MUST scope data by organization** - All user data MUST include organizationId

## ❌ Common AI Agent Mistakes

### Database Connection Without Schema
```typescript
// ❌ NEVER create database connection without schema
import { drizzle } from 'drizzle-orm/postgres-js'
export const db = drizzle(client) // Missing schema - breaks type safety!
```

### Inconsistent Timestamp Patterns
```typescript
// ❌ NEVER mix timestamp default patterns
createdAt: timestamp('created_at').$defaultFn(() => new Date()) // Wrong
createdAt: timestamp('created_at').defaultNow()                // Missing .notNull()
createdAt: timestamp('created_at').notNull()                   // Missing default
```

### Missing Foreign Key Constraints
```typescript
// ❌ NEVER create relationships without proper constraints
organizationId: text('organization_id').notNull() // Missing .references()

// ❌ NEVER use inconsistent onDelete behaviors without reason
userId: text('user_id').references(() => user.id) // Missing onDelete constraint
```

### Multi-Tenancy Violations
```typescript
// ❌ NEVER create user data without organization scoping
export const userPosts = pgTable('user_posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  title: text('title').notNull(),
  // Missing organizationId - security vulnerability!
})
```

## ✅ Established Patterns

### 1. **Database Connection with Schema**
```typescript
// File: src/lib/db/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '@/database/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })
export { client }
```

### 2. **Core Authentication Schema**
```typescript
// File: src/database/schema.ts
import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

// User table - Better Auth compatible
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(),
  
  // Additional user fields
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  language: text('language').default('en').notNull(),
  
  // Consistent timestamp pattern
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Account table - Better Auth OAuth accounts
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

// Session table - Better Auth session management
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

// Verification table - Better Auth email verification
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 3. **Multi-Tenancy Schema**
```typescript
// Organization table - Multi-tenancy root
export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),

  // Billing integration
  currentPlan: text('current_plan').default('free').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  planLimits: jsonb('plan_limits').$type<{
    todos?: number
    members?: number
    storage?: number
  }>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: text('metadata'),
})

// Member table - Organization membership
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

// Invitation table - Team member invitations
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
```

### 4. **Feature Data Schema (Todos Example)**
```typescript
// Todos table - Organization-scoped user data
export const todos = pgTable('todos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  description: text('description'),
  
  // REQUIRED: Organization scoping
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  
  // User relationships with different cascade behaviors
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  assignedTo: text('assigned_to')
    .references(() => user.id, { onDelete: 'set null' }), // Keep todo if assignee deleted
  
  // Feature-specific fields
  completed: boolean('completed').default(false).notNull(),
  priority: integer('priority').default(3).notNull(),
  dueDate: timestamp('due_date'),
  
  // Consistent timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 5. **Billing Schema (Stripe Integration)**
```typescript
// Subscription table - Better Auth Stripe integration
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull(), // Organization ID
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').default('incomplete'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  seats: integer('seats'),
  
  // Additional Stripe fields for compatibility
  userId: text('user_id').references(() => user.id),
  stripePriceId: text('stripe_price_id'),
  stripeCurrentPeriodEnd: timestamp('stripe_current_period_end'),
  stripeCurrentPeriodStart: timestamp('stripe_current_period_start'),
  stripeCancelAt: timestamp('stripe_cancel_at'),
  stripeCancelAtPeriodEnd: boolean('stripe_cancel_at_period_end'),
  stripeTrialStart: timestamp('stripe_trial_start'),
  stripeTrialEnd: timestamp('stripe_trial_end'),
  limits: jsonb('limits'), // Plan limits (todos, members, storage)
  metadata: jsonb('metadata'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

## 🔧 Step-by-Step Implementation

### 1. Database Configuration
```typescript
// File: drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
    schema: 'public'
  },
  schemaFilter: 'public',
  tablesFilter: '*',
  verbose: true,
  strict: true,
  breakpoints: true
} satisfies Config
```

### 2. Creating New Feature Tables
```typescript
// ALWAYS follow this pattern for new feature tables
export const newFeature = pgTable('new_feature', {
  // Primary key
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  
  // Feature-specific fields
  title: text('title').notNull(),
  description: text('description'),
  
  // REQUIRED: Organization scoping
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  
  // User relationships
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Optional user relationships (decide cascade behavior)
  assignedTo: text('assigned_to')
    .references(() => user.id, { onDelete: 'set null' }),
  
  // REQUIRED: Consistent timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 3. Database Queries with Type Safety
```typescript
// File: src/features/todos/lib/todos.server.ts
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'

// ALWAYS include organization scoping in queries
export const getTodos = async (organizationId: string) => {
  return await db
    .select()
    .from(todos)
    .where(eq(todos.organizationId, organizationId))
    .orderBy(desc(todos.createdAt))
}

// ALWAYS validate organization access in mutations
export const createTodo = async (data: CreateTodoInput, organizationId: string, userId: string) => {
  return await db
    .insert(todos)
    .values({
      title: data.title,
      description: data.description,
      organizationId, // REQUIRED
      createdBy: userId, // REQUIRED
      completed: false,
    })
    .returning()
}

// ALWAYS scope updates and deletes by organization
export const deleteTodo = async (todoId: string, organizationId: string) => {
  return await db
    .delete(todos)
    .where(and(
      eq(todos.id, todoId),
      eq(todos.organizationId, organizationId) // REQUIRED for security
    ))
}
```

## 🎯 Integration Requirements

### With Better Auth
```typescript
// Database adapter configuration
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db/db'
import * as schema from '@/database/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema, // MUST include schema for proper table mapping
  }),
})
```

### With Migrations
```bash
# Generate migration
pnpm drizzle-kit generate

# Run migrations
pnpm drizzle-kit migrate

# View migrations
pnpm drizzle-kit up
```

### With Development Tools
```bash
# Database studio
pnpm drizzle-kit studio

# Push schema changes (development only)
pnpm drizzle-kit push
```

## 🧪 Testing Requirements

### Database Testing Setup
```typescript
// File: src/test/db-setup.ts
import { beforeEach, afterEach } from 'vitest'
import { db, client } from '@/lib/db/db'

beforeEach(async () => {
  // Start transaction for test isolation
  await db.execute('BEGIN')
})

afterEach(async () => {
  // Rollback transaction
  await db.execute('ROLLBACK')
})
```

### Query Testing Patterns
```typescript
// Test organization scoping
import { describe, it, expect } from 'vitest'
import { getTodos, createTodo } from './todos.server'

describe('getTodos', () => {
  it('should only return todos for the specified organization', async () => {
    // Create todos in different organizations
    await createTodo({ title: 'Org 1 Todo' }, 'org1', 'user1')
    await createTodo({ title: 'Org 2 Todo' }, 'org2', 'user1')
    
    const org1Todos = await getTodos('org1')
    const org2Todos = await getTodos('org2')
    
    expect(org1Todos).toHaveLength(1)
    expect(org2Todos).toHaveLength(1)
    expect(org1Todos[0].title).toBe('Org 1 Todo')
  })
})
```

## 📋 Implementation Checklist

Before considering database implementation complete, verify:

- [ ] **Schema Import**: Database connection includes schema parameter
- [ ] **Timestamp Consistency**: All timestamps use `.defaultNow().notNull()`
- [ ] **Foreign Key Constraints**: All relationships properly constrained
- [ ] **Organization Scoping**: All user data includes organizationId
- [ ] **Better Auth Compatibility**: User/account/session tables match requirements
- [ ] **Migration Configuration**: Drizzle config properly set up
- [ ] **Type Safety**: All queries use proper Drizzle operators
- [ ] **Cascade Behaviors**: onDelete behaviors are intentional and consistent
- [ ] **Primary Keys**: All tables have appropriate primary key strategy
- [ ] **Index Strategy**: Performance-critical queries have appropriate indexes

## 🚀 Advanced Patterns

### Complex Queries with Joins
```typescript
// Multi-table queries with proper typing
export const getTodosWithAssignees = async (organizationId: string) => {
  return await db
    .select({
      todo: todos,
      assignee: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      creator: {
        id: user.id,
        name: user.name,
      }
    })
    .from(todos)
    .leftJoin(user, eq(todos.assignedTo, user.id))
    .leftJoin(user, eq(todos.createdBy, user.id))
    .where(eq(todos.organizationId, organizationId))
}
```

### Batch Operations with Transactions
```typescript
// Transaction for atomic operations
export const bulkCreateTodos = async (
  todoData: CreateTodoInput[],
  organizationId: string,
  userId: string
) => {
  return await db.transaction(async (tx) => {
    const results = []
    
    for (const data of todoData) {
      const result = await tx
        .insert(todos)
        .values({
          ...data,
          organizationId,
          createdBy: userId,
        })
        .returning()
      
      results.push(result[0])
    }
    
    return results
  })
}
```

### JSONB Field Usage
```typescript
// Typed JSONB fields
export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  preferences: jsonb('preferences').$type<{
    theme: 'light' | 'dark'
    notifications: {
      email: boolean
      push: boolean
    }
    language: string
  }>(),
})

// Query JSONB fields
const settingsWithDarkTheme = await db
  .select()
  .from(settings)
  .where(
    and(
      eq(settings.organizationId, orgId),
      eq(settings.preferences.theme, 'dark')
    )
  )
```

This database architecture provides a robust foundation for multi-tenant SaaS applications with proper data isolation, type safety, and scalability considerations.