import { createServerFileRoute } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

// import { createLocalStorageService } from '@/lib/storage/local-storage-service'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { user } from '@/database/schema'

export const ServerRoute = createServerFileRoute('/api/avatars/delete').methods({
  DELETE: async ({ request }) => {
    // Temporarily disabled to debug Buffer issue
    return Response.json({ error: 'Avatar deletion temporarily disabled' }, { status: 503 })
    
    try {
      // Authenticate user
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get current user's avatar
      const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)

      const avatarUrl = currentUser[0]?.image

      if (!avatarUrl) {
        return Response.json({ error: 'No avatar to delete' }, { status: 404 })
      }

      // Initialize storage service
      const storage = createLocalStorageService()

      // Extract key and delete file
      const key = storage.extractKeyFromUrl(avatarUrl)
      if (key) {
        await storage.deleteFile(key)
      }

      // Remove avatar URL using Better Auth API to ensure session is properly updated
      await auth.api.updateUser({
        headers: request.headers,
        body: {
          image: undefined,
        },
      })

      return Response.json({
        success: true,
        message: 'Avatar deleted successfully',
      })
    } catch (error) {
      // Avatar delete error - returning error response
      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Failed to delete avatar',
        },
        { status: 500 }
      )
    }
  },
})
