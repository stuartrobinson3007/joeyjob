import { db } from '@/lib/db/db'
import { bookingForms } from '@/database/schema'
import { eq, and } from 'drizzle-orm'

async function activateForm() {
  const orgSlug = 'stuart-workspace-gxn3MghI'
  const formSlug = 'untitled-form-mfd52b1t'
  
  try {
    // Update the form to be active
    const result = await db
      .update(bookingForms)
      .set({ isActive: true })
      .where(eq(bookingForms.slug, formSlug))
      .returning()
    
    if (result.length > 0) {
      console.log('✅ Form activated successfully:', result[0].name)
      console.log('Theme:', result[0].theme)
      console.log('URL: http://localhost:5723/f/' + orgSlug + '/' + formSlug)
    } else {
      console.log('❌ Form not found with slug:', formSlug)
    }
  } catch (error) {
    console.error('Error activating form:', error)
  }
  
  process.exit(0)
}

activateForm()