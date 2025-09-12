import { db } from '@/lib/db/db'
import { account, user } from '@/database/schema'
import { eq, and, lt, isNotNull } from 'drizzle-orm'
import { createSimproApi } from './simpro-api'

/**
 * Service for refreshing Simpro tokens that are close to expiring
 * This prevents tokens from expiring and causing authentication failures
 */

interface TokenRefreshResult {
  userId: string
  success: boolean
  error?: string
  tokensRefreshed?: boolean
}

/**
 * Get all Simpro accounts with refresh tokens expiring within the specified days
 */
async function getAccountsWithExpiringTokens(daysFromNow: number = 7) {
  const expirationThreshold = new Date()
  expirationThreshold.setDate(expirationThreshold.getDate() + daysFromNow)

  console.log(`🔍 Checking for Simpro refresh tokens expiring before: ${expirationThreshold.toISOString()}`)

  const accounts = await db
    .select({
      userId: account.userId,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      refreshTokenExpiresAt: account.refreshTokenExpiresAt,
      simproBuildName: user.simproBuildName,
      simproDomain: user.simproDomain,
      userEmail: user.email,
    })
    .from(account)
    .innerJoin(user, eq(account.userId, user.id))
    .where(
      and(
        eq(account.providerId, 'simpro'),
        isNotNull(account.refreshToken),
        isNotNull(account.refreshTokenExpiresAt),
        lt(account.refreshTokenExpiresAt, expirationThreshold)
      )
    )

  console.log(`📊 Found ${accounts.length} Simpro accounts with tokens expiring soon`)
  
  return accounts
}

/**
 * Refresh tokens for a single user account
 */
async function refreshTokensForUser(
  userId: string,
  accessToken: string,
  refreshToken: string,
  simproBuildName: string,
  simproDomain: string,
  userEmail: string
): Promise<TokenRefreshResult> {
  try {
    console.log(`🔄 Refreshing tokens for user ${userId} (${userEmail})`)

    if (!simproBuildName || !simproDomain) {
      throw new Error(`Missing Simpro build configuration for user ${userId}`)
    }

    // Create callback to update tokens in database
    const tokenUpdateCallback = async (
      newAccessToken: string,
      newRefreshToken: string,
      accessTokenExpiresAt: number,
      refreshTokenExpiresAt: number
    ) => {
      console.log(`💾 Updating tokens in database for user ${userId}`)
      await db
        .update(account)
        .set({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          accessTokenExpiresAt: new Date(accessTokenExpiresAt),
          refreshTokenExpiresAt: new Date(refreshTokenExpiresAt),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, 'simpro')
          )
        )
    }

    // Create Simpro API instance
    const simproApi = createSimproApi(
      accessToken,
      refreshToken,
      simproBuildName,
      simproDomain,
      userId,
      tokenUpdateCallback
    )

    // Test connection to force token refresh if needed
    await simproApi.testConnection()

    console.log(`✅ Successfully refreshed tokens for user ${userId} (${userEmail})`)
    
    return {
      userId,
      success: true,
      tokensRefreshed: true
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to refresh tokens for user ${userId} (${userEmail}):`, errorMessage)
    
    return {
      userId,
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Main function to refresh all expiring Simpro tokens
 * Returns summary of refresh operations
 */
export async function refreshExpiringSimproTokens(daysFromNow: number = 7) {
  const startTime = Date.now()
  console.log(`🚀 Starting Simpro token refresh job at ${new Date().toISOString()}`)
  console.log(`🎯 Target: Refresh tokens expiring within ${daysFromNow} days`)

  try {
    // Get accounts with expiring tokens
    const accounts = await getAccountsWithExpiringTokens(daysFromNow)

    if (accounts.length === 0) {
      console.log('✨ No Simpro tokens need refreshing at this time')
      return {
        totalAccounts: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        duration: Date.now() - startTime
      }
    }

    // Refresh tokens for each account
    const results: TokenRefreshResult[] = []
    
    for (const account of accounts) {
      const result = await refreshTokensForUser(
        account.userId,
        account.accessToken!,
        account.refreshToken!,
        account.simproBuildName!,
        account.simproDomain!,
        account.userEmail
      )
      results.push(result)
      
      // Add small delay between requests to be respectful to Simpro API
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Calculate summary
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    const duration = Date.now() - startTime

    console.log(`📈 Token refresh job completed in ${duration}ms`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)

    // Log any failures for monitoring
    if (failureCount > 0) {
      console.error('❌ Failed token refreshes:')
      results
        .filter(r => !r.success)
        .forEach(r => console.error(`  - User ${r.userId}: ${r.error}`))
    }

    return {
      totalAccounts: accounts.length,
      successCount,
      failureCount,
      results,
      duration
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`💥 Token refresh job failed:`, errorMessage)
    
    return {
      totalAccounts: 0,
      successCount: 0,
      failureCount: 1,
      results: [],
      duration: Date.now() - startTime,
      jobError: errorMessage
    }
  }
}

/**
 * Check token expiration status without refreshing
 * Useful for monitoring and debugging
 */
export async function checkTokenExpirationStatus(daysFromNow: number = 7) {
  console.log(`🔍 Checking Simpro token expiration status`)
  
  try {
    const accounts = await getAccountsWithExpiringTokens(daysFromNow)
    
    if (accounts.length === 0) {
      console.log('✅ No Simpro tokens are expiring soon')
      return { accountsExpiringSoon: 0, accounts: [] }
    }

    console.log(`⚠️ Found ${accounts.length} accounts with tokens expiring within ${daysFromNow} days:`)
    accounts.forEach(account => {
      console.log(`  - User ${account.userId} (${account.userEmail}): expires ${account.refreshTokenExpiresAt?.toISOString()}`)
    })

    return {
      accountsExpiringSoon: accounts.length,
      accounts: accounts.map(acc => ({
        userId: acc.userId,
        userEmail: acc.userEmail,
        refreshTokenExpiresAt: acc.refreshTokenExpiresAt
      }))
    }
  } catch (error) {
    console.error('❌ Failed to check token expiration status:', error)
    throw error
  }
}