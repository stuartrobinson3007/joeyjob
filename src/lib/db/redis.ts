import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = createClient({
  url: redisUrl,
})

// Async connection function
async function connectRedis() {
  try {
    await redis.connect()
  } catch (error) {
    // Redis connection errors should be handled by the application
    throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Event handlers - errors are handled by throwing, success/end states don't need logging
redis.on('error', err => {
  throw new Error(`Redis error: ${err instanceof Error ? err.message : 'Unknown error'}`)
})

// Connect immediately but don't await at top level
connectRedis()
