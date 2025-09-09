import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { nanoid } from 'nanoid'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env' })

// Create database connection
const sql = postgres(process.env.DATABASE_URL)
const db = drizzle(sql)

// Sample data
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary']
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Martinez']
const serviceNames = ['Plumbing Repair', 'HVAC Maintenance', 'Electrical Installation', 'Roof Inspection', 'Kitchen Remodel']
const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show']
const sources = ['web', 'api', 'admin']

const notesSamples = [
  'Customer requested morning appointment',
  'Please call before arrival',
  'Gate code: 1234',
  'Park in driveway',
  'Second floor apartment',
  null,
  null,
]

const internalNotesSamples = [
  'VIP customer - handle with care',
  'Payment pending verification',
  'Referred by Johnson family',
  'Follow up after service',
  null,
  null,
]

function generatePhone() {
  return `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`
}

function generateEmail(firstName, lastName) {
  const providers = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com']
  const provider = providers[Math.floor(Math.random() * providers.length)]
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${provider}`
}

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

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatTime(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

async function seedBookings() {
  try {
    console.log('🌱 Starting to seed bookings...')
    
    // Get the first organization and a user
    const orgs = await sql`SELECT id, name FROM organization LIMIT 1`
    if (!orgs.length) {
      console.error('❌ No organization found. Please create an organization first.')
      return
    }
    const orgId = orgs[0].id
    console.log(`📍 Using organization: ${orgs[0].name}`)
    
    // Get the first user (for created_by field)
    const users = await sql`SELECT id FROM "user" LIMIT 1`
    const userId = users.length > 0 ? users[0].id : null
    
    // Get existing services or create them
    let existingServices = await sql`
      SELECT id, name, duration, price 
      FROM services 
      WHERE organization_id = ${orgId}
    `
    
    if (existingServices.length === 0) {
      console.log('📝 Creating sample services...')
      // Create sample services
      for (const serviceName of serviceNames) {
        const serviceId = nanoid()
        const duration = [30, 60, 90, 120][Math.floor(Math.random() * 4)]
        const price = (Math.floor(Math.random() * 400) + 100).toString()
        
        await sql`
          INSERT INTO services (id, organization_id, name, description, duration, price, is_active, created_by, created_at, updated_at)
          VALUES (
            ${serviceId},
            ${orgId},
            ${serviceName},
            ${'Professional ' + serviceName + ' service'},
            ${duration},
            ${price},
            true,
            ${userId},
            NOW(),
            NOW()
          )
        `
        
        existingServices.push({
          id: serviceId,
          name: serviceName,
          duration,
          price
        })
      }
    }
    
    console.log(`✅ Found/created ${existingServices.length} services`)
    
    // Create 20 fake bookings
    const now = new Date()
    let insertedCount = 0
    
    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const service = existingServices[Math.floor(Math.random() * existingServices.length)]
      
      // Generate booking date (past 30 days to future 30 days)
      const daysOffset = Math.floor(Math.random() * 60) - 30
      const bookingDate = addDays(now, daysOffset)
      
      // Generate start time (8 AM to 4 PM)
      const startHour = Math.floor(Math.random() * 8) + 8
      const startTime = formatTime(startHour, 0)
      
      // Calculate end time based on service duration
      const duration = service.duration || 60
      const endHour = startHour + Math.floor(duration / 60)
      const endMinute = duration % 60
      const endTime = formatTime(endHour, endMinute)
      
      // Determine status based on date
      let status = statuses[Math.floor(Math.random() * statuses.length)]
      if (bookingDate > now && (status === 'completed' || status === 'no-show')) {
        status = 'confirmed'
      } else if (bookingDate < now && status === 'pending') {
        status = 'completed'
      }
      
      const bookingId = nanoid()
      const confirmationCode = nanoid(8).toUpperCase()
      const customerEmail = generateEmail(firstName, lastName)
      const customerName = `${firstName} ${lastName}`
      const customerPhone = Math.random() > 0.3 ? generatePhone() : null
      const notes = notesSamples[Math.floor(Math.random() * notesSamples.length)]
      const internalNotes = internalNotesSamples[Math.floor(Math.random() * internalNotesSamples.length)]
      const formData = generateFormData()
      const source = sources[Math.floor(Math.random() * sources.length)]
      const cancellationReason = status === 'cancelled' ? 'Customer requested cancellation' : null
      const reminderSent = bookingDate < now ? Math.random() > 0.5 : false
      const reminderSentAt = bookingDate < now && Math.random() > 0.5 ? addDays(bookingDate, -1) : null
      const createdAt = addDays(bookingDate, -Math.floor(Math.random() * 7) - 1)
      const updatedAt = addDays(bookingDate, -Math.floor(Math.random() * 3))
      
      await sql`
        INSERT INTO bookings (
          id, organization_id, service_id, customer_email, customer_name, customer_phone,
          booking_date, start_time, end_time, duration, price, status,
          cancellation_reason, notes, internal_notes, form_data, source,
          confirmation_code, reminder_sent, reminder_sent_at, created_at, updated_at
        ) VALUES (
          ${bookingId},
          ${orgId},
          ${service.id},
          ${customerEmail},
          ${customerName},
          ${customerPhone},
          ${bookingDate.toISOString()},
          ${startTime},
          ${endTime},
          ${duration},
          ${service.price || '100'},
          ${status},
          ${cancellationReason},
          ${notes},
          ${internalNotes},
          ${formData ? JSON.stringify(formData) : null}::json,
          ${source},
          ${confirmationCode},
          ${reminderSent},
          ${reminderSentAt ? reminderSentAt.toISOString() : null},
          ${createdAt.toISOString()},
          ${updatedAt.toISOString()}
        )
      `
      
      insertedCount++
      console.log(`  ✓ Created booking ${insertedCount}/20: ${customerName} - ${service.name} (${status})`)
    }
    
    console.log('✅ Successfully created 20 fake bookings!')
    
    // Show summary
    const summary = await sql`
      SELECT status, COUNT(*) as count 
      FROM bookings 
      WHERE organization_id = ${orgId}
      GROUP BY status
    `
    
    console.log('📊 Booking statuses in database:')
    summary.forEach(row => {
      console.log(`   ${row.status}: ${row.count}`)
    })
    
  } catch (error) {
    console.error('❌ Error seeding bookings:', error)
  } finally {
    await sql.end()
    process.exit(0)
  }
}

// Run the seed function
seedBookings()