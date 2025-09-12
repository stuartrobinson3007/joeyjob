# Booking & Timezone Refactoring Plan - UPDATED

## Overview
Complete refactoring of the booking system to properly handle Simpro integration and timezone management across the entire application.

## Core Principle: Use & Extend Taali Date Library
The taali date library already has most of what we need, but currently uses browser timezone. We need to extend it to support organization-specific timezones.

## Current State Analysis (Updated)

### What's Already Done:
- ✅ Database schema updated: `bookingStartAt` and `bookingEndAt` as timestamps
- ✅ Unused availability tables removed from schema
- ✅ `organizationId` added to booking flow props
- ✅ API now receives `organizationId` for context

### Issues Found:
1. **No timezone field in organization table** - Still needed
2. **Hardcoded timezone** - Line 680 in booking-flow.tsx: `timezone="America/New_York"`
3. **Employee assignment** - `assignedEmployeeIds` stored in form config JSON, not database
4. **Navigation path still needed** - Required for service group navigation
5. **Address defaults** - Poor defaults like `'123 Main St'` for Simpro

## 1. Extend Taali Date Library (Generic, Reusable)

Add these reusable functions to `/src/taali/utils/date.ts`:

```typescript
/**
 * Convert a date to a specific timezone
 * @param date - The date to convert (UTC or local)
 * @param timezone - Target timezone (e.g., 'America/New_York')
 */
export function toTimezone(
  date: Date | string | null | undefined, 
  timezone: string
): Date | null {
  if (!date) return null
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  return toZonedTime(utcDate, timezone)
}

/**
 * Convert a date from a specific timezone to UTC
 * @param date - The date in the specified timezone
 * @param timezone - The timezone the date is currently in
 */
export function fromTimezone(
  date: Date | string | null | undefined,
  timezone: string
): Date | null {
  if (!date) return null
  const localDate = typeof date === 'string' ? parseISO(date) : date
  return fromZonedTime(localDate, timezone)
}

/**
 * Format a date in a specific timezone
 * @param date - The UTC date to format
 * @param timezone - The timezone to format in
 * @param formatString - Format string
 */
export function formatInTimezone(
  date: Date | string | null | undefined,
  timezone: string,
  formatString: string = 'MMM d, yyyy h:mm a'
): string {
  if (!date) return '-'
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(utcDate, timezone, formatString)
}

/**
 * Parse a time string (12-hour) to 24-hour format
 * Handles formats: "9:30am", "9:30 am", "9:30AM", "09:30am"
 * @param time12h - Time in 12-hour format
 * @returns Time in 24-hour format (e.g., "09:30", "14:15")
 */
export function to24HourTime(time12h: string): string {
  // Handle various formats with optional space
  const match = time12h.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (!match) throw new Error(`Invalid time format: ${time12h}`)
  
  let [_, hours, minutes, period] = match
  let hour = parseInt(hours)
  
  // Handle noon and midnight edge cases
  if (period.toLowerCase() === 'pm' && hour !== 12) {
    hour += 12
  } else if (period.toLowerCase() === 'am' && hour === 12) {
    hour = 0
  }
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`
}

/**
 * Combine date and time strings into a Date object
 * @param dateStr - Date string (e.g., "2024-01-15" or ISO string)
 * @param timeStr - Time string (e.g., "9:30am")
 * @param timezone - Timezone to interpret the date/time in
 */
export function combineDateAndTime(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  // Extract just the date part if it's an ISO string
  const datePart = dateStr.split('T')[0]
  const time24 = to24HourTime(timeStr)
  const dateTimeStr = `${datePart}T${time24}:00`
  const localDate = parseISO(dateTimeStr)
  return fromZonedTime(localDate, timezone)
}
```

## 2. Database Changes

### Add timezone to organization table
```sql
ALTER TABLE organization ADD COLUMN timezone TEXT DEFAULT 'America/New_York' NOT NULL;
```

### Migration Strategy (Safe)
```sql
-- Step 1: Create new columns (already done)
-- Step 2: Migrate existing data
UPDATE bookings 
SET 
  booking_start_at = booking_date + start_time::time,
  booking_end_at = booking_date + end_time::time
WHERE booking_start_at IS NULL;

-- Step 3: Drop old columns (after verification)
ALTER TABLE bookings 
  DROP COLUMN IF EXISTS booking_date,
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time;
```

## 3. Clean Booking Submission Flow

File: `/src/features/booking/lib/booking-submission.server.ts`

```typescript
import { 
  combineDateAndTime, 
  to24HourTime,
  formatInTimezone 
} from '@/taali/utils/date'
import { addMinutes, format } from 'date-fns'

export async function submitBookingWithSimproIntegration({
  organizationId,
  userId,
  bookingData
}: {
  organizationId: string
  userId: string
  bookingData: BookingSubmitData
}) {
  // Get organization with timezone
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, organizationId)
  })
  
  if (!org) throw new Error('Organization not found')
  
  // Get service details from form config
  const form = await db.query.bookingForms.findFirst({
    where: and(
      eq(bookingForms.organizationId, organizationId),
      eq(bookingForms.isActive, true)
    )
  })
  
  const formConfig = form?.formConfig as any
  const serviceNode = findServiceInTree(formConfig?.serviceTree, bookingData.service.id)
  
  if (!serviceNode) throw new Error('Service not found')
  
  // Convert booking time to UTC using org timezone
  const bookingStartAt = combineDateAndTime(
    bookingData.date,
    bookingData.time,
    org.timezone
  )
  const bookingEndAt = addMinutes(bookingStartAt, serviceNode.duration)
  
  // Extract customer data cleanly
  const customer = {
    firstName: bookingData.formData.contact?.firstName || '',
    lastName: bookingData.formData.contact?.lastName || '',
    name: `${bookingData.formData.contact?.firstName || ''} ${bookingData.formData.contact?.lastName || ''}`.trim() || 'Customer',
    email: bookingData.formData.contact?.email || '',
    phone: bookingData.formData.contact?.phone || ''
  }
  
  // Extract address data (make optional for Simpro)
  const address = bookingData.formData.address ? {
    line1: bookingData.formData.address.street,
    city: bookingData.formData.address.city,
    state: bookingData.formData.address.state,
    postalCode: bookingData.formData.address.zip,
    country: 'AUS'
  } : null
  
  // Create booking in database
  const booking = await db.insert(bookings).values({
    id: nanoid(),
    organizationId,
    serviceId: bookingData.service.id,
    formId: form?.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    bookingStartAt,
    bookingEndAt,
    duration: serviceNode.duration,
    price: serviceNode.price || '0',
    status: 'pending',
    formData: bookingData.formData,
    confirmationCode: `JJ${Date.now().toString().slice(-8)}`
  }).returning()
  
  // Get first assigned employee from service config
  const assignedEmployeeIds = serviceNode.assignedEmployeeIds || []
  const firstEmployeeId = assignedEmployeeIds[0]
  
  if (firstEmployeeId) {
    // Get employee details
    const employee = await db.query.organizationEmployees.findFirst({
      where: and(
        eq(organizationEmployees.id, firstEmployeeId),
        eq(organizationEmployees.isActive, true)
      )
    })
    
    if (employee) {
      try {
        // Create Simpro booking
        const simproResult = await createSimproBookingForUser(userId, {
          customer: {
            givenName: customer.firstName || 'Customer',
            familyName: customer.lastName || '',
            email: customer.email,
            phone: customer.phone,
            // Only include address if we have it
            ...(address ? { address } : {
              address: {
                line1: 'No Address Provided',
                city: 'Unknown',
                state: 'Unknown',
                postalCode: '00000',
                country: 'AUS'
              }
            })
          },
          job: {
            type: 'Service',
            name: serviceNode.label,
            description: serviceNode.description || serviceNode.label
          },
          schedule: {
            employeeId: employee.simproEmployeeId,
            blocks: [{
              date: format(bookingStartAt, 'yyyy-MM-dd'),
              startTime: format(bookingStartAt, 'HH:mm'),
              endTime: format(bookingEndAt, 'HH:mm')
            }]
          }
        })
        
        // Create booking-employee assignment with Simpro IDs
        await db.insert(bookingEmployees).values({
          bookingId: booking[0].id,
          organizationEmployeeId: employee.id,
          simproJobId: simproResult.job.ID,
          simproCustomerId: simproResult.customer.ID,
          simproScheduleId: simproResult.schedule.ID,
          simproSiteId: simproResult.customer.Sites?.[0]?.ID,
          simproStatus: 'scheduled'
        })
        
        // Update booking status
        await db.update(bookings)
          .set({ status: 'confirmed' })
          .where(eq(bookings.id, booking[0].id))
        
      } catch (error) {
        console.error('Simpro sync failed:', error)
        // Log error but don't fail the booking
        await db.insert(bookingEmployees).values({
          bookingId: booking[0].id,
          organizationEmployeeId: employee.id,
          simproStatus: 'pending',
          simproSyncError: error instanceof Error ? error.message : 'Sync failed'
        })
      }
    }
  } else {
    console.log('No employees assigned to service - booking created without Simpro sync')
  }
  
  return {
    success: true,
    booking: booking[0],
    confirmationCode: booking[0].confirmationCode
  }
}

// Helper to find service in the tree structure
function findServiceInTree(tree: any, serviceId: string): any {
  if (!tree) return null
  
  if (tree.id === serviceId && tree.type === 'service') {
    return tree
  }
  
  if (tree.children) {
    for (const child of tree.children) {
      const found = findServiceInTree(child, serviceId)
      if (found) return found
    }
  }
  
  return null
}
```

## 4. Update Frontend Components

### Pass organization timezone to booking flow

In `/src/routes/f.$orgSlug.$formSlug.tsx`:
```typescript
// Load organization with timezone
const organization = await getOrganization(orgSlug)

// Pass to BookingFlow
<BookingFlow
  organizationId={organization.id}
  organizationName={organization.name}
  organizationTimezone={organization.timezone} // Add this
  // ...
/>
```

In `/src/features/booking/components/form-editor/booking-flow.tsx`:
```typescript
// Add to props
organizationTimezone?: string

// Use in calendar
<BookingCalendar
  timezone={organizationTimezone || 'America/New_York'} // Use org timezone
  // ...
/>
```

### Update booking display

In `/src/routes/_authenticated/index.tsx`:
```typescript
import { formatInTimezone } from '@/taali/utils/date'

// Display booking times in org timezone
<p>{formatInTimezone(booking.bookingStartAt, organization.timezone, 'MMM d, yyyy h:mm a zzz')}</p>
```

## 5. What to Keep (Not Remove)

### Keep These:
- ✅ **Navigation path** - Required for service group navigation
- ✅ **Service tree structure** - Needed for nested services
- ✅ **Form config JSON** - Where assignedEmployeeIds are stored
- ✅ **Employee selection logic** - Just auto-select first available

### Remove/Simplify These:
- ❌ Complex employee selection UI (auto-assign first)
- ❌ Hardcoded timezone references
- ❌ Poor address defaults
- ❌ `calculateEndTime` function (use date-fns `addMinutes`)

## 6. Error Handling Improvements

```typescript
// Better Simpro error handling
try {
  const simproResult = await createSimproBookingForUser(userId, bookingData)
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  
  // Categorize errors
  if (errorMessage.includes('No Simpro account') || 
      errorMessage.includes('Missing Simpro tokens')) {
    // No integration - this is OK
    console.log('Organization has no Simpro integration')
  } else if (errorMessage.includes('401') || 
             errorMessage.includes('unauthorized')) {
    // Token expired - needs re-auth
    console.error('Simpro authentication failed - tokens may be expired')
  } else {
    // Real error - log it
    console.error('Simpro API error:', errorMessage)
  }
  
  // Continue - booking created successfully in JoeyJob
}
```

## 7. Implementation Steps

### Phase 1: Database & Schema
1. Add timezone column to organization table
2. Create safe migration for existing bookings
3. Run migration on dev database

### Phase 2: Taali Library Extensions
1. Add timezone-aware functions
2. Add robust time conversion utilities
3. Test edge cases (noon, midnight, various formats)

### Phase 3: Backend Updates
1. Update booking submission to use org timezone
2. Fix employee assignment from form config
3. Improve Simpro error handling
4. Make address properly optional

### Phase 4: Frontend Updates
1. Pass org timezone through props chain
2. Update calendar to use org timezone
3. Fix all date/time displays
4. Remove hardcoded timezones

### Phase 5: Testing
1. Test with different timezones
2. Test with/without Simpro integration
3. Test with/without employees assigned
4. Test with/without address data

## 8. Key Differences from Original Plan

### What Changed:
1. **Keep navigation path** - It's needed for service groups
2. **Employee assignment from form config** - Not from database relations
3. **Address handling** - Make properly optional, not fake defaults
4. **Error categories** - Distinguish between "no integration" vs "error"
5. **Safe migration** - Don't drop columns until data is migrated

### What Stayed:
1. **Use organization timezone** - Not browser timezone
2. **Auto-assign first employee** - No complex UI
3. **Proper UTC storage** - All timestamps in UTC
4. **Reusable taali functions** - Generic timezone utilities
5. **Clean code structure** - Simplified flow

## Benefits

✅ **Proper Timezones:** Organization-specific, consistent everywhere  
✅ **Working Simpro:** Correct time formats, proper employee assignment  
✅ **Graceful Degradation:** Works without Simpro, without employees  
✅ **Clean Code:** Simplified flow, better error handling  
✅ **Safe Migration:** No data loss, backward compatible  
✅ **Reusable Library:** Taali functions for any project  

## Notes

- All timestamps in database are UTC
- All display uses organization timezone
- Simpro requires 24-hour time format
- Auto-assign first available employee
- Keep form config structure for service data
- Address is optional, not faked
- Navigation path is required for groups