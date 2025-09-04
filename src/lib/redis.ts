import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = createClient({
  url: redisUrl
})

// Connect to Redis
await redis.connect()

// Event handlers
redis.on('connect', () => console.log('✅ Redis connected'))
redis.on('error', (err) => console.error('❌ Redis error:', err))
redis.on('end', () => console.log('🔴 Redis connection closed'))