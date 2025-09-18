# Subscription Gate Implementation Plan

## Current State Analysis

### 1. Billing & Subscription Infrastructure ✅
- **Database**: `subscription` table with status tracking (active, trialing, past_due, incomplete, etc.)
- **Stripe Integration**: Webhook handler at `/api/stripe/webhook.ts` updates organization plans
- **Plan Configuration**: BILLING_PLANS in `/src/features/billing/lib/plans.config.ts` (Pro and Business tiers)
- **Subscription Hook**: `useSubscription()` provides subscription data throughout the app

### 2. Form Management System ✅
- **Form Enabling**: Forms have `isActive` boolean field in `bookingForms` table
- **Form Editor**: Toggle switch in form editor header (`form-editor-header.tsx`)
- **Hosted Forms**: Route at `/f.$orgSlug.$formSlug.tsx` checks `form.isActive`
- **Embedded Forms**: Route at `/embed.$formId.tsx` checks `form.isActive`
- **Error Handling**: Both routes show "Booking Not Available" for inactive forms

### 3. Current Onboarding Flow ✅
- **Profile Completion**: `/onboarding` route collects firstName/lastName
- **No Subscription Gate**: Users proceed directly after profile completion
- **Webhook Auto-Complete**: Stripe webhook marks onboarding complete when subscription activates

### 4. Sidebar Billing Display ✅
- **Component**: `BillingStatusDisplay` in sidebar
- **Current Behavior**: Only shows alerts for `past_due` or `incomplete` status
- **Missing**: Doesn't show current plan name when active

## Implementation Requirements

### Phase 1: Form Enabling Subscription Gate

#### 1.1 Update Form Toggle Logic
**File**: `/src/features/booking/lib/forms.server.ts`
- Add subscription check in `updateForm` handler when `isActive` is being set to `true`
- Throw error if organization doesn't have active subscription
- Return flag indicating subscription required

#### 1.2 Create Subscription Dialog Component
**New File**: `/src/features/booking/components/subscription-required-dialog.tsx`
- Modal dialog explaining subscription requirement
- Show current plan status
- CTA button to navigate to billing page
- Optional: Show plan comparison

#### 1.3 Update Form Editor Header
**File**: `/src/features/booking/components/form-editor/components/form-editor-header.tsx`
- Check subscription status before enabling form
- Show subscription dialog instead of toggling if no active subscription
- Pass subscription data from parent component

### Phase 2: Hosted/Embedded Form Subscription Check

#### 2.1 Update Server-Side Form Fetching
**File**: `/src/features/booking/lib/forms.server.ts`
- Add `getBookingFormBySlug` and `getBookingForm` functions to check organization subscription
- Return subscription status with form data

#### 2.2 Update Hosted Form Route
**File**: `/src/routes/_booking-form/f.$orgSlug.$formSlug.tsx`
- Check organization subscription status in loader
- Show specific error message if form owner lacks subscription
- Differentiate between inactive form vs subscription issue

#### 2.3 Update Embedded Form Route
**File**: `/src/routes/_booking-form/embed.$formId.tsx`
- Same subscription checks as hosted form
- Return appropriate error for parent window messaging

### Phase 3: Remove Onboarding Subscription Gate

#### 3.1 Update Onboarding Flow
**File**: `/src/features/auth/components/onboarding-form.tsx`
- Remove any subscription-related checks
- Navigate directly to app after profile completion

#### 3.2 Update Authenticated Layout
**File**: `/src/routes/_all-routes/_authenticated.tsx`
- Remove subscription-based redirects from onboarding flow
- Keep subscription fetching for other features

### Phase 4: Enhanced Sidebar Billing Display

#### 4.1 Update Billing Status Display
**File**: `/src/components/billing-status-display.tsx`
- Always show current plan name (not just on errors)
- Add visual indicators for plan status:
  - Green badge for active
  - Yellow badge for trialing
  - Red badge for past_due/incomplete
- Show "Upgrade" button if on Pro plan

#### 4.2 Add Plan Limits Display
- Show usage vs limits for current plan
- Visual progress bars for approaching limits
- Link to billing page for upgrades

## Implementation Steps

### Step 1: Backend Subscription Validation (Priority: High)
1. Create subscription validation utility function
2. Update `updateForm` to check subscription when enabling
3. Update form fetching functions to include subscription status

### Step 2: Frontend Subscription Dialog (Priority: High)
1. Create `SubscriptionRequiredDialog` component
2. Integrate with form editor header
3. Add proper error handling and user feedback

### Step 3: Public Form Subscription Check (Priority: High)
1. Update loader functions for hosted/embedded routes
2. Create subscription-specific error components
3. Test with various subscription states

### Step 4: Remove Onboarding Gate (Priority: Medium)
1. Clean up onboarding component
2. Update navigation flow
3. Test new user experience

### Step 5: Enhance Sidebar Display (Priority: Low)
1. Redesign billing status component
2. Add plan details and usage metrics
3. Improve visual hierarchy

## Error States & User Messaging

### Form Enabling Attempt Without Subscription
- **Title**: "Subscription Required"
- **Message**: "You need an active subscription to enable booking forms. Upgrade your plan to start accepting bookings."
- **CTA**: "View Plans" → `/billing`

### Hosted/Embedded Form - No Subscription
- **Title**: "Booking Temporarily Unavailable"
- **Message**: "This booking form is temporarily unavailable. Please contact the business directly to schedule your appointment."
- **Note**: Don't expose internal subscription status to customers

### Sidebar Billing Alerts
- **Past Due**: "Payment failed. Update your payment method to restore service."
- **Incomplete**: "Complete your subscription setup to activate all features."
- **Trial Ending**: "Your trial ends in X days. Upgrade to continue."

## Testing Scenarios

1. **New User Flow**
   - Sign up → Complete profile → Access app without subscription
   - Attempt to enable form → Show subscription dialog
   - Subscribe → Successfully enable form

2. **Subscription States**
   - Active subscription: All features work
   - Past due: Show warnings, block form enabling
   - Cancelled: Block form enabling, existing forms stay active until period end
   - No subscription: Block form enabling completely

3. **Public Form Access**
   - Active subscription + Active form: Works normally
   - Active subscription + Inactive form: "Form not active"
   - No/Expired subscription: "Booking unavailable"

## Database Migrations

No database schema changes required. Using existing fields:
- `bookingForms.isActive` - Form enabled status
- `subscription.status` - Subscription state
- `organization.currentPlan` - Cached plan name

## API Changes

### Modified Endpoints
- `updateForm`: Add subscription validation
- `getBookingFormBySlug`: Include subscription check
- `getBookingForm`: Include subscription check

### New Response Fields
```typescript
{
  form: {...},
  organization: {...},
  subscriptionStatus: 'active' | 'past_due' | 'incomplete' | 'none',
  canEnableForms: boolean
}
```

## Security Considerations

1. **Public Routes**: Never expose detailed subscription status to public users
2. **Permission Checks**: Maintain existing organization membership checks
3. **Webhook Security**: Stripe webhook signature validation already in place
4. **Cache Invalidation**: Clear subscription cache on status changes

## Rollback Plan

1. Feature flag for subscription gating (environment variable)
2. Keep existing form enabling logic as fallback
3. Database changes are additive only (no destructive changes)
4. Can disable checks server-side without client updates

## Success Metrics

- Conversion rate: Free users → Paid subscriptions
- Form activation rate after subscription
- Support ticket reduction for billing issues
- User satisfaction with clearer messaging

## Timeline Estimate

- Phase 1 (Form Enabling Gate): 2-3 hours
- Phase 2 (Public Form Checks): 2-3 hours
- Phase 3 (Remove Onboarding Gate): 1 hour
- Phase 4 (Sidebar Enhancement): 2-3 hours
- Testing & QA: 2-3 hours

**Total: 10-13 hours**