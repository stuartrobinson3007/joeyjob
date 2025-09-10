import { db } from '@/lib/db/db'
import { bookingForms, organization } from '@/database/schema'
import { eq } from 'drizzle-orm'

async function listForms() {
  try {
    // Get all booking forms with their organizations
    const forms = await db
      .select({
        formId: bookingForms.id,
        formName: bookingForms.name,
        formSlug: bookingForms.slug,
        isActive: bookingForms.isActive,
        theme: bookingForms.theme,
        orgId: organization.id,
        orgName: organization.name,
        orgSlug: organization.slug
      })
      .from(bookingForms)
      .leftJoin(organization, eq(bookingForms.organizationId, organization.id))
      .limit(10)
    
    if (forms.length === 0) {
      console.log('No booking forms found in the database')
    } else {
      console.log('\n📋 Booking Forms:\n')
      forms.forEach(form => {
        console.log(`Form: ${form.formName}`)
        console.log(`  Slug: ${form.formSlug}`)
        console.log(`  Active: ${form.isActive}`)
        console.log(`  Theme: ${form.theme || 'light'}`)
        console.log(`  Organization: ${form.orgName} (${form.orgSlug})`)
        console.log(`  URL: http://localhost:5723/f/${form.orgSlug}/${form.formSlug}`)
        console.log('---')
      })
    }
  } catch (error) {
    console.error('Error listing forms:', error)
  }
  
  process.exit(0)
}

listForms()