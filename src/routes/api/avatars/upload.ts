import { createServerFileRoute } from '@tanstack/react-start/server'
// import { eq } from 'drizzle-orm'

// import { createLocalStorageService } from '@/lib/storage/local-storage-service'
// import { ImageProcessor } from '@/lib/storage/image-processor'
// import { auth } from '@/lib/auth/auth'
// import { db } from '@/lib/db/db'
// import { user } from '@/database/schema'

export const ServerRoute = createServerFileRoute('/api/avatars/upload').methods({
  POST: async ({ request }) => {
    // Temporarily disabled to debug Buffer issue
    return Response.json({ error: 'Avatar upload temporarily disabled' }, { status: 503 })
    
    try {
      // Authenticate user
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse multipart form data
      const formData = await request.formData()
      const file = formData.get('avatar') as File

      if (!file) {
        return Response.json({ error: 'No file provided' }, { status: 400 })
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        return Response.json(
          {
            error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.',
          },
          { status: 400 }
        )
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        return Response.json(
          {
            error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
          },
          { status: 400 }
        )
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      // Commented out Buffer usage to fix client-side error
      // const buffer = Buffer.from(arrayBuffer)
      const buffer = new Uint8Array(arrayBuffer) as any

      // Validate that it's actually an image
      // const isValidImage = await ImageProcessor.validateImage(buffer)
      // if (!isValidImage) {
      //   return Response.json({ error: 'File is not a valid image' }, { status: 400 })
      // }

      // Skip dimension validation for avatars since we'll resize them anyway

      // Process the image (resize, compress, etc.)
      // const processed = await ImageProcessor.processAvatar(buffer)
      const processed = { buffer: buffer }

      // Get current user's avatar to delete old one
      const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)

      const oldAvatarUrl = currentUser[0]?.image

      // Initialize storage service
      const storage = createLocalStorageService()

      // Generate unique filename
      const avatarKey = storage.generateAvatarKey(session.user.id, 'jpg')

      // Upload processed avatar
      const uploadResult = await storage.uploadFile(avatarKey, processed.buffer, 'image/jpeg', {
        userId: session.user.id,
        originalFilename: file.name,
        processedAt: new Date().toISOString(),
      })

      // Update user's avatar URL using Better Auth API to ensure session is properly updated
      await auth.api.updateUser({
        headers: request.headers,
        body: {
          image: uploadResult.url,
        },
      })

      // Delete old avatar if exists
      if (oldAvatarUrl) {
        try {
          const oldKey = storage.extractKeyFromUrl(oldAvatarUrl)
          if (oldKey) {
            await storage.deleteFile(oldKey)
          }
        } catch (_error) {
          // Failed to delete old avatar - not critical for upload success
        }
      }

      return Response.json({
        success: true,
        avatarUrl: uploadResult.url,
      })
    } catch (_error) {
      // Avatar upload error - returning error response
      return Response.json(
        {
          error: _error instanceof Error ? _error.message : 'Failed to upload avatar',
        },
        { status: 500 }
      )
    }
  },
})
