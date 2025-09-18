#!/usr/bin/env tsx

import { db } from '../src/lib/db/db'
import { bookings } from '../src/database/schema'
import { sql, isNotNull, isNull } from 'drizzle-orm'
import { formatAddressOneLine } from '../src/utils/maps'

/**
 * Backfill script to populate customerAddress field for existing bookings
 *
 * This script will:
 * 1. Find all bookings that have a null customerAddress but have address data in formResponses
 * 2. Extract the address from formResponses.address
 * 3. Format it using formatAddressOneLine
 * 4. Update the customerAddress field
 */

interface AddressData {
  street?: string
  street2?: string
  city?: string
  state?: string
  zip?: string
  postalCode?: string
  country?: string
}

async function backfillCustomerAddresses() {
  console.log('🔄 Starting customerAddress backfill...')

  try {
    // Find bookings with null customerAddress but potentially have address data
    const bookingsToUpdate = await db
      .select({
        id: bookings.id,
        formResponses: bookings.formResponses,
      })
      .from(bookings)
      .where(isNull(bookings.customerAddress))

    console.log(`📊 Found ${bookingsToUpdate.length} bookings with null customerAddress`)

    let updatedCount = 0
    let skippedCount = 0

    for (const booking of bookingsToUpdate) {
      try {
        // Extract address from formResponses
        const formResponses = booking.formResponses as any
        const addressData = formResponses?.address as AddressData

        if (!addressData) {
          skippedCount++
          continue
        }

        // Check if address has meaningful data
        const hasValidData = addressData.street || addressData.city || addressData.state
        if (!hasValidData) {
          skippedCount++
          continue
        }

        // Format the address
        const formattedAddress = formatAddressOneLine(addressData)

        if (!formattedAddress || formattedAddress.trim() === '') {
          skippedCount++
          continue
        }

        // Update the booking
        await db
          .update(bookings)
          .set({ customerAddress: formattedAddress })
          .where(sql`${bookings.id} = ${booking.id}`)

        updatedCount++

        if (updatedCount % 10 === 0) {
          console.log(`✅ Updated ${updatedCount} bookings so far...`)
        }

      } catch (error) {
        console.error(`❌ Error processing booking ${booking.id}:`, error)
        skippedCount++
      }
    }

    console.log('✅ Backfill completed!')
    console.log(`📈 Summary:`)
    console.log(`   - Total bookings checked: ${bookingsToUpdate.length}`)
    console.log(`   - Successfully updated: ${updatedCount}`)
    console.log(`   - Skipped (no valid address): ${skippedCount}`)

  } catch (error) {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  }
}

// Run the backfill if this script is executed directly
if (require.main === module) {
  backfillCustomerAddresses()
    .then(() => {
      console.log('🎉 Backfill script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Backfill script failed:', error)
      process.exit(1)
    })
}

export { backfillCustomerAddresses }