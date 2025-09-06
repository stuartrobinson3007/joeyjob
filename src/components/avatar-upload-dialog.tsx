import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, Camera, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/taali-ui/ui/dialog'
import { Button } from '@/components/taali-ui/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/taali-ui/ui/avatar'
import { toast } from 'sonner'
import { useSession } from '@/lib/auth/auth-hooks'

interface AvatarUploadDialogProps {
  currentAvatarUrl?: string | null
  userName?: string
  onUploadComplete?: (avatarUrl: string) => void
}

export function AvatarUploadDialog({
  currentAvatarUrl,
  userName,
  onUploadComplete
}: AvatarUploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { refetch } = useSession()

  // Cleanup preview URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const getUserInitials = () => {
    if (!userName) return 'U'
    const names = userName.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase()
    }
    return userName.charAt(0).toUpperCase()
  }

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsValidating(true)

    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
        return
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit`)
        return
      }

      // Validate image dimensions using a simple Image object
      const img = new Image()
      const imageUrl = URL.createObjectURL(file)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(imageUrl)

          // Check dimensions - reasonable limits for avatars
          const maxWidth = 4096  // 4K max
          const maxHeight = 4096
          const minWidth = 32    // Minimum readable size
          const minHeight = 32

          if (img.width > maxWidth || img.height > maxHeight) {
            reject(new Error(`Image dimensions ${img.width}x${img.height} exceed maximum ${maxWidth}x${maxHeight} pixels`))
            return
          }

          if (img.width < minWidth || img.height < minHeight) {
            reject(new Error(`Image dimensions ${img.width}x${img.height} are below minimum ${minWidth}x${minHeight} pixels`))
            return
          }

          resolve()
        }

        img.onerror = () => {
          URL.revokeObjectURL(imageUrl)
          reject(new Error('Invalid image file'))
        }

        img.src = imageUrl
      })

      setSelectedFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid image file')
    } finally {
      setIsValidating(false)
    }
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    // Create a fake event to reuse the file select handler
    const fakeEvent = {
      target: { files: [file] }
    } as React.ChangeEvent<HTMLInputElement>

    handleFileSelect(fakeEvent)
  }, [handleFileSelect])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an image first')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', selectedFile)

      const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload avatar')
      }

      toast.success('Avatar uploaded successfully!')

      // Call callback if provided
      onUploadComplete?.(data.avatarUrl)

      // Refetch session to update user data immediately
      await refetch()

      // Close dialog and reset state
      setOpen(false)
      // Clean up preview URL before setting to null
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      setSelectedFile(null)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) return

    setIsUploading(true)

    try {
      const response = await fetch('/api/avatars/delete', {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove avatar')
      }

      toast.success('Avatar removed successfully!')

      // Call callback with empty string to indicate removal
      onUploadComplete?.('')

      // Refetch session to update user data immediately
      await refetch()

      // Close dialog
      setOpen(false)
    } catch (error) {
      console.error('Remove error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove avatar')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    // Clean up preview URL before setting to null
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="relative group h-24 w-24 rounded-full p-0"
        >
          <Avatar className="h-24 w-24">
            <AvatarImage src={currentAvatarUrl || undefined} />
            <AvatarFallback className="text-2xl">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Profile Picture</DialogTitle>
          <DialogDescription>
            Choose a new profile picture. The image will be resized to 128x128 pixels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview or Upload Area */}
          {previewUrl ? (
            <div className="relative flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={previewUrl} className="object-cover" />
                  <AvatarFallback className="text-2xl">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border shadow-sm"
                  onClick={handleCancel}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Preview of your new profile picture
              </p>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors ${isValidating ? 'cursor-wait' : 'cursor-pointer'}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !isValidating && fileInputRef.current?.click()}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Validating image...
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG, PNG, GIF or WebP (max 10MB)
                  </p>
                </>
              )}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Action Buttons */}
          <div className="flex gap-2">
            {previewUrl ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isUploading || isValidating}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || isValidating}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isValidating}
                  className="flex-1"
                >
                  {isValidating ? 'Validating...' : 'Choose File'}
                </Button>
                {currentAvatarUrl && (
                  <Button
                    variant="destructive"
                    onClick={handleRemoveAvatar}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Remove'
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}