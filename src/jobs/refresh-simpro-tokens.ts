#!/usr/bin/env node

/**
 * Railway Cron Job: Refresh Simpro Tokens
 * 
 * This job runs weekly to proactively refresh Simpro OAuth tokens
 * that are close to expiring (within 7 days of the refresh token expiration).
 * 
 * Simpro refresh tokens expire after 14 days, so this job ensures
 * tokens are refreshed well before they expire.
 * 
 * Usage:
 * - Manual run: `pnpm job:refresh-tokens`
 * - Railway cron: Configured in railway.json to run weekly
 */

import { refreshExpiringSimproTokens, checkTokenExpirationStatus } from '../lib/simpro/token-refresh.server'

async function main() {
  const jobStartTime = new Date()
  console.log(`🚀 Starting Simpro token refresh job at ${jobStartTime.toISOString()}`)
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📍 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`)

  try {
    // First, check what tokens are expiring (for logging purposes)
    console.log('📊 Pre-job status check:')
    await checkTokenExpirationStatus(7)

    // Run the token refresh job
    const result = await refreshExpiringSimproTokens(7)

    // Log comprehensive results
    console.log('\n📈 Job Summary:')
    console.log(`⏱️  Duration: ${result.duration}ms`)
    console.log(`📊 Total accounts checked: ${result.totalAccounts}`)
    console.log(`✅ Successful refreshes: ${result.successCount}`)
    console.log(`❌ Failed refreshes: ${result.failureCount}`)

    if (result.jobError) {
      console.error(`💥 Job-level error: ${result.jobError}`)
    }

    // Exit with appropriate code
    if (result.failureCount > 0 || result.jobError) {
      console.log('⚠️  Job completed with some failures')
      process.exit(1)
    } else {
      console.log('🎉 Job completed successfully')
      process.exit(0)
    }

  } catch (error) {
    console.error('💥 Fatal error in token refresh job:', error)
    
    // Log additional context for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    process.exit(1)
  }
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 Received SIGTERM, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('📛 Received SIGINT, shutting down gracefully')
  process.exit(0)
})

// Run the job
main().catch((error) => {
  console.error('💥 Unhandled error in main:', error)
  process.exit(1)
})