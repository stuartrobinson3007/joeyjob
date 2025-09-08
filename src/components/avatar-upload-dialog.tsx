import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, Camera, Loader2 } from 'lucide-react'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { useSession } from '@/lib/auth/auth-hooks'

interface AvatarUploadDialogProps {
  currentAvatarUrl?: string | null
  userName?: string
  onUploadComplete?: (avatarUrl: string) => void
}

export function AvatarUploadDialog({
  currentAvatarUrl,
  userName,
  onUploadComplete,
}: AvatarUploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { showError, showSuccess } = useErrorHandler()
  const [isValidating, setIsValidating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { refetch } = useSession()
  const { t } = useTranslation('profile')

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
        showError(
          new AppError(
            ERROR_CODES.VAL_INVALID_FORMAT,
            400,
            { allowedTypes: allowedTypes.join(', ') },
            t('avatar.errors.invalidFileType')
          )
        )
        return
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        showError(
          new AppError(
            ERROR_CODES.VAL_INVALID_FORMAT,
            400,
            { maxSizeMB: 10, actualSizeMB: (file.size / 1024 / 1024).toFixed(1) },
            t('avatar.errors.fileSizeExceeds', { size: '10MB' })
          )
        )
        return
      }

      // Validate image dimensions using a simple Image object
      const img = new Image()
      const imageUrl = URL.createObjectURL(file)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(imageUrl)

          // Check dimensions - reasonable limits for avatars
          const maxWidth = 4096 // 4K max
          const maxHeight = 4096
          const minWidth = 32 // Minimum readable size
          const minHeight = 32

          if (img.width > maxWidth || img.height > maxHeight) {
            reject(
              new Error(
                t('avatar.errors.dimensionsTooLarge', {
                  width: img.width,
                  height: img.height,
                  maxWidth,
                  maxHeight,
                })
              )
            )
            return
          }

          if (img.width < minWidth || img.height < minHeight) {
            reject(
              new Error(
                t('avatar.errors.dimensionsTooSmall', {
                  width: img.width,
                  height: img.height,
                  minWidth,
                  minHeight,
                })
              )
            )
            return
          }

          resolve()
        }

        img.onerror = () => {
          URL.revokeObjectURL(imageUrl)
          reject(new Error(t('avatar.errors.invalidImage')))
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
      showError(error)
    } finally {
      setIsValidating(false)
    }
  }, [showError, t])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()

      const file = event.dataTransfer.files?.[0]
      if (!file) return

      // Create a fake event to reuse the file select handler
      const fakeEvent = {
        target: { files: [file] },
        currentTarget: { files: [file] },
        nativeEvent: {},
        bubbles: false,
        cancelable: false,
        defaultPrevented: false,
        eventPhase: 0,
        isTrusted: false,
        preventDefault: () => { },
        isDefaultPrevented: () => false,
        stopPropagation: () => { },
        isPropagationStopped: () => false,
        persist: () => { },
        timeStamp: Date.now(),
        type: 'change',
      } as unknown as React.ChangeEvent<HTMLInputElement>

      handleFileSelect(fakeEvent)
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) {
      showError(new AppError(ERROR_CODES.VAL_REQUIRED_FIELD, 400, { field: 'File' }))
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', selectedFile)

      const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new AppError(
          ERROR_CODES.SYS_SERVER_ERROR,
          500,
          { uploadError: data.error },
          data.error || t('avatar.errors.uploadFailed')
        )
      }

      showSuccess(t('avatar.success.uploaded'))

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
      showError(error)
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
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new AppError(
          ERROR_CODES.SYS_SERVER_ERROR,
          500,
          { removeError: data.error },
          data.error || t('avatar.errors.removeFailed')
        )
      }

      showSuccess(t('avatar.success.removed'))

      // Call callback with empty string to indicate removal
      onUploadComplete?.('')

      // Refetch session to update user data immediately
      await refetch()

      // Close dialog
      setOpen(false)
    } catch (error) {
      showError(error)
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
        <Button variant="ghost" className="relative group h-24 w-24 rounded-full p-0">
          <Avatar className="h-24 w-24">
            <AvatarImage src={currentAvatarUrl || undefined} />
            <AvatarFallback className="text-2xl">{getUserInitials()}</AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('avatar.title')}</DialogTitle>
          <DialogDescription>{t('avatar.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview or Upload Area */}
          {previewUrl ? (
            <div className="relative flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={previewUrl} className="object-cover" />
                  <AvatarFallback className="text-2xl">{getUserInitials()}</AvatarFallback>
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
              <p className="text-sm text-muted-foreground text-center">{t('avatar.preview')}</p>
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
                  <p className="mt-2 text-sm text-muted-foreground">{t('avatar.validating')}</p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('avatar.uploadInstructions')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t('avatar.fileTypes')}</p>
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
                  {t('avatar.cancel')}
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isValidating}
                  loading={isUploading}
                  className="flex-1"
                >
                  {isUploading ? t('avatar.uploading') : t('avatar.upload')}
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
                  {isValidating ? t('avatar.validatingButton') : t('avatar.chooseFile')}
                </Button>
                {currentAvatarUrl && (
                  <Button variant="destructive" onClick={handleRemoveAvatar} loading={isUploading}>
                    {t('avatar.remove')}
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
