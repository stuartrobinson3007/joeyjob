import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = createClient({
  url: redisUrl
})

// Async connection function
async function connectRedis() {
  try {
    await redis.connect()
    console.log('✅ Redis connected')
  } catch (error) {
    console.error('❌ Redis connection failed:', error)
  }
}

// Event handlers
redis.on('connect', () => console.log('✅ Redis connected'))
redis.on('error', (err) => console.error('❌ Redis error:', err))
redis.on('end', () => console.log('🔴 Redis connection closed'))

// Connect immediately but don't await at top level
connectRedis()