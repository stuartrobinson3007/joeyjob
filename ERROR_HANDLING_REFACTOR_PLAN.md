# Error Handling Refactoring Plan

## Overview

This document outlines a comprehensive plan to refactor the entire codebase to implement the standardized error handling system defined in `ERROR_HANDLING_GUIDE.md`. The refactoring will ensure consistent, type-safe, and user-friendly error handling across all layers of the application.

## Current State Analysis

### Error Handling Patterns Found

| Pattern | File Count | Description |
|---------|------------|-------------|
| Try/catch blocks | 39 files | Inconsistent error handling with various patterns |
| Manual error throwing | 21 files | Mix of `Error`, `AppError`, and custom errors |
| Toast notifications | 22 files | Direct `toast.error()` calls without centralization |
| Query/mutation errors | 45 files | Inconsistent `onError` callbacks |
| API route errors | 5 files | Non-standard `Response.json()` error responses |
| Server function errors | 6 files | Missing error middleware |

## Files Requiring Refactoring

### 1. Server Functions (`*.server.ts`)

#### High Priority - Core Business Logic
| File | Current Issues | Required Changes |
|------|---------------|------------------|
| `/src/features/todos/lib/todos.server.ts` | Uses basic `AppError`, inconsistent patterns | • Implement full `ApiError` class<br>• Add validation error transformation<br>• Use error middleware wrapper |
| `/src/features/todos/lib/todos-table.server.ts` | Missing error handling | • Add error middleware<br>• Implement pagination error handling<br>• Add field validation |
| `/src/features/team/lib/team.server.ts` | Basic error throwing | • Use `ApiError` for all errors<br>• Add permission errors<br>• Implement invitation errors |
| `/src/features/organization/lib/members.server.ts` | Inconsistent error messages | • Standardize member errors<br>• Add role validation errors<br>• Implement permission checks |
| `/src/features/organization/lib/onboarding.server.ts` | Missing validation | • Add validation errors<br>• Implement state transition errors<br>• Add completion checks |
| `/src/features/billing/lib/billing.server.ts` | Try/catch without transformation | • Add Stripe error transformation<br>• Implement limit exceeded errors<br>• Add subscription state errors |

### 2. API Routes (`/api/*.ts`)

| File | Current Issues | Required Changes |
|------|---------------|------------------|
| `/src/routes/api/avatars/upload.ts` | Generic error responses | • Use `ApiError.validation()` for file validation<br>• Add size limit errors<br>• Implement upload progress errors |
| `/src/routes/api/avatars/$.ts` | Missing error handling | • Add not found errors<br>• Implement access permission checks<br>• Add stream errors |
| `/src/routes/api/stripe/webhook.ts` | Basic try/catch | • Add webhook signature validation errors<br>• Implement event processing errors<br>• Add idempotency handling |
| `/src/routes/api/health.ts` | Simple error response | • Implement service-specific health checks<br>• Add dependency errors<br>• Return structured health status |

### 3. Authentication Components

| File | Current Issues | Required Changes |
|------|---------------|------------------|
| `/src/features/auth/components/magic-link-sign-in.tsx` | Direct toast.error | • Use `useSafeMutation`<br>• Add rate limiting errors<br>• Implement email validation |
| `/src/features/auth/components/github-sign-in.tsx` | No error handling | • Add OAuth error handling<br>• Implement state validation<br>• Add provider errors |
| `/src/features/auth/components/google-sign-in.tsx` | No error handling | • Add OAuth error handling<br>• Implement scope errors<br>• Add token errors |
| `/src/features/auth/components/otp-sign-in.tsx` | Basic toast.error | • Add OTP validation errors<br>• Implement expiry errors<br>• Add rate limiting |
| `/src/features/auth/components/onboarding-form.tsx` | Inline error handling | • Use `FormFieldError` components<br>• Add step validation<br>• Implement progress errors |
| `/src/features/auth/components/organization-switcher.tsx` | Missing error handling | • Add organization access errors<br>• Implement switching errors<br>• Add loading states |

### 4. Main Application Routes

| File | Current Issues | Required Changes |
|------|---------------|------------------|
| `/src/routes/_authenticated.tsx` | Basic error handling | • Add error boundary<br>• Implement auth errors<br>• Add navigation errors |
| `/src/routes/_authenticated/profile.tsx` | Try/catch in mutations | • Use `useSafeMutation`<br>• Add profile validation<br>• Implement avatar errors |
| `/src/routes/_authenticated/team.tsx` | Multiple toast.error calls | • Centralize error handling<br>• Add invitation errors<br>• Implement role errors |
| `/src/routes/_authenticated/onboarding.tsx` | Inline error handling | • Add step validation<br>• Implement completion errors<br>• Add navigation guards |
| `/src/routes/_authenticated/billing.tsx` | Missing error handling | • Add subscription errors<br>• Implement payment errors<br>• Add plan limit errors |
| `/src/routes/_authenticated/superadmin/*.tsx` | No error handling | • Add admin permission errors<br>• Implement data access errors<br>• Add audit errors |
| `/src/routes/invite.$invitationId.tsx` | Complex error flows | • Simplify with `ApiError`<br>• Add invitation validation<br>• Implement expiry errors |
| `/src/routes/auth/signin.tsx` | Basic error handling | • Use centralized auth errors<br>• Add provider errors<br>• Implement rate limiting |

### 5. Feature Components

| File | Current Issues | Required Changes |
|------|---------------|------------------|
| `/src/features/todos/components/todos-table-page.tsx` | Direct error handling | • Use `useSafeMutation` for all actions<br>• Add bulk operation errors<br>• Implement selection errors |
| `/src/features/billing/components/billing-page.tsx` | Stripe error handling | • Transform Stripe errors<br>• Add subscription state errors<br>• Implement portal errors |
| `/src/features/organization/components/organization-switcher.tsx` | Missing error handling | • Add switching errors<br>• Implement permission errors<br>• Add loading states |
| `/src/features/admin/components/super-admin-wrapper.tsx` | No error boundary | • Add error boundary<br>• Implement admin errors<br>• Add fallback UI |
| `/src/components/avatar-upload-dialog.tsx` | Complex try/catch | • Use `useSafeMutation`<br>• Add file validation errors<br>• Implement upload progress |
| `/src/components/app-sidebar.tsx` | Missing error handling | • Add navigation errors<br>• Implement loading errors<br>• Add permission checks |
| `/src/components/user-tile.tsx` | No error handling | • Add user data errors<br>• Implement avatar errors<br>• Add loading states |

### 6. Middleware

| File | Current Issues | Required Changes |
|------|---------------|------------------|
| `/src/features/organization/lib/organization-middleware.ts` | Silent error swallowing | • Use `ApiError` for validation<br>• Add organization access errors<br>• Implement proper logging |
| `/src/features/billing/lib/billing-middleware.ts` | Missing error handling | • Add subscription validation<br>• Implement limit checks<br>• Add payment errors |
| `/src/lib/auth/auth-middleware.ts` | Basic error handling | • Use standardized auth errors<br>• Add session validation<br>• Implement token errors |

### 7. Utility Functions & Hooks

| File | Current Issues | Required Changes |
|------|---------------|------------------|
| `/src/lib/utils/permissions.ts` | Direct error throwing | • Use `ApiError.permission()`<br>• Add role-based errors<br>• Implement resource errors |
| `/src/lib/hooks/use-table-query.ts` | Missing error handling | • Add query errors<br>• Implement pagination errors<br>• Add filter validation |
| `/src/lib/hooks/use-permissions.ts` | Basic error handling | • Use centralized errors<br>• Add permission caching errors<br>• Implement role errors |
| `/src/lib/storage/*.ts` | No error handling | • Add storage errors<br>• Implement upload errors<br>• Add file validation |

### 8. Database & External Services

| File | Current Issues | Required Changes |
|------|---------------|------------------|
| Database migrations | No error handling | • Add migration errors<br>• Implement rollback errors<br>• Add validation |
| Redis operations | Missing error handling | • Add connection errors<br>• Implement cache errors<br>• Add timeout handling |
| Email service | Basic try/catch | • Add email validation<br>• Implement provider errors<br>• Add rate limiting |

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal**: Set up core error handling infrastructure

1. **Day 1-2**: Core Setup
   - [ ] Create `/src/lib/errors/` directory structure
   - [ ] Implement all error system files from `ERROR_HANDLING_GUIDE.md`
   - [ ] Update `QueryClient` configuration
   - [ ] Add error tracking setup

2. **Day 3-4**: Middleware & Wrappers
   - [ ] Implement `errorMiddleware` for server functions
   - [ ] Create `createServerFn` wrapper
   - [ ] Update authentication middleware
   - [ ] Add organization middleware error handling

3. **Day 5**: Testing Infrastructure
   - [ ] Set up error testing utilities
   - [ ] Create mock error generators
   - [ ] Add error test helpers
   - [ ] Write initial error system tests

### Phase 2: Server-Side Refactoring (Week 2)
**Goal**: Refactor all server functions and API routes

1. **Day 1-2**: Core Server Functions
   - [ ] Refactor `todos.server.ts` with full error system
   - [ ] Update `team.server.ts` with ApiError
   - [ ] Refactor `members.server.ts` with validation
   - [ ] Update `onboarding.server.ts` with state errors

2. **Day 3-4**: API Routes
   - [ ] Refactor avatar upload/download routes
   - [ ] Update Stripe webhook with error transformation
   - [ ] Implement health check errors
   - [ ] Add consistent error responses

3. **Day 5**: Database & External Services
   - [ ] Add database error transformation
   - [ ] Implement Redis error handling
   - [ ] Add email service errors
   - [ ] Update file storage errors

### Phase 3: Client-Side Refactoring (Week 3)
**Goal**: Update all components and hooks

1. **Day 1-2**: Authentication Components
   - [ ] Refactor all auth components with `useSafeMutation`
   - [ ] Add `FormFieldError` to all forms
   - [ ] Implement OAuth error handling
   - [ ] Update onboarding flow errors

2. **Day 3-4**: Feature Components
   - [ ] Update todos components with new hooks
   - [ ] Refactor billing components
   - [ ] Update team management components
   - [ ] Refactor organization components

3. **Day 5**: Common Components
   - [ ] Update `ErrorBoundary` component
   - [ ] Add error boundaries to critical sections
   - [ ] Update avatar upload dialog
   - [ ] Refactor app sidebar

### Phase 4: Testing & Validation (Week 4)
**Goal**: Ensure system works correctly

1. **Day 1-2**: Unit Tests
   - [ ] Test all error classes
   - [ ] Test error transformation
   - [ ] Test error middleware
   - [ ] Test error hooks

2. **Day 3-4**: Integration Tests
   - [ ] Test server function errors
   - [ ] Test API route errors
   - [ ] Test component error handling
   - [ ] Test error recovery flows

3. **Day 5**: E2E & Documentation
   - [ ] E2E tests for error scenarios
   - [ ] Update documentation
   - [ ] Create error code registry
   - [ ] Add developer guidelines

## Migration Checklist

### For Each File:

#### Server Functions
- [ ] Replace `createServerFn` import with error-aware version
- [ ] Replace `throw new Error()` with `throw new ApiError()`
- [ ] Add Zod validation error transformation
- [ ] Add appropriate error codes
- [ ] Test error scenarios

#### React Components
- [ ] Replace `useMutation` with `useSafeMutation`
- [ ] Replace `toast.error()` with error hooks
- [ ] Add `FormFieldError` components
- [ ] Remove try/catch blocks in favor of error hooks
- [ ] Add error boundary where needed

#### API Routes
- [ ] Add error middleware
- [ ] Use consistent error response format
- [ ] Transform external service errors
- [ ] Add request ID tracking
- [ ] Test error responses

## Success Metrics

### Technical Metrics
- [ ] 100% of server functions use `ApiError`
- [ ] All API routes return consistent error format
- [ ] Zero direct `toast.error()` calls
- [ ] All forms use `FormFieldError` components
- [ ] Error boundary coverage for critical paths

### User Experience Metrics
- [ ] All errors show user-friendly messages
- [ ] Validation errors appear inline
- [ ] Network errors are retryable
- [ ] Error actions are clickable
- [ ] No technical details exposed to users

### Developer Experience Metrics
- [ ] TypeScript error types throughout
- [ ] Consistent error patterns
- [ ] Easy to test error scenarios
- [ ] Clear error documentation
- [ ] Debugging information in development

## Risk Mitigation

### Potential Risks
1. **Breaking Changes**: Existing error handling might break
   - **Mitigation**: Implement gradually with feature flags
   
2. **Performance Impact**: Additional error processing overhead
   - **Mitigation**: Optimize error parsing and caching
   
3. **Learning Curve**: Developers need to learn new patterns
   - **Mitigation**: Provide clear documentation and examples
   
4. **Third-party Integration**: External services might not match our format
   - **Mitigation**: Create transformation layers for each service

### Rollback Plan
1. Keep old error handling in place initially
2. Use feature flags to toggle new system
3. Monitor error rates and user feedback
4. Have quick rollback mechanism ready

## Post-Implementation

### Monitoring Setup
1. **Error Tracking Dashboard**
   - Error rate by code
   - Error trends over time
   - User impact metrics
   - Recovery success rates

2. **Alerting**
   - High error rate alerts
   - New error code alerts
   - Failed recovery alerts
   - User report alerts

3. **Analytics**
   - Most common errors
   - Error resolution times
   - User actions on errors
   - Error message effectiveness

### Future Enhancements
1. **Phase 5**: i18n Implementation
   - Add translation keys
   - Implement language detection
   - Create translated messages
   
2. **Phase 6**: Advanced Features
   - Error recovery workflows
   - Smart retry strategies
   - Offline error handling
   - Error reporting UI

## Team Responsibilities

| Team Member | Responsibility | Phase |
|-------------|---------------|-------|
| Backend Lead | Server functions, API routes | Phase 1-2 |
| Frontend Lead | Components, hooks, UI | Phase 3 |
| QA Lead | Testing, validation | Phase 4 |
| DevOps | Monitoring, tracking | Post-implementation |

## Definition of Done

A file is considered "refactored" when:
1. ✅ All errors use `ApiError` or error hooks
2. ✅ Error messages are user-friendly
3. ✅ TypeScript types are correct
4. ✅ Unit tests cover error scenarios
5. ✅ Documentation is updated
6. ✅ Code review approved
7. ✅ No regressions in functionality

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|-------------|
| Week 1 | Foundation | Error system setup, middleware |
| Week 2 | Server-Side | All server functions and APIs refactored |
| Week 3 | Client-Side | All components and hooks updated |
| Week 4 | Testing | Complete test coverage, documentation |
| Week 5 | Deployment | Production rollout, monitoring |

## Conclusion

This comprehensive refactoring will transform the application's error handling from an inconsistent, developer-unfriendly system to a robust, type-safe, and user-centric approach. The investment in this refactoring will pay dividends in:

- **Reduced debugging time** through consistent patterns
- **Improved user experience** with clear, actionable messages
- **Better monitoring** with structured error tracking
- **Easier maintenance** with centralized error definitions
- **Future readiness** for i18n and advanced features

The phased approach ensures minimal disruption while progressively improving the system. Each phase builds on the previous one, allowing for validation and adjustment as needed.