import { createServerFileRoute } from '@tanstack/react-start/server'

import { redis } from '@/lib/db/redis'
import { db } from '@/lib/db/db'

export const ServerRoute = createServerFileRoute('/api/health').methods({
  GET: async () => {
    try {
      // Test database connection
      await db.execute('SELECT 1')

      // Test Redis connection
      await redis.ping()

      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis: 'connected',
        },
      })
    } catch (error) {
      return Response.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
})
