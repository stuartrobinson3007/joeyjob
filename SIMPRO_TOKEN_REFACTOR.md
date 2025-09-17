# Simpro Token Architecture Refactor - Implementation Plan

## Overview
Complete refactor to separate user authentication from API access tokens. Simpro API tokens will be stored at the organization level in a dedicated table, not per-user.

## Database Changes

### 1. Create New `simpro_companies` Table
```typescript
// src/database/schema.ts
export const simproCompanies = pgTable('simpro_companies', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull(), // Permanent, non-expiring token
  buildName: text('build_name').notNull(),
  domain: text('domain').notNull(),
  companyId: text('company_id').notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

### 2. Update `accounts` Table
- Remove `accessToken` column
- Remove `refreshToken` column  
- Remove `accessTokenExpiresAt` column
- Remove `refreshTokenExpiresAt` column
- Keep only Better Auth session fields

### 3. Update `organizations` Table
- Remove `providerData` column (data moves to `simpro_companies`)
- Keep `providerType` to identify which provider
- Keep `providerCompanyId` for reference

## File Changes

### Phase 1: Database Schema

#### `src/database/schema.ts`
- Add `simproCompanies` table definition
- Remove token fields from `accounts` table
- Remove `providerData` from `organizations` table

### Phase 2: Simpro API Layer

#### `src/lib/simpro/simpro.server.ts`
```typescript
// REWRITE getSimproApiForOrganization()
export async function getSimproApiForOrganization(organizationId: string) {
  // Get Simpro configuration from simpro_companies table
  const simproConfig = await db
    .select()
    .from(simproCompanies)
    .where(eq(simproCompanies.organizationId, organizationId))
    .limit(1)

  if (!simproConfig.length) {
    throw new Error('No Simpro configuration found for organization')
  }

  const { accessToken, buildName, domain } = simproConfig[0]

  // No token refresh needed - permanent token
  return createSimproApi(
    accessToken,
    '', // No refresh token needed
    buildName,
    domain
  )
}

// REMOVE updateUserSimproTokens() - no longer needed
// REMOVE createTokenRefreshCallback() - no longer needed
```

#### `src/lib/simpro/simpro-api.ts`
- Remove token refresh logic from `refreshAccessToken()` method
- Simplify `makeRequest()` to not handle 401 token refresh
- Remove `onTokenRefresh` callback parameter throughout

### Phase 3: Provider Services

#### `src/lib/providers/simpro-info.service.ts`
```typescript
// Simplify constructor - no token refresh
constructor(
  accessToken: string,
  buildConfig: {
    buildName: string
    domain: string
    baseUrl: string
  }
) {
  this.buildConfig = buildConfig
  this.simproApi = createSimproApi(
    accessToken,
    '', // No refresh token
    buildConfig.buildName,
    buildConfig.domain
  )
}
```

#### `src/lib/providers/provider-registry.ts`
- Remove `onTokenRefresh` parameter from all methods
- Simplify `createProviderInfoService()` signature

### Phase 4: Employee Management

#### `src/lib/employees/employee-management.server.ts`
```typescript
export const syncEmployeesFromProvider = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const organizationId = context.organizationId

    // Get organization provider type
    const org = await db.select().from(organization)...

    // Get Simpro config from new table
    const simproConfig = await db
      .select()
      .from(simproCompanies)
      .where(eq(simproCompanies.organizationId, organizationId))
      .limit(1)

    if (!simproConfig.length) {
      throw new Error('Simpro not configured for organization')
    }

    const { accessToken, buildName, domain } = simproConfig[0]

    const buildConfig = {
      buildName,
      domain,
      baseUrl: `https://${buildName}.${domain}`
    }

    // Sync employees using permanent token
    const syncedEmployees = await employeeSyncService.syncEmployeesFromProvider(
      organizationId,
      org.providerType,
      accessToken,
      '', // No refresh token
      buildConfig
    )
    
    return { employees: syncedEmployees }
  })
```

#### `src/lib/employees/employee-sync.service.ts`
- Remove `userId` parameter from `syncEmployeesFromProvider()`
- Remove `refreshToken` parameter usage

### Phase 5: Authentication

#### `src/lib/auth/simpro-oauth.ts`
```typescript
// Simplify OAuth callback - just authenticate user, don't store API tokens
export async function handleSimproCallback(code: string) {
  // Exchange code for tokens (for authentication only)
  const tokens = await exchangeCodeForTokens(code)
  
  // Get user info to create/update Better Auth session
  const userInfo = await getSimproUserInfo(tokens.access_token)
  
  // Create Better Auth session (no provider tokens stored)
  return createUserSession(userInfo)
}
```

#### `src/lib/auth/auth.ts`
- Update Better Auth configuration if needed
- Remove provider token storage logic

### Phase 6: Booking & Availability

#### `src/features/booking/lib/booking-submission.server.ts`
- Update to use `getSimproApiForOrganization()` without userId
- Remove token refresh handling

#### `src/lib/simpro/availability.server.ts`
- Update all functions to use organization-level tokens

#### `src/lib/simpro/booking-employee-selection.server.ts`
- Update to use new token source

### Phase 7: Admin Features

#### Create `src/routes/admin/simpro-config.tsx`
```typescript
// Admin page to manage Simpro tokens
export function SimproConfig() {
  // UI to:
  // - View current Simpro configuration
  // - Update access token
  // - Update build/domain if needed
  // - Test connection
}
```

### Phase 8: Cleanup

#### Files to Update
- `src/lib/providers/organization-data.server.ts` - Use new table
- `src/lib/providers/onboarding-setup.server.ts` - Simplify setup
- `src/features/onboarding/components/provider-update-modal.tsx` - Update UI
- All API routes using Simpro - Remove userId from API calls

#### Files to Remove/Simplify
- `src/lib/simpro/token-refresh.server.ts` - Can be removed
- `scripts/test-token-refresh.cjs` - No longer needed

## Environment Variables

### Update `.env`
```bash
# Remove (no longer needed after initial setup)
SIMPRO_ACCESS_TOKEN=xxx

# Keep for OAuth flow (user authentication only)
SIMPRO_CLIENT_ID=xxx
SIMPRO_CLIENT_SECRET=xxx
```

## Implementation Order

1. **Database First**
   - Create new schema with `simproCompanies` table
   - Update existing tables
   - Clear database as mentioned

2. **Core API Layer**
   - Update `simpro.server.ts` to use new table
   - Simplify `simpro-api.ts` (remove refresh logic)

3. **Provider Services**
   - Update provider registry and services
   - Remove token refresh callbacks

4. **Employee Sync**
   - Update to use organization-level tokens
   - Test sync functionality

5. **Authentication**
   - Simplify OAuth to just authenticate users
   - Stop storing API tokens

6. **Features**
   - Update booking submission
   - Update availability checks
   - Update all Simpro API calls

7. **Admin Tools**
   - Create token management UI
   - Add connection testing

8. **Cleanup**
   - Remove deprecated code
   - Update documentation

## Testing Plan

1. Clear database completely
2. Set up new organization
3. Add Simpro configuration manually (access token, build, domain)
4. Test employee sync
5. Test booking creation
6. Test availability checks
7. Verify no token refresh attempts

## Benefits

- **Simpler architecture** - No token refresh complexity
- **Organization-level API access** - Not tied to individual users
- **Cleaner separation** - User auth vs API access
- **Easier debugging** - One permanent token per org
- **Better security** - API tokens not exposed to client
- **Extensible** - Easy to add other providers with different auth models