# Scheduling Settings Implementation Plan

## Executive Summary
Currently, only 4 out of 8+ scheduling settings configured in the form editor actually work in live booking forms. This plan outlines the complete implementation to ensure all scheduling settings function properly.

## Current State Analysis

### Working Settings (4/8)
1. **Duration** ✅ - Service completion time (15min-2hrs)
2. **Buffer Time** ✅ - Time before/after bookings  
3. **Minimum Notice** ✅ - Required advance booking time (hours only)
4. **Booking Interval** ✅ - Appointment frequency

### Non-Functional Settings (4+/8)
1. **Date Range Type** ❌ - Rolling/Fixed/Indefinite options
2. **Rolling Days** ❌ - Number of days into future
3. **Rolling Unit** ❌ - Calendar days vs weekdays  
4. **Fixed Start/End Dates** ❌ - Specific date ranges
5. **Minimum Notice Unit** ❌ - Days vs hours selection (only hours work)

## Implementation Plan

## Phase 1: Backend Infrastructure Updates

### 1.1 Update ServiceSettings Interface
**File**: `src/lib/simpro/availability-utils.server.ts`

Expand the `ServiceSettings` interface to include all scheduling fields:
```typescript
export interface ServiceSettings {
    duration: number           // minutes (existing)
    interval: number          // minutes (existing)
    bufferTime: number        // minutes (existing)
    minimumNotice: number     // value (existing)
    minimumNoticeUnit: 'days' | 'hours'  // NEW
    dateRangeType: 'rolling' | 'fixed' | 'indefinite'  // NEW
    rollingDays?: number      // NEW
    rollingUnit?: 'calendar-days' | 'week-days'  // NEW
    fixedStartDate?: string   // ISO date string - NEW
    fixedEndDate?: string     // ISO date string - NEW
}
```

### 1.2 Enhance Availability Calculation Logic
**File**: `src/lib/simpro/availability-optimized.server.ts`

Add date range validation in `getServiceAvailability()`:
- Calculate valid booking window based on `dateRangeType`
- For rolling: Calculate end date as current date + `rollingDays`
- For fixed: Use `fixedStartDate` and `fixedEndDate`
- For indefinite: No date restrictions
- Filter out dates outside the valid range before returning

**File**: `src/lib/simpro/availability-utils.server.ts`

Add new helper functions:
- `calculateBookingWindowDates()` - Determine valid date range
- `isDateWithinBookingWindow()` - Check if date is bookable
- `calculateMinimumBookingTime()` - Handle days vs hours for minimum notice

Update `calculateAvailableSlotsForDate()`:
- Check date against booking window before processing
- Apply minimum notice in correct units (days or hours)
- Skip dates outside rolling/fixed ranges

### 1.3 API Parameter Updates
**File**: `src/routes/api/public/services/$serviceId/availability.ts`

Update the API to handle expanded settings:
- Accept all new `serviceSettings` fields in request body
- Pass complete settings to `getServiceAvailability()`
- Return empty availability for dates outside booking window

## Phase 2: Frontend Integration

### 2.1 BookingFlow Component Updates
**File**: `src/features/booking/components/form-editor/booking-flow.tsx`

Update the `Service` interface:
```typescript
export interface Service extends BookingItem {
    // ... existing fields ...
    minimumNoticeUnit?: 'days' | 'hours';
    dateRangeType?: 'rolling' | 'fixed' | 'indefinite';
    rollingDays?: number;
    rollingUnit?: 'calendar-days' | 'week-days';  // ADD THIS
    fixedStartDate?: string;  // ADD THIS (ISO string)
    fixedEndDate?: string;    // ADD THIS (ISO string)
}
```

Update availability query (lines ~250-260):
- Include all scheduling fields in `serviceSettings` object
- Pass `rollingUnit`, `fixedStartDate`, `fixedEndDate` to API

### 2.2 BookingCalendar Enhancements
**File**: `src/features/booking/components/form-editor/booking-calendar.tsx`

Add props for date range settings:
```typescript
export type BookingCalendarProps = {
    // ... existing props ...
    dateRangeType?: 'rolling' | 'fixed' | 'indefinite';
    rollingDays?: number;
    rollingUnit?: 'calendar-days' | 'week-days';
    fixedStartDate?: Date;
    fixedEndDate?: Date;
    minimumNoticeUnit?: 'days' | 'hours';
    // ... rest of props ...
}
```

Update `isDateDisabled()` function (~line 311):
- Add logic to disable dates outside rolling window
- Disable dates outside fixed date range
- Handle weekdays-only rolling windows
- Apply minimum notice in correct units

### 2.3 Form Data Transformation
**File**: `src/routes/f.$orgSlug.$formSlug.tsx`

Ensure services include all scheduling settings (lines ~113-132):
- Verify all scheduling fields are passed from `formConfig`
- Transform date strings to appropriate formats
- Pass complete settings to BookingFlow component

## Phase 3: User Experience Improvements

### 3.1 Form Editor Enhancements
**File**: `src/features/booking/components/form-editor/views/scheduling-settings-view.tsx`

Add validation and user feedback:
- Validate fixed date ranges (end > start)
- Clear conflicting settings when date range type changes
- Add helper text explaining impact of each setting
- Show preview of booking window based on current settings

### 3.2 Customer Booking Experience
**File**: `src/features/booking/components/form-editor/booking-calendar.tsx`

Improve user messaging:
- Add message when no dates available due to restrictions
- Show "Bookings available from [date] to [date]" for fixed ranges
- Display "Next available date: [date]" when current view has no slots
- Add tooltip on disabled dates explaining why they're unavailable

### 3.3 Edge Case Handling
Consider these scenarios:
- Timezone differences for fixed date ranges
- Month/year transitions for rolling windows
- Weekday-only calculations spanning weekends
- Minimum notice pushing bookings beyond date range

## Phase 4: Testing Strategy

### 4.1 Unit Tests to Add
- Date range calculation functions
- Minimum notice with different units
- Weekday vs calendar day calculations
- Booking window validation

### 4.2 Integration Test Scenarios
1. **Rolling Window Tests**:
   - 14 calendar days from today
   - 10 weekdays from today
   - Rolling window with minimum notice

2. **Fixed Range Tests**:
   - Fixed dates in current month
   - Fixed dates spanning multiple months
   - Past fixed dates (should show no availability)

3. **Indefinite Range Tests**:
   - With minimum notice only
   - Far future date selection

4. **Combination Tests**:
   - Rolling window + 2-day minimum notice
   - Fixed range + weekday-only availability
   - All settings at maximum restrictions

### 4.3 Manual Testing Checklist
- [ ] Create service with rolling 7-day window → Verify only next 7 days bookable
- [ ] Set fixed date range → Confirm dates outside range are disabled
- [ ] Configure 2-day minimum notice → Check earliest slot is 2 days out
- [ ] Use weekdays-only rolling → Ensure weekends don't count
- [ ] Set indefinite range → Verify far future dates are bookable
- [ ] Change from rolling to fixed → Confirm settings update correctly
- [ ] Test with different timezones → Validate date boundaries

## Implementation Priority

### High Priority (Core Functionality)
1. Backend ServiceSettings interface update
2. Date range validation in availability calculation
3. API parameter handling
4. Frontend Service interface update
5. BookingCalendar date disabling logic

### Medium Priority (UX Improvements)
1. Form editor validation and feedback
2. Customer-facing messaging for restrictions
3. Booking window preview in editor

### Low Priority (Nice to Have)
1. Analytics on restriction impact
2. Auto-suggest optimal settings
3. Bulk update tools for existing forms

## Success Criteria
- [ ] All 8 scheduling settings from form editor work in live bookings
- [ ] Date range restrictions properly enforced in calendar
- [ ] Minimum notice respects days vs hours selection
- [ ] Clear user feedback when dates unavailable due to settings
- [ ] No performance regression in booking calendar
- [ ] Backward compatibility maintained for existing forms

## Files to Modify (Summary)
1. `src/lib/simpro/availability-utils.server.ts` - Expand ServiceSettings interface
2. `src/lib/simpro/availability-optimized.server.ts` - Add date range logic
3. `src/routes/api/public/services/$serviceId/availability.ts` - Handle new parameters
4. `src/features/booking/components/form-editor/booking-flow.tsx` - Update Service interface
5. `src/features/booking/components/form-editor/booking-calendar.tsx` - Implement date restrictions
6. `src/routes/f.$orgSlug.$formSlug.tsx` - Pass complete settings
7. `src/features/booking/components/form-editor/views/scheduling-settings-view.tsx` - Add validation

## Notes
- No database migration required - settings already stored in JSON
- Consider caching date range calculations for performance
- Document timezone handling for fixed date ranges
- Add feature flag if rolling out gradually