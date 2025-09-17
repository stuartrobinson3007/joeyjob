# Simpro Organization Creation Flow - Complete Implementation Plan

## Overview
Implement a robust organization creation flow where Simpro companies are only created in JoeyJob when users explicitly complete the company onboarding process. This ensures organizations stay up-to-date and provides clear user control.

## Core Principles

1. **On-Demand Creation**: Organizations only created when user completes company setup
2. **Up-to-Date Data**: Fresh fetch from Simpro each time user adds a company
3. **Multi-User Support**: First user becomes owner, subsequent users become members
4. **Clear User Flow**: Obvious path to connect new companies
5. **Manual Sync**: Company data/employees synced manually via settings

## User Flow Scenarios

### **Scenario 1: Brand New Simpro User**

#### **Flow Steps:**
1. **Simpro OAuth Login** → User authenticated, session created
2. **Name Onboarding** → User completes firstName/lastName, `onboardingCompleted: true`
3. **Select Organization Page** → `organizations.length === 0`
4. **"Connect Your First Company" UI** → Prominent CTA to connect Simpro company
5. **Company Selection Flow** → Fetch available companies, user selects one
6. **Organization Creation** → Create org + set permanent token
7. **Company Onboarding** → User completes company-specific setup

#### **UI for Step 4:**
```tsx
<div className="text-center space-y-6">
  <div>
    <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
    <h2>Connect Your First Company</h2>
    <p className="text-muted-foreground">
      Connect to your Simpro company to start managing bookings
    </p>
  </div>
  <Button onClick={startCompanyConnection}>
    <Plus className="w-4 h-4 mr-2" />
    Connect Simpro Company
  </Button>
</div>
```

### **Scenario 2: Existing User Adding New Company**

#### **Flow Steps:**
1. **User in organization selector** → Has existing organizations
2. **"Add Company" button** → Visible in organization list
3. **Company Selection Flow** → Same as new user flow
4. **Check for Duplicates** → Prevent creating duplicate organizations
5. **Organization Creation** → Create additional org
6. **Switch to New Org** → Auto-select newly created organization

#### **UI Addition:**
```tsx
<div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
  <Plus className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
  <h3 className="font-medium">Add Another Company</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Connect another Simpro company to JoeyJob
  </p>
  <Button variant="outline" onClick={startCompanyConnection}>
    Add Simpro Company
  </Button>
</div>
```

### **Scenario 3: Multi-User Company (Second+ User)**

#### **Flow Steps:**
1. **User OAuth login** → User authenticated
2. **Name onboarding** → User completes profile
3. **Company Selection** → User selects company
4. **Check if Organization Exists** → Query for existing org with same Simpro company
5. **If Exists**: Join existing organization as member
6. **If Not Exists**: Create new organization (user becomes owner)

## Company Selection Flow

### **The Core "Connect Company" Process**

#### **Step 1: Fetch Available Companies**
```typescript
const fetchSimproCompanies = async () => {
  try {
    // Get user's OAuth tokens from account table
    const userAccount = await getUserSimproTokens(userId)
    
    // Use tokens to query Simpro for available companies
    const simproApi = createSimproApi(userAccount.accessToken, ...)
    const companies = await simproApi.getCompanies()
    
    return companies
  } catch (error) {
    // Handle token expiry, network issues, etc.
  }
}
```

#### **Step 2: Company Selection UI**
```tsx
<div className="space-y-4">
  <h3>Select Your Simpro Company</h3>
  {companies.map(company => (
    <Card key={company.id} className={cn(
      "cursor-pointer border-2",
      selectedCompany?.id === company.id ? "border-primary" : "border-border"
    )} onClick={() => setSelectedCompany(company)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{company.name}</h4>
            <p className="text-sm text-muted-foreground">
              {company.address?.city}, {company.address?.country}
            </p>
          </div>
          {existingOrgs.includes(company.id) && (
            <Badge variant="outline">Already Connected</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  ))}
  
  <Button 
    onClick={createOrganization} 
    disabled={!selectedCompany || isCreating}
  >
    {isCreating ? 'Creating...' : 'Connect Company'}
  </Button>
</div>
```

#### **Step 3: Organization Creation**
```typescript
const createOrganizationFromSimpro = async (company, userTokens) => {
  // 1. Check if organization already exists
  const existing = await checkExistingOrganization(company.id)
  
  if (existing) {
    // Join existing organization as member
    await addUserToOrganization(userId, existing.id, 'member')
    return existing.id
  }
  
  // 2. Create new organization
  const orgId = await createOrganization({
    name: company.name,
    providerType: 'simpro',
    providerCompanyId: company.id,
    // ... company data
  })
  
  // 3. Set permanent token in simpro_companies table
  await createSimproConfiguration(orgId, {
    accessToken: userTokens.accessToken, // Copy from OAuth
    buildName: userTokens.buildName,
    domain: userTokens.domain,
    companyId: company.id
  })
  
  // 4. Make user the owner
  await addUserToOrganization(userId, orgId, 'owner')
  
  return orgId
}
```

## Edge Cases & Solutions

### **1. Token/Authentication Edge Cases**

#### **OAuth Tokens Expired**
```typescript
const handleTokenExpiry = async () => {
  try {
    // Attempt token refresh
    await refreshUserTokens(userId)
    // Retry company fetch
    return await fetchSimproCompanies()
  } catch (error) {
    // Redirect to re-authenticate
    showError('Please re-authenticate with Simpro to continue')
    navigate({ to: '/auth/signin?provider=simpro' })
  }
}
```

#### **Simpro API Unavailable**
```tsx
{simproError && (
  <Alert variant="warning">
    <AlertDescription>
      Unable to fetch companies from Simpro. You can:
      <div className="mt-2 space-x-2">
        <Button variant="outline" size="sm" onClick={retryFetch}>
          Try Again
        </Button>
        <Button variant="outline" size="sm" onClick={showManualSetup}>
          Manual Setup
        </Button>
      </div>
    </AlertDescription>
  </Alert>
)}
```

### **2. Organization Existence Edge Cases**

#### **Company Already Exists (Multi-User)**
```typescript
const handleExistingOrganization = async (companyId, existingOrg) => {
  // Show confirmation dialog
  const confirmed = await confirm({
    title: 'Join Existing Company',
    description: `${existingOrg.name} is already connected to JoeyJob. Join as a team member?`,
    confirmText: 'Join Company'
  })
  
  if (confirmed) {
    await addUserToOrganization(userId, existingOrg.id, 'member')
    setActiveOrganizationId(existingOrg.id)
    navigate({ to: '/' })
  }
}
```

#### **User Previously Deleted Organization**
```typescript
const handleDeletedOrganization = async (companyId) => {
  // Check soft-deleted organizations
  const deletedOrg = await findDeletedOrganization(companyId, userId)
  
  if (deletedOrg) {
    const restore = await confirm({
      title: 'Restore Previous Company?',
      description: 'You previously connected this company. Restore it?'
    })
    
    if (restore) {
      await restoreOrganization(deletedOrg.id)
      return deletedOrg.id
    }
  }
}
```

### **3. Company Data Edge Cases**

#### **No Companies Found**
```tsx
{companies.length === 0 && (
  <div className="text-center py-8">
    <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
    <h3>No Companies Found</h3>
    <p className="text-muted-foreground mb-4">
      Your Simpro account doesn't have access to any companies, or they're not visible to your user role.
    </p>
    <div className="space-x-2">
      <Button variant="outline" onClick={refreshCompanies}>
        Refresh
      </Button>
      <Button variant="outline" onClick={contactSupport}>
        Contact Support
      </Button>
    </div>
  </div>
)}
```

#### **Company Access Permissions**
```typescript
const validateCompanyAccess = async (company) => {
  try {
    // Test if user can access company data
    await simproApi.getCompanyDetails(company.id)
    return true
  } catch (error) {
    // User lacks permissions for this company
    return false
  }
}
```

### **4. Flow Interruption Edge Cases**

#### **User Abandons Flow**
```typescript
// Store progress in sessionStorage
const saveFlowProgress = (step, data) => {
  sessionStorage.setItem('simpro_flow_progress', JSON.stringify({
    step,
    data,
    timestamp: Date.now()
  }))
}

// Resume on page load
const resumeFlowIfNeeded = () => {
  const saved = sessionStorage.getItem('simpro_flow_progress')
  if (saved) {
    const { step, data, timestamp } = JSON.parse(saved)
    // Resume if less than 1 hour old
    if (Date.now() - timestamp < 3600000) {
      setFlowStep(step)
      setFlowData(data)
    }
  }
}
```

#### **Network Failures During Creation**
```typescript
const createOrganizationWithRetry = async (companyData, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createOrganizationFromSimpro(companyData)
    } catch (error) {
      if (attempt === maxRetries) {
        // Final failure - offer alternatives
        showError('Failed to create organization. Contact support or try manual setup.')
        throw error
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}
```

### **5. Rate Limiting & Performance**

#### **Bulk Company Fetching**
```typescript
const fetchCompaniesWithRateLimit = async () => {
  try {
    // Fetch companies in batches if user has many
    const companies = await simproApi.getCompanies()
    
    if (companies.length > 10) {
      // Show warning about many companies
      showInfo(`Found ${companies.length} companies. This may take a moment to load.`)
    }
    
    // Fetch details in batches to avoid rate limits
    const companyDetails = await batchFetchCompanyDetails(companies, batchSize: 5)
    
    return companyDetails
  } catch (error) {
    if (error.status === 429) {
      showError('Too many requests. Please wait a moment and try again.')
    }
    throw error
  }
}
```

### **6. Data Consistency Edge Cases**

#### **Token Mismatch Between OAuth and Permanent**
```typescript
const syncTokensIfNeeded = async (organizationId, oauthTokens) => {
  const currentConfig = await getSimproConfiguration(organizationId)
  
  // If permanent token fails but OAuth token works, offer to update
  if (currentConfig && !await testConnection(currentConfig.accessToken)) {
    if (await testConnection(oauthTokens.accessToken)) {
      const update = await confirm({
        title: 'Update Access Token?',
        description: 'Current token failed but your login token works. Update?'
      })
      
      if (update) {
        await updateSimproConfiguration(organizationId, {
          ...currentConfig,
          accessToken: oauthTokens.accessToken
        })
      }
    }
  }
}
```

## Implementation Files & Changes

### **1. Update `/select-organization` Page**
- Add "Connect Simpro Company" flow for users with no organizations
- Add "Add Company" option for users with existing organizations
- Handle loading states during company fetching
- Show company selection UI with company cards

### **2. Create Company Connection Service**
```typescript
// File: src/lib/simpro/company-connection.service.ts
export class CompanyConnectionService {
  async getAvailableCompanies(userId: string): Promise<Company[]>
  async createOrganizationFromCompany(userId: string, company: Company): Promise<string>
  async checkExistingOrganization(companyId: string): Promise<Organization | null>
  async addUserToOrganization(userId: string, orgId: string, role: string): Promise<void>
}
```

### **3. Update Organization Setup Service**
- Modify to work with selected companies instead of all companies
- Add duplicate detection logic
- Add multi-user handling

### **4. Error Recovery & Fallbacks**
- Manual organization creation if Simpro fails
- Token refresh flows
- Retry mechanisms
- Graceful degradation

### **5. UI Components**
- Company selection cards
- Loading states for async operations
- Error states with recovery options
- Progress indicators for multi-step flow
- Confirmation dialogs for important actions

## Expected UI Flow

### **Select Organization Page States**

#### **State 1: No Organizations (New User)**
```
┌─────────────────────────────────┐
│  Welcome to JoeyJob!            │
│                                 │
│  [Building Icon]                │
│  Connect Your First Company     │
│  Connect to your Simpro company │
│  to start managing bookings     │
│                                 │
│  [+ Connect Simpro Company]     │
└─────────────────────────────────┘
```

#### **State 2: Has Organizations (Existing User)**
```
┌─────────────────────────────────┐
│  Select Workspace               │
│                                 │
│  ○ Acme Corp (Simpro)          │
│  ○ Tech Solutions (Simpro)     │
│                                 │
│  ┌─────────────────────────┐   │
│  │ [+] Add Another Company │   │
│  │ Connect more Simpro     │   │
│  │ companies to JoeyJob    │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

#### **State 3: Company Selection Flow**
```
┌─────────────────────────────────┐
│  Connect Simpro Company         │
│                                 │
│  Select which company to connect│
│                                 │
│  ☑ Acme Corporation            │
│  │  Sydney, Australia          │
│  │  [Already Connected]        │
│                                 │
│  ○ Tech Solutions Ltd          │
│  │  Melbourne, Australia       │
│                                 │
│  ○ Service Co                  │
│  │  Brisbane, Australia        │
│                                 │
│  [Cancel] [Connect Company]     │
└─────────────────────────────────┘
```

### **Error States**

#### **Simpro Connection Failed**
```tsx
<Alert variant="warning">
  <AlertDescription>
    Unable to connect to Simpro. This could be due to:
    <ul className="list-disc list-inside mt-2 space-y-1">
      <li>Network connectivity issues</li>
      <li>Simpro system maintenance</li>
      <li>Your Simpro access has changed</li>
    </ul>
    <div className="mt-4 space-x-2">
      <Button variant="outline" size="sm" onClick={retryConnection}>
        Try Again
      </Button>
      <Button variant="outline" size="sm" onClick={reauthenticate}>
        Re-authenticate
      </Button>
      <Button variant="outline" size="sm" onClick={contactSupport}>
        Contact Support
      </Button>
    </div>
  </AlertDescription>
</Alert>
```

#### **No Access to Companies**
```tsx
<div className="text-center py-8">
  <Shield className="w-12 h-12 mx-auto text-warning mb-4" />
  <h3>No Companies Available</h3>
  <p className="text-muted-foreground mb-4">
    Your Simpro account doesn't have access to any companies.
  </p>
  <p className="text-sm text-muted-foreground mb-4">
    Please contact your Simpro administrator to grant company access, 
    or check your user permissions in Simpro.
  </p>
  <div className="space-x-2">
    <Button variant="outline" onClick={refreshAccess}>
      Check Again
    </Button>
    <Button variant="outline" onClick={contactSupport}>
      Contact Support
    </Button>
  </div>
</div>
```

## Technical Implementation Details

### **Database Operations**

#### **Check for Existing Organization**
```sql
SELECT id, name FROM organizations 
WHERE provider_company_id = ? AND provider_type = 'simpro'
LIMIT 1
```

#### **Create Organization with Atomic Transaction**
```typescript
await db.transaction(async (tx) => {
  // 1. Create organization
  const org = await tx.insert(organization).values({...}).returning()
  
  // 2. Create simpro configuration
  await tx.insert(simproCompanies).values({
    organizationId: org.id,
    accessToken: userOAuthToken,
    ...buildConfig
  })
  
  // 3. Add user as owner
  await tx.insert(member).values({
    organizationId: org.id,
    userId,
    role: 'owner'
  })
})
```

### **Error Handling Strategy**

#### **Graceful Degradation**
```typescript
const createOrganizationWithFallback = async (companyData) => {
  try {
    // Primary flow: Use OAuth tokens
    return await createFromOAuthTokens(companyData)
  } catch (oauthError) {
    try {
      // Fallback: Manual token entry
      return await createWithManualTokens(companyData)
    } catch (manualError) {
      // Final fallback: Basic org creation
      showError('Company connection failed. Created basic organization.')
      return await createBasicOrganization(companyData)
    }
  }
}
```

#### **Retry Logic with Exponential Backoff**
```typescript
const retryWithBackoff = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries) throw error
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

### **Loading States & UX**

#### **Progressive Loading**
```tsx
{step === 'fetching' && (
  <div className="text-center py-8">
    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
    <h3>Connecting to Simpro...</h3>
    <p className="text-sm text-muted-foreground">
      Fetching your available companies
    </p>
  </div>
)}

{step === 'creating' && (
  <div className="text-center py-8">
    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
    <h3>Setting up {selectedCompany?.name}...</h3>
    <p className="text-sm text-muted-foreground">
      Creating organization and configuring Simpro access
    </p>
  </div>
)}
```

## Security Considerations

### **Token Handling**
- **OAuth tokens**: Stored in account table, used for user auth and initial company setup
- **Permanent tokens**: Stored in simpro_companies table, used for ongoing API access
- **Token validation**: Test both token types during setup
- **Token rotation**: Handle when admin updates permanent tokens

### **Access Control**
- **Company ownership**: First user becomes owner, subsequent users are members
- **Permission inheritance**: Users inherit Simpro permissions within JoeyJob
- **Admin override**: Superadmin can manually configure any organization

### **Data Privacy**
- **Minimal data storage**: Only store necessary company info
- **User consent**: Clear messaging about what data is accessed
- **Audit trail**: Log organization creation and access

## Implementation Priority

### **Phase 1: Core Flow**
1. Restore account table token fields
2. Update select-organization page for empty state
3. Implement company fetching service
4. Add company selection UI

### **Phase 2: Multi-User Support**
1. Add duplicate organization detection
2. Implement join existing organization flow
3. Add member role assignment

### **Phase 3: Error Handling**
1. Add comprehensive error states
2. Implement retry mechanisms
3. Add fallback flows

### **Phase 4: Polish**
1. Add progress indicators
2. Implement flow resumption
3. Add analytics and monitoring

This approach provides maximum robustness while maintaining clear user control over which companies get connected to JoeyJob.