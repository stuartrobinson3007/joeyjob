# Booking System Redesign Plan V2 (Updated)

## Executive Summary

Complete redesign of the JoeyJob booking system with simplified architecture. Services remain embedded in form configurations, bookings store denormalized service data at time of booking, and we can clear existing data (no migration needed).

## Core Architecture Decisions

1. **One Service Per Booking** - Confirmed design constraint
2. **Full Denormalization** - Snapshot all data at booking time (no stale data concerns)
3. **Clear Existing Data** - No migration complexity
4. **UTC Backend / Timezone Frontend** - All backend times in UTC, display with timezone abbreviations

## Database Schema (Drizzle Format)

### Updated Bookings Table

```typescript
import { pgTable, text, timestamp, integer, decimal, json, index } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

export const bookings = pgTable('bookings', {
  // Primary Keys
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  formId: text('form_id')
    .references(() => bookingForms.id, { onDelete: 'set null' }),
  
  // Service Information (Denormalized from form config)
  serviceNodeId: text('service_node_id').notNull(),
  serviceName: text('service_name').notNull(),
  serviceDescription: text('service_description'),
  serviceDuration: integer('service_duration').notNull(), // minutes
  servicePrice: decimal('service_price', { precision: 10, scale: 2 }).notNull(),
  serviceCategory: text('service_category'),
  
  // Customer Information
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  customerCompany: text('customer_company'),
  
  // Scheduling (all times stored in UTC)
  bookingDate: timestamp('booking_date').notNull(), // UTC timestamp
  startTime: timestamp('start_time').notNull(),     // UTC timestamp
  endTime: timestamp('end_time').notNull(),         // UTC timestamp
  customerTimezone: text('customer_timezone').notNull(), // e.g., 'America/New_York'
  
  // Employee Assignment
  assignedEmployeeId: text('assigned_employee_id')
    .references(() => organizationEmployees.id, { onDelete: 'set null' }),
  assignedEmployeeName: text('assigned_employee_name'),
  assignedEmployeeEmail: text('assigned_employee_email'),
  
  // Form Responses (Structured JSON)
  formResponses: json('form_responses').notNull().$type<FormResponses>(),
  
  // Status Management
  status: text('status').notNull().default('pending'),
  statusChangedAt: timestamp('status_changed_at'),
  statusChangedBy: text('status_changed_by')
    .references(() => user.id, { onDelete: 'set null' }),
  cancellationReason: text('cancellation_reason'),
  
  // Notes
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  
  // Metadata
  confirmationCode: text('confirmation_code').notNull().unique(),
  bookingSource: text('booking_source').default('web'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    // Indexes for performance
    bookingDateIdx: index('idx_booking_date').on(table.bookingDate),
    customerEmailIdx: index('idx_customer_email').on(table.customerEmail),
    statusIdx: index('idx_status').on(table.status),
    orgDateIdx: index('idx_org_date').on(table.organizationId, table.bookingDate),
    confirmationCodeIdx: index('idx_confirmation_code').on(table.confirmationCode),
    // Full-text search on customer name using GIN index
    customerNameIdx: index('idx_customer_name_gin').using('gin', 
      sql`to_tsvector('english', ${table.customerName})`
    ),
    serviceNameIdx: index('idx_service_name_gin').using('gin',
      sql`to_tsvector('english', ${table.serviceName})`
    ),
  }
})
```

### TypeScript Types

```typescript
interface FormResponses {
  // Standard fields
  contactInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company?: string;
  };
  
  address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  
  // Custom questions with metadata
  customQuestions: Array<{
    questionId: string;
    questionText: string;
    questionType: FormFieldType;
    answer: any;
    fieldName: string;
  }>;
  
  // Service-specific questions
  serviceQuestions?: Array<{
    questionId: string;
    questionText: string;
    questionType: FormFieldType;
    answer: any;
  }>;
}

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
```

## Time Zone Strategy

### Backend (Always UTC)
```typescript
// When saving a booking
const booking = {
  // Convert local time to UTC for storage
  bookingDate: zonedTimeToUtc(localDate, customerTimezone),
  startTime: zonedTimeToUtc(localStartTime, customerTimezone),
  endTime: zonedTimeToUtc(localEndTime, customerTimezone),
  customerTimezone: 'America/New_York', // Store original timezone
}
```

### Frontend Display
```typescript
// When displaying to customer
import { utcToZonedTime, format } from 'date-fns-tz';

function formatBookingTime(booking: Booking) {
  const zonedTime = utcToZonedTime(booking.startTime, booking.customerTimezone);
  const timeStr = format(zonedTime, 'h:mm a');
  const timezone = format(zonedTime, 'zzz'); // e.g., 'EST', 'PDT'
  return `${timeStr} ${timezone}`;
}

// Display: "2:00 PM EST"
```

### Calendar Component
```typescript
// BookingCalendar should work in customer's local timezone
<BookingCalendar
  timezone={customerTimezone} // Auto-detected or selected
  onSelectDateTime={(localDate, localTime) => {
    // Pass local time, will be converted to UTC on backend
    submitBooking({
      date: localDate,
      time: localTime,
      timezone: customerTimezone
    });
  }}
/>
```

## Booking Submission Flow

### 1. Data Structure from Frontend
```typescript
interface BookingSubmitRequest {
  organizationId: string;
  formId: string;
  
  // Service data extracted from form config tree
  service: {
    nodeId: string;
    name: string;
    description?: string;
    duration: number;
    price: number;
    category?: string;
  };
  
  // Customer info from form
  customer: {
    name: string; // Combined first + last
    email: string;
    phone?: string;
    company?: string;
  };
  
  // Local time from customer's perspective
  scheduling: {
    date: string;        // ISO date in local timezone
    startTime: string;   // "14:00" in local timezone
    timezone: string;    // "America/New_York"
  };
  
  // Optional employee
  employee?: {
    id: string;
    name: string;
    email?: string;
  };
  
  // All form responses
  formResponses: FormResponses;
}
```

### 2. Backend Processing
```typescript
export async function submitBooking(data: BookingSubmitRequest) {
  // 1. Validate form is active
  const form = await validateForm(data.formId, data.organizationId);
  
  // 2. Extract service from form config (no services table!)
  const serviceNode = findServiceInTree(form.formConfig.serviceTree, data.service.nodeId);
  if (!serviceNode) throw new Error('Invalid service selection');
  
  // 3. Convert times to UTC
  const localStart = parseISO(`${data.scheduling.date}T${data.scheduling.startTime}`);
  const utcStart = zonedTimeToUtc(localStart, data.scheduling.timezone);
  const utcEnd = addMinutes(utcStart, data.service.duration);
  
  // 4. Check availability (if employee selected)
  if (data.employee) {
    await checkEmployeeAvailability(data.employee.id, utcStart, utcEnd);
  }
  
  // 5. Create booking record
  const booking = await db.insert(bookings).values({
    organizationId: data.organizationId,
    formId: data.formId,
    
    // Service (denormalized)
    serviceNodeId: data.service.nodeId,
    serviceName: data.service.name,
    serviceDescription: data.service.description,
    serviceDuration: data.service.duration,
    servicePrice: data.service.price.toString(),
    serviceCategory: data.service.category,
    
    // Customer
    customerName: data.customer.name,
    customerEmail: data.customer.email,
    customerPhone: data.customer.phone,
    customerCompany: data.customer.company,
    
    // Scheduling (UTC)
    bookingDate: utcStart,
    startTime: utcStart,
    endTime: utcEnd,
    customerTimezone: data.scheduling.timezone,
    
    // Employee
    assignedEmployeeId: data.employee?.id,
    assignedEmployeeName: data.employee?.name,
    assignedEmployeeEmail: data.employee?.email,
    
    // Form data
    formResponses: data.formResponses,
    
    // Metadata
    confirmationCode: generateConfirmationCode(),
    status: 'pending',
    bookingSource: 'web',
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  }).returning();
  
  // 6. Send confirmation email
  await sendBookingConfirmation(booking[0]);
  
  // 7. Trigger webhooks
  await triggerWebhooks('booking.created', booking[0]);
  
  return booking[0];
}
```

## Query Optimization

### Booking List Query
```typescript
// Optimized query with proper indexes
export async function getBookings(filters: BookingFilters) {
  const conditions = [];
  
  // Use indexed columns for filtering
  if (filters.date) {
    conditions.push(
      and(
        gte(bookings.bookingDate, startOfDay(filters.date)),
        lt(bookings.bookingDate, endOfDay(filters.date))
      )
    );
  }
  
  if (filters.search) {
    // Use GIN index for full-text search
    conditions.push(
      sql`to_tsvector('english', ${bookings.customerName} || ' ' || ${bookings.customerEmail}) 
          @@ plainto_tsquery('english', ${filters.search})`
    );
  }
  
  return db.select({
    id: bookings.id,
    customerName: bookings.customerName,
    serviceName: bookings.serviceName,
    startTime: bookings.startTime,
    customerTimezone: bookings.customerTimezone,
    status: bookings.status,
    assignedEmployeeName: bookings.assignedEmployeeName,
  })
  .from(bookings)
  .where(and(...conditions))
  .orderBy(desc(bookings.bookingDate))
  .limit(filters.limit || 50);
}
```

### Display Formatting
```typescript
// Format booking for display
function formatBookingForDisplay(booking: Booking) {
  // Convert UTC to customer's timezone
  const zonedTime = utcToZonedTime(booking.startTime, booking.customerTimezone);
  
  return {
    ...booking,
    displayDate: format(zonedTime, 'MMM d, yyyy'),
    displayTime: format(zonedTime, 'h:mm a zzz'), // "2:00 PM EST"
    localDateTime: zonedTime, // For calendar display
  };
}
```

## UI Components

### Booking List Table
```typescript
const columns = [
  {
    id: 'date',
    header: 'Date',
    cell: (booking) => formatBookingForDisplay(booking).displayDate
  },
  {
    id: 'time',
    header: 'Time',
    cell: (booking) => formatBookingForDisplay(booking).displayTime
  },
  {
    id: 'customer',
    header: 'Customer',
    cell: (booking) => booking.customerName
  },
  {
    id: 'service',
    header: 'Service',
    cell: (booking) => booking.serviceName
  },
  {
    id: 'employee',
    header: 'Assigned To',
    cell: (booking) => booking.assignedEmployeeName || 'Unassigned'
  },
  {
    id: 'status',
    header: 'Status',
    cell: (booking) => <StatusBadge status={booking.status} />
  }
];
```

### Booking Detail View
```tsx
function BookingDetail({ bookingId }: { bookingId: string }) {
  const booking = useBooking(bookingId);
  const display = formatBookingForDisplay(booking);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">
            Booking #{booking.confirmationCode}
          </h1>
          <p className="text-muted-foreground">
            {display.displayDate} at {display.displayTime}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      
      {/* Service Details */}
      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Service</dt>
              <dd className="font-medium">{booking.serviceName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Duration</dt>
              <dd>{booking.serviceDuration} minutes</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Price</dt>
              <dd>${booking.servicePrice}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Assigned To</dt>
              <dd>{booking.assignedEmployeeName || 'Unassigned'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd>{booking.customerName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd>{booking.customerEmail}</dd>
            </div>
            {booking.customerPhone && (
              <div>
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd>{booking.customerPhone}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      
      {/* Form Responses */}
      <Card>
        <CardHeader>
          <CardTitle>Form Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <FormResponseViewer responses={booking.formResponses} />
        </CardContent>
      </Card>
      
      {/* Internal Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={booking.internalNotes || ''}
            onChange={(e) => updateBookingNotes(bookingId, e.target.value)}
            placeholder="Add internal notes..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Implementation Steps (Simplified)

### Phase 1: Database Setup (Day 1)
- [ ] Create new Drizzle schema file
- [ ] Drop old bookings-related tables
- [ ] Run migration to create new schema
- [ ] Update TypeScript types

### Phase 2: Booking Submission (Day 2-3)
- [ ] Implement timezone-aware submission endpoint
- [ ] Add UTC conversion utilities
- [ ] Update form to capture timezone
- [ ] Implement confirmation code generation
- [ ] Add booking confirmation emails

### Phase 3: Display Layer (Day 4-5)
- [ ] Create booking list component with timezone display
- [ ] Build booking detail view
- [ ] Add form response viewer
- [ ] Implement status management
- [ ] Add internal notes feature

### Phase 4: Testing & Deploy (Day 6)
- [ ] Test timezone conversions
- [ ] Test booking flow end-to-end
- [ ] Deploy to staging
- [ ] Final testing
- [ ] Deploy to production

## Key Improvements in V2

1. **Proper Drizzle Schema** - Using Drizzle's format instead of raw SQL
2. **Optimized Indexes** - GIN indexes for full-text search, proper composite indexes
3. **Clear Timezone Strategy** - UTC backend, localized frontend with timezone abbreviations
4. **No Migration Complexity** - Clean slate approach
5. **Simplified Architecture** - One service per booking, full denormalization
6. **Performance Optimized** - Proper indexes and query strategies

## Success Metrics

- Zero booking submission failures
- Sub-100ms query times for booking lists
- Correct timezone display in all contexts
- 100% data capture at booking time
- No booking data inconsistencies