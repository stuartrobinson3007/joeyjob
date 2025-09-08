import path from 'path'

import { createServerFileRoute } from '@tanstack/react-start/server'

import { createLocalStorageService } from '@/lib/storage/local-storage-service'

export const ServerRoute = createServerFileRoute('/api/avatars/$').methods({
  GET: async ({ params }) => {
    try {
      const storage = createLocalStorageService()
      const filePath = params._splat || ''

      if (!filePath) {
        return new Response('File path required', { status: 400 })
      }

      // Security: Prevent path traversal
      const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '')
      if (normalizedPath !== filePath || filePath.includes('..')) {
        return new Response('Invalid file path', { status: 400 })
      }

      // Add avatars/ prefix to match storage structure
      const storageFilePath = `avatars/${filePath}`

      // Check if file exists
      const exists = await storage.fileExists(storageFilePath)
      if (!exists) {
        return new Response('File not found', { status: 404 })
      }

      // Get file and metadata
      const buffer = await storage.getFile(storageFilePath)
      const metadata = await storage.getFileMetadata(storageFilePath)

      // Determine content type
      const ext = path.extname(filePath).toLowerCase()
      const contentTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      }
      const contentType = metadata?.contentType || contentTypeMap[ext] || 'application/octet-stream'

      // Return file with appropriate headers
      return new Response(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=2592000', // Cache for 30 days
          'Content-Length': buffer.length.toString(),
        },
      })
    } catch (_error) {
      // Error serving avatar - returning error response
      return new Response('Internal server error', { status: 500 })
    }
  },
})
