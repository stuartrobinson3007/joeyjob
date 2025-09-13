# Provider-Agnostic Onboarding Flow Implementation Plan

## Overview

This document outlines the implementation plan for creating a provider-agnostic onboarding flow that initially supports Simpro and is designed to easily support Minuba and other providers in the future.

## Current State Analysis

### Database Structure
- **User table**: Contains Simpro-specific fields (`simproId`, `simproBuildName`, `simproDomain`, `simproCompanyId`)
- **Organization table**: Has basic fields (`name`, `timezone`, `logo`) but missing standard company fields
- **Provider System**: Well-designed interface exists with `AuthProvider` and registry
- **Current Onboarding**: Only handles user profile completion, doesn't sync provider data

### Key Problems to Solve
1. Simpro data stored on user instead of organization (company data belongs to organization)
2. Missing standard organization fields that all providers should populate
3. No handling for multi-company Simpro builds
4. No provider data sync during onboarding

## Implementation Plan

### 1. Database Schema Updates

#### Remove from User Table
```sql
-- Remove Simpro-specific fields from user table
ALTER TABLE user DROP COLUMN simpro_id;
ALTER TABLE user DROP COLUMN simpro_build_name;
ALTER TABLE user DROP COLUMN simpro_domain;
ALTER TABLE user DROP COLUMN simpro_company_id;
```

#### Add to Organization Table
```sql
-- Standard company fields (provider-agnostic)
ALTER TABLE organization ADD COLUMN phone text;
ALTER TABLE organization ADD COLUMN email text;
ALTER TABLE organization ADD COLUMN website text;
ALTER TABLE organization ADD COLUMN currency text;
ALTER TABLE organization ADD COLUMN address_street text;
ALTER TABLE organization ADD COLUMN address_city text;
ALTER TABLE organization ADD COLUMN address_state text;
ALTER TABLE organization ADD COLUMN address_postal_code text;
ALTER TABLE organization ADD COLUMN address_country text;

-- Provider-specific fields
ALTER TABLE organization ADD COLUMN provider_type text; -- 'simpro', 'minuba', etc.
ALTER TABLE organization ADD COLUMN provider_company_id text; -- Company ID from provider
ALTER TABLE organization ADD COLUMN provider_data json; -- Provider-specific data
ALTER TABLE organization ADD COLUMN onboarding_completed boolean DEFAULT false;
```

### 2. Provider Info Service Architecture

#### Abstract Interface
```typescript
interface ProviderInfoService {
  getCompanyInfo(companyId?: string): Promise<CompanyInfo>
  getCompanies(): Promise<CompanyInfo[]>
  getEmployees(companyId?: string): Promise<Employee[]>
  syncCompanyData(organizationId: string, companyId?: string): Promise<void>
}

interface CompanyInfo {
  // Standard fields
  id: string
  name: string
  phone?: string
  email?: string
  website?: string
  currency?: string
  timezone?: string
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  
  // Provider-specific data
  providerData: Record<string, any>
}
```

#### Simpro Implementation
- Fetch from `/api/v1.0/info/` and `/api/v1.0/companies/`
- Handle single-company (ID: 0) vs multi-company builds
- Map Simpro fields to standard organization fields
- Store Simpro-specific data in `providerData`:
  - `EIN`, `CompanyNo`, `Licence`, `Banking`
  - `UIDateFormat`, `UITimeFormat`, `ScheduleFormat`
  - `MultiCompany`, `SharedCatalog`, etc.

### 3. Multi-Company Organization Handling

#### OAuth Callback Enhancement
1. After successful OAuth, determine provider type
2. Fetch all companies user has access to via provider service
3. For each company:
   - Create organization record if doesn't exist
   - Populate standard fields from provider data
   - Set user as owner/admin
   - Store provider-specific data in JSON field

#### Organization Creation Logic
```typescript
async function createOrganizationsFromProvider(
  userId: string, 
  providerType: string,
  accessToken: string
) {
  const providerService = getProviderService(providerType)
  const companies = await providerService.getCompanies()
  
  for (const company of companies) {
    const existingOrg = await findOrganizationByProviderCompanyId(
      providerType, 
      company.id
    )
    
    if (!existingOrg) {
      await createOrganization({
        name: company.name,
        phone: company.phone,
        email: company.email,
        website: company.website,
        currency: company.currency,
        timezone: company.timezone,
        addressStreet: company.address?.street,
        addressCity: company.address?.city,
        addressState: company.address?.state,
        addressPostalCode: company.address?.postalCode,
        addressCountry: company.address?.country,
        providerType,
        providerCompanyId: company.id,
        providerData: company.providerData,
        onboardingCompleted: false
      })
    }
    
    // Add user as member/owner
    await addUserToOrganization(userId, organization.id, 'owner')
  }
}
```

### 4. Updated Onboarding Flow

#### Flow Steps
1. **Profile Setup** (existing)
   - User completes first/last name if `user.onboardingCompleted` is false
   
2. **Organization Selection** (existing functionality)
   - If user has multiple organizations, show selection screen
   - This automatically happens via existing organization switching logic
   
3. **Company Data Sync Confirmation** (NEW)
   - Show if selected organization has `onboardingCompleted: false`
   - Display company info pulled from provider
   - Two-button choice: confirm or report issues

4. **Complete Onboarding**
   - Mark `organization.onboardingCompleted = true`
   - Redirect to dashboard

#### Route Structure
```
/onboarding (existing - user profile)
  ↓
/select-organization (existing - if multiple orgs)
  ↓  
/company-setup (NEW - provider data confirmation)
  ↓
/ (dashboard)
```

### 5. UI Components

#### Company Data Confirmation Screen
Based on provided mockup:
```typescript
// CompanyDataConfirmation.tsx
interface CompanyDataConfirmationProps {
  organization: Organization
  employees: Employee[]
  onConfirm: () => void
  onReportIssue: () => void
}
```

**Display Elements:**
- Company name
- Full address
- Timezone
- Employee list
- "Yes, this is all correct" button (blue)
- "No, something is wrong" button (gray)

#### Provider Update Instructions Modal
```typescript
// ProviderUpdateModal.tsx
interface ProviderUpdateModalProps {
  providerType: string
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}
```

**Content:**
- Instructions for updating data in provider system
- "Refresh" button to re-sync data
- Provider-specific help text

### 6. Implementation Order

1. **Database Migration**
   - Create migration to add new organization fields
   - Remove Simpro fields from user table
   
2. **Provider Service Layer**
   - Create abstract `ProviderInfoService` interface
   - Implement `SimproInfoService` 
   - Add to dependency injection/service registry

3. **Multi-Company Organization Creation**
   - Update OAuth callback to create organizations
   - Add organization lookup by provider company ID
   
4. **UI Components**
   - Build `CompanyDataConfirmation` component
   - Build `ProviderUpdateModal` component
   
5. **Onboarding Route Updates**
   - Add `/onboarding/company-sync` route
   - Update existing routes to handle new flow
   
6. **Testing & Integration**
   - Test with single-company Simpro builds  
   - Test with multi-company Simpro builds
   - Verify employee data sync
   - Test error handling and refresh flows

## Future Extensibility

### Minuba Integration
When ready to add Minuba:
1. Implement `MinubaInfoService` following same interface
2. Update OAuth callback to handle 'minuba' provider type
3. Map Minuba company fields to standard organization fields
4. Store Minuba-specific data in `providerData` JSON
5. No changes needed to UI components or onboarding flow

### Additional Providers
Same pattern applies for any future provider integration.

## Technical Notes

### Data Migration
Existing users with Simpro data will need a migration to:
1. Create organization records from their Simpro company data
2. Move user-level Simpro fields to organization-level
3. Add user as owner of created organizations

### Error Handling
- Network failures during provider data sync
- Invalid/expired provider tokens
- Provider API changes or unavailability
- Multi-company access permission changes

### Security Considerations
- Validate all provider data before storing
- Sanitize company information display
- Ensure proper authorization for organization access
- Secure storage of provider-specific sensitive data

## Success Metrics

- Successful onboarding completion rate
- Time to complete onboarding process
- User satisfaction with company data accuracy
- Reduction in support tickets for incorrect company information
- Easy extension to additional providers (measured by development time)