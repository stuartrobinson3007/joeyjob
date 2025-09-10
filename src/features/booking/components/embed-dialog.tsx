import { useState } from 'react'
import { Code, Copy, Check, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Textarea } from '@/ui/textarea'
import { Badge } from '@/ui/badge'
import { Separator } from '@/ui/separator'
import { cn } from '@/taali/lib/utils'

interface EmbedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  formName: string
  orgSlug?: string
  formSlug?: string
}

export function EmbedDialog({ open, onOpenChange, formId, formName, orgSlug, formSlug }: EmbedDialogProps) {
  const [iframeDimensions, setIframeDimensions] = useState({
    width: '100%',
    height: '600px',
  })
  const [copiedText, setCopiedText] = useState<'iframe' | 'url' | null>(null)

  // Generate the embed URL - use hosted URL if slugs are available, otherwise fallback to embed
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const embedUrl = orgSlug && formSlug 
    ? `${baseUrl}/${orgSlug}/${formSlug}`
    : `${baseUrl}/embed/${formId}`
  
  // Generate iframe code
  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${iframeDimensions.width}"
  height="${iframeDimensions.height}"
  frameborder="0"
  scrolling="no"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
  title="${formName} - Booking Form"
></iframe>`

  const handleCopy = async (text: string, type: 'iframe' | 'url') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(type)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const handleOpenPreview = () => {
    window.open(embedUrl, '_blank', 'width=900,height=700')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Embed "{formName}"
          </DialogTitle>
          <DialogDescription>
            Copy the code below to embed this booking form on your website
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview and URL Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Form URL</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPreview}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Preview
              </Button>
            </div>
            <div className="flex gap-2">
              <Input value={embedUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(embedUrl, 'url')}
                className="shrink-0"
              >
                {copiedText === 'url' ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Customization Options */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Customize Appearance</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="width" className="text-sm">Width</Label>
                <Input
                  id="width"
                  value={iframeDimensions.width}
                  onChange={(e) =>
                    setIframeDimensions((prev) => ({
                      ...prev,
                      width: e.target.value,
                    }))
                  }
                  placeholder="e.g., 100%, 800px"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-sm">Height</Label>
                <Input
                  id="height"
                  value={iframeDimensions.height}
                  onChange={(e) =>
                    setIframeDimensions((prev) => ({
                      ...prev,
                      height: e.target.value,
                    }))
                  }
                  placeholder="e.g., 600px, 100vh"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              The form will automatically resize its height, but you can set a minimum height here.
            </div>
          </div>

          <Separator />

          {/* Iframe Code */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">HTML Embed Code</Label>
              <Badge variant="secondary" className="text-xs">
                Copy & Paste Ready
              </Badge>
            </div>
            <div className="relative">
              <Textarea
                value={iframeCode}
                readOnly
                className="font-mono text-sm min-h-[120px] resize-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(iframeCode, 'iframe')}
                className={cn(
                  "absolute top-2 right-2 gap-2 transition-colors",
                  copiedText === 'iframe' && "bg-green-50 border-green-200 text-green-700"
                )}
              >
                {copiedText === 'iframe' ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">How to use this embed code:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Copy the HTML embed code above</li>
              <li>Paste it into your website where you want the form to appear</li>
              <li>The form will automatically adjust its height based on the content</li>
              <li>Customers can book directly through the embedded form</li>
            </ol>
          </div>

          {/* Features */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-sm text-blue-900 mb-2">
              ✨ Embed Features
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Auto-resizing iframe (no scrollbars)</li>
              <li>• Mobile-responsive design</li>
              <li>• Secure cross-domain communication</li>
              <li>• Real-time booking processing</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => handleCopy(iframeCode, 'iframe')}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Embed Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}