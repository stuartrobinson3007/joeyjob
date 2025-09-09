# JoeyJob Authentication System

## Overview

JoeyJob implements a secure authentication system that integrates **Simpro OAuth2** with **Supabase server sessions**. This hybrid approach provides the best of both worlds: leveraging Simpro as the primary identity provider while maintaining robust session management through Supabase.

**Key Feature**: The system supports multi-tenant authentication where users can specify their Simpro build name and domain to connect to their specific Simpro instance.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Supabase Edge   │    │   Supabase      │
│   (React)       │    │   Functions      │    │   Database      │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Build Selector│───▶│ Token Exchange   │───▶│ • auth.users    │
│ • Login Form    │    │ User Creation    │    │ • simpro_users  │
│ • Auth Context  │◀───│ Session Creation │◀───│ • RLS Policies  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  Dynamic Simpro │    │   localStorage   │
│  OAuth2 URLs    │    │  (Simpro tokens) │
│ <build>.domain  │    │  (Build config)  │
└─────────────────┘    └──────────────────┘
```

## Multi-Tenant Build Selection

### Build URL Format
All Simpro client build URLs follow this pattern:
- **Default**: `<buildname>.simprosuite.com`
- **Alternative**: `<buildname>.simprocloud.com`

### User Experience
1. **Build Selection Screen**: Users enter their company's build name and select domain
2. **URL Construction**: System constructs the appropriate OAuth2 URLs dynamically
3. **Configuration Storage**: Build configuration is stored for subsequent requests

### Example Build Configurations
```typescript
// Example: Company "acme" using default domain
{
  buildName: "acme",
  domain: "simprosuite.com",
  baseUrl: "https://acme.simprosuite.com"
}

// Example: Company "widgets" using alternative domain
{
  buildName: "widgets", 
  domain: "simprocloud.com",
  baseUrl: "https://widgets.simprocloud.com"
}
```

## Authentication Flow

### 1. Build Selection Process

1. **User accesses login page**
   - Presented with build name input field
   - Domain selector dropdown (.simprosuite.com / .simprocloud.com)
   - "Connect to Simpro" button

2. **Build URL Validation**
   - System constructs base URL from input
   - Optional: Validate build exists (ping OAuth endpoint)
   - Store build configuration for session

3. **OAuth2 URL Construction**
   - Authorization URL: `https://{buildName}.{domain}/oauth2/login`
   - Token URL: `https://{buildName}.{domain}/oauth2/token`
   - API Base URL: `https://{buildName}.{domain}`

### 2. OAuth2 Authentication Process

1. **User clicks "Login with Simpro"**
   - Redirects to dynamically constructed Simpro OAuth2 authorization URL
   - URL: `https://{buildName}.{domain}/oauth2/login`
   - Parameters: `client_id`, `redirect_uri`, `response_type=code`

2. **Simpro OAuth2 Authorization**
   - User authenticates with their build-specific Simpro credentials
   - Simpro redirects back with authorization code
   - Redirect URL: `http://localhost:3000/auth/simpro/callback?code=...`

3. **Authorization Code Exchange**
   - Frontend calls `simpro-token-exchange` Edge Function
   - **New**: Passes build configuration along with authorization code
   - Edge Function securely exchanges code for Simpro access/refresh tokens
   - **Security**: Client secret never exposed to frontend

4. **User Creation & Session Generation**
   - Frontend calls `simpro-create-user` Edge Function with Simpro access token
   - **New**: Includes build configuration for API calls
   - Edge Function:
     - Fetches user profile from build-specific Simpro API (`{baseUrl}/api/v1.0/currentUser/`)
     - Creates/finds corresponding Supabase auth user
     - Links Simpro user to Supabase user in `simpro_users` table
     - **New**: Stores build configuration in user record
     - Generates valid Supabase session tokens
     - Returns session data to frontend

5. **Session Establishment**
   - Frontend receives session tokens
   - Calls `supabase.auth.setSession()` to establish authenticated session
   - **New**: Stores build configuration in localStorage for API calls
   - User is now logged in with both Simpro and Supabase sessions

### 3. Session Management

- **Supabase Sessions**: Handle authentication state, JWT tokens, automatic refresh
- **Simpro Tokens**: Stored in localStorage for API calls to Simpro
- **Build Configuration**: Stored with tokens for subsequent API calls
- **Dual Token System**: Maintains access to both Simpro data and Supabase features

### 4. Logout Process

- Calls `supabase.auth.signOut()` to clear Supabase session
- Clears Simpro tokens and build configuration from localStorage
- Redirects to build selection page

## Technical Implementation

### Edge Functions

#### `simpro-token-exchange`
**Purpose**: Securely exchange authorization codes for Simpro tokens

**Input**:
```json
{
  "authorization_code": "abc123...",
  "build_config": {
    "buildName": "acme",
    "domain": "simprosuite.com",
    "baseUrl": "https://acme.simprosuite.com"
  }
}
```

**Process**:
1. Validates authorization code and build configuration
2. Constructs token URL from build configuration
3. Makes secure POST request to build-specific Simpro token endpoint
4. Uses server-side client secret (never exposed to frontend)
5. Returns Simpro access/refresh tokens

**Output**:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "token_type": "bearer"
}
```

#### `simpro-create-user`
**Purpose**: Create Supabase user and session from Simpro authentication

**Input**:
```json
{
  "access_token": "simpro_access_token...",
  "build_config": {
    "buildName": "acme",
    "domain": "simprosuite.com",
    "baseUrl": "https://acme.simprosuite.com"
  }
}
```

**Process**:
1. Fetch Simpro user profile using access token from build-specific API
2. Check if user exists in `simpro_users` table
3. Create Supabase auth user if needed (with placeholder email)
4. Link Simpro user to Supabase user with build information
5. Generate temporary password and sign in user
6. Return Supabase session tokens

**Output**:
```json
{
  "session": {
    "access_token": "supabase_jwt...",
    "refresh_token": "...",
    "expires_at": 1234567890,
    "user": { ... }
  },
  "user": {
    "id": "uuid...",
    "auth_user_id": "uuid...",
    "simpro_id": "13",
    "name": "Stuart Robinson",
    "email": "simpro13@users.joeyjob.com",
    "build_name": "acme",
    "build_domain": "simprosuite.com"
  }
}
```

#### `simpro-refresh-token`
**Purpose**: Refresh expired Simpro tokens securely

**Input**:
```json
{
  "refresh_token": "simpro_refresh_token...",
  "build_config": {
    "buildName": "acme",
    "domain": "simprosuite.com",
    "baseUrl": "https://acme.simprosuite.com"
  }
}
```

**Output**: New Simpro token set

### Database Schema

#### `simpro_users` Table
```sql
CREATE TABLE simpro_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simpro_id TEXT NOT NULL,
    email TEXT,
    name TEXT,
    auth_user_id UUID, -- Links to auth.users
    build_name TEXT NOT NULL, -- The Simpro build name (e.g., "acme")
    build_domain TEXT NOT NULL, -- The domain (e.g., "simprosuite.com")
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(simpro_id, build_name, build_domain) -- Ensure unique users per build
);
```

#### Row Level Security (RLS)
```sql
-- Users can only access their own data
CREATE POLICY "Users can read their own data" ON simpro_users
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own data" ON simpro_users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Service role can manage all users (for Edge Functions)
CREATE POLICY "Service role can manage all users" ON simpro_users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

### Frontend Components

#### `SimproAuthContext`
**Purpose**: Centralized authentication state management

**State**:
- `tokens`: Simpro access/refresh tokens
- `session`: Supabase session
- `user`: User data from `simpro_users` table
- `buildConfig`: Current build configuration
- `isLoading`: Loading state

**Methods**:
- `login(tokens, buildConfig)`: Establish authentication with both systems
- `logout()`: Clear all authentication state
- `setBuildConfig(config)`: Update build configuration

#### `SimprobuildSelector`
**Purpose**: Allow users to input their build name and select domain

```tsx
interface BuildConfig {
  buildName: string;
  domain: 'simprosuite.com' | 'simprocloud.com';
  baseUrl: string;
}

const BuildSelector = () => {
  const [buildName, setBuildName] = useState('');
  const [domain, setDomain] = useState<'simprosuite.com' | 'simprocloud.com'>('simprosuite.com');
  
  const handleConnect = () => {
    const config: BuildConfig = {
      buildName,
      domain,
      baseUrl: `https://${buildName}.${domain}`
    };
    // Store config and redirect to OAuth
  };
};
```

#### `SimproLoginButton`
**Purpose**: Initiate OAuth2 flow with dynamic build configuration

```tsx
const handleLogin = (buildConfig: BuildConfig) => {
    const loginUrl = getLoginUrl(buildConfig);
    window.location.href = loginUrl;
};
```

#### `SimproCallback`
**Purpose**: Handle OAuth2 redirect and complete authentication

**Process**:
1. Extract authorization code from URL
2. Retrieve stored build configuration
3. Exchange code for Simpro tokens (with build config)
4. Create Supabase user and session (with build config)
5. Update auth context
6. Redirect to authenticated area

## Security Features

### 1. Client Secret Protection
- **Problem**: OAuth2 client secrets must never be exposed to frontend
- **Solution**: All token exchanges happen in Edge Functions with build-specific URLs
- **Benefit**: Secure server-side handling of sensitive credentials across all builds

### 2. Build Configuration Validation
- **Problem**: Malicious build names could be used for attacks
- **Solution**: Input validation and optional build existence verification
- **Benefit**: Prevents unauthorized access attempts

### 3. Multi-Tenant Data Isolation
- **Problem**: Users from different builds shouldn't access each other's data
- **Solution**: Build information stored with user records and used in API calls
- **Benefit**: Complete data isolation between different Simpro builds

### 4. Placeholder Email System
- **Problem**: Simpro doesn't provide email addresses
- **Solution**: Generate placeholder emails (`simpro{ID}@{buildName}.joeyjob.com`)
- **Benefit**: Satisfies Supabase auth requirements while maintaining build isolation

### 5. Row Level Security
- **Problem**: Users shouldn't access other users' data
- **Solution**: RLS policies restrict access to own records only
- **Benefit**: Database-level security enforcement

### 6. Session Management
- **Problem**: Manual token handling is error-prone
- **Solution**: Leverage Supabase's built-in session management
- **Benefit**: Automatic token refresh, secure storage, logout handling

### 7. Dynamic URL Construction
- **Problem**: Hard-coded URLs don't support multi-tenant architecture
- **Solution**: Runtime URL construction based on user input
- **Benefit**: Support for any Simpro build while maintaining security

## Environment Variables

### Frontend (`.env.development`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SIMPRO_CLIENT_ID=e8f01dd5fc3d81e54a2342e0b543c2
VITE_APP_REDIRECT_URI=http://localhost:3000/auth/simpro/callback
# Note: No build-specific URLs needed - constructed dynamically
```

### Backend (Supabase Secrets)
```env
SIMPRO_CLIENT_ID=e8f01dd5fc3d81e54a2342e0b543c2
SIMPRO_CLIENT_SECRET=54d707809c
APP_REDIRECT_URI=http://localhost:3000/auth/simpro/callback
# Note: Token URLs and API URLs constructed dynamically from build config
```

## Error Handling

### Common Issues & Solutions

1. **Invalid Build Names**
   - **Problem**: Users enter non-existent build names
   - **Solution**: Validation and helpful error messages
   - **UX**: Clear instructions and examples

2. **Authorization Code Reuse**
   - **Problem**: OAuth2 codes can only be used once
   - **Solution**: Processing guards in callback component
   - **Prevention**: `useRef` to prevent duplicate processing

3. **Build-Specific API Errors**
   - **Problem**: Different builds may have different API versions
   - **Solution**: Robust error handling for build-specific quirks
   - **Monitoring**: Log build information with errors

4. **Session Creation Failures**
   - **Problem**: Various Supabase API endpoint issues
   - **Solution**: Robust error handling and fallback approaches
   - **Monitoring**: Comprehensive logging in Edge Functions

5. **RLS Policy Mismatches**
   - **Problem**: Incorrect column references in policies
   - **Solution**: Proper `auth_user_id` column usage
   - **Testing**: Verify policies match actual data structure

6. **Token Expiration**
   - **Problem**: Both Simpro and Supabase tokens expire
   - **Solution**: Automatic refresh mechanisms with build configuration
   - **UX**: Graceful re-authentication prompts

## Deployment

### Edge Functions
```bash
# Deploy all functions (they now support dynamic build configurations)
supabase functions deploy

# Deploy specific function
supabase functions deploy simpro-create-user
```

### Database Migrations
```bash
# Apply migrations (includes build columns)
supabase db push
```

### Environment Setup
```bash
# Set secrets (no build-specific URLs needed)
supabase secrets set SIMPRO_CLIENT_SECRET=your-secret
```

## Monitoring & Debugging

### Logs Access
- **Supabase Dashboard**: Real-time function logs with build information
- **Console Logging**: Comprehensive debug information including build config
- **Error Tracking**: Structured error responses with build context

### Common Debug Steps
1. Check Edge Function logs for build-specific errors
2. Verify environment variables are set
3. Confirm build configuration is valid
4. Test OAuth URLs with specific build
5. Validate build-specific API responses
6. Confirm RLS policies allow access
7. Test token validity and expiration

## Future Enhancements

### Potential Improvements
1. **Build Discovery**: Automatic build detection from email domains
2. **Build Validation**: Real-time verification of build existence
3. **Multi-build Support**: Allow users to access multiple builds
4. **Build Analytics**: Monitor usage patterns per build
5. **Enhanced Error Recovery**: Build-specific fallback mechanisms
6. **Cache Build Configurations**: Improve performance for repeated access

## Conclusion

This enhanced multi-tenant authentication system provides a secure, scalable foundation for JoeyJob's diverse client base. By supporting dynamic build selection while maintaining security best practices, the system can accommodate any Simpro client while ensuring complete data isolation and robust authentication.

The modular design allows for future enhancements while maintaining backward compatibility and security standards across all supported Simpro builds. 