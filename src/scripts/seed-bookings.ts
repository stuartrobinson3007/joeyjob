import { db } from '@/lib/db/db'
import { bookings, services, bookingForms, organization } from '@/database/schema'
import { nanoid } from 'nanoid'
import { addDays, addHours, addMinutes, format, setHours, setMinutes } from 'date-fns'

// Sample customer names
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary']
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Martinez']

// Sample services
const serviceNames = ['Plumbing Repair', 'HVAC Maintenance', 'Electrical Installation', 'Roof Inspection', 'Kitchen Remodel']

// Statuses
const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show']

// Sources
const sources = ['web', 'api', 'admin']

// Notes samples
const notesSamples = [
  'Customer requested morning appointment',
  'Please call before arrival',
  'Gate code: 1234',
  'Park in driveway',
  'Second floor apartment',
  null,
  null, // Some bookings won't have notes
]

const internalNotesSamples = [
  'VIP customer - handle with care',
  'Payment pending verification',
  'Referred by Johnson family',
  'Follow up after service',
  null,
  null,
]

// Generate random phone number
function generatePhone() {
  return `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`
}

// Generate random email
function generateEmail(firstName: string, lastName: string) {
  const providers = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com']
  const provider = providers[Math.floor(Math.random() * providers.length)]
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${provider}`
}

// Generate form data
function generateFormData() {
  const hasFormData = Math.random() > 0.5
  if (!hasFormData) return null
  
  return {
    preferredContactMethod: Math.random() > 0.5 ? 'email' : 'phone',
    problemDescription: 'Issue with ' + ['pipes', 'heating', 'cooling', 'wiring', 'roof'][Math.floor(Math.random() * 5)],
    urgency: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
    availability: 'Weekdays after 3pm',
    additionalNotes: Math.random() > 0.5 ? 'Additional information provided by customer' : null,
  }
}

async function seedBookings() {
  try {
    console.log('🌱 Starting to seed bookings...')
    
    // Get the first organization
    const orgs = await db.select().from(organization).limit(1)
    if (!orgs.length) {
      console.error('❌ No organization found. Please create an organization first.')
      return
    }
    const orgId = orgs[0].id
    console.log(`📍 Using organization: ${orgs[0].name}`)
    
    // Get existing services or create them
    let existingServices = await db.select().from(services).where(eq(services.organizationId, orgId))
    
    if (existingServices.length === 0) {
      console.log('📝 Creating sample services...')
      // Create sample services
      for (const serviceName of serviceNames) {
        const [service] = await db.insert(services).values({
          id: nanoid(),
          organizationId: orgId,
          name: serviceName,
          description: `Professional ${serviceName} service`,
          duration: [30, 60, 90, 120][Math.floor(Math.random() * 4)],
          price: (Math.floor(Math.random() * 400) + 100).toString(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning()
        existingServices.push(service)
      }
    }
    
    console.log(`✅ Found/created ${existingServices.length} services`)
    
    // Create 20 fake bookings
    const bookingsToInsert = []
    const now = new Date()
    
    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const service = existingServices[Math.floor(Math.random() * existingServices.length)]
      
      // Generate booking date (past 30 days to future 30 days)
      const daysOffset = Math.floor(Math.random() * 60) - 30
      const bookingDay = addDays(now, daysOffset)
      
      // Generate start time (8 AM to 4 PM)
      const startHour = Math.floor(Math.random() * 8) + 8
      const bookingStartAt = setHours(setMinutes(bookingDay, 0), startHour)
      
      // Calculate end time based on service duration
      const duration = service.duration || 60
      const bookingEndAt = addMinutes(bookingStartAt, duration)
      
      // Determine status based on date
      let status = statuses[Math.floor(Math.random() * statuses.length)]
      if (bookingStartAt > now && (status === 'completed' || status === 'no-show')) {
        status = 'confirmed'
      } else if (bookingStartAt < now && status === 'pending') {
        status = 'completed'
      }
      
      const booking = {
        id: nanoid(),
        organizationId: orgId,
        serviceId: service.id,
        formId: null, // No forms for now
        customerId: null, // Guest bookings
        customerEmail: generateEmail(firstName, lastName),
        customerName: `${firstName} ${lastName}`,
        customerPhone: Math.random() > 0.3 ? generatePhone() : null,
        bookingStartAt,
        bookingEndAt,
        duration,
        price: service.price || '100',
        status,
        cancellationReason: status === 'cancelled' ? 'Customer requested cancellation' : null,
        notes: notesSamples[Math.floor(Math.random() * notesSamples.length)],
        internalNotes: internalNotesSamples[Math.floor(Math.random() * internalNotesSamples.length)],
        formData: generateFormData(),
        source: sources[Math.floor(Math.random() * sources.length)],
        confirmationCode: nanoid(8).toUpperCase(),
        reminderSent: bookingStartAt < now ? Math.random() > 0.5 : false,
        reminderSentAt: bookingStartAt < now && Math.random() > 0.5 ? addDays(bookingStartAt, -1) : null,
        createdBy: null,
        createdAt: addDays(bookingStartAt, -Math.floor(Math.random() * 7) - 1),
        updatedAt: addDays(bookingStartAt, -Math.floor(Math.random() * 3)),
      }
      
      bookingsToInsert.push(booking)
    }
    
    console.log('💾 Inserting bookings into database...')
    await db.insert(bookings).values(bookingsToInsert)
    
    console.log('✅ Successfully created 20 fake bookings!')
    console.log('📊 Booking statuses:')
    const statusCounts = bookingsToInsert.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`)
    })
    
  } catch (error) {
    console.error('❌ Error seeding bookings:', error)
  } finally {
    process.exit(0)
  }
}

// Add missing import
import { eq } from 'drizzle-orm'

// Run the seed function
seedBookings()