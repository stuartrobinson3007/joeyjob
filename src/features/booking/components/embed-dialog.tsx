import { useState } from 'react'
import { Code, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Textarea } from '@/ui/textarea'

interface EmbedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  formName: string
  orgSlug?: string
  formSlug?: string
}

export function EmbedDialog({ open, onOpenChange, formId, formName, orgSlug, formSlug }: EmbedDialogProps) {
  const [copiedText, setCopiedText] = useState<'iframe' | null>(null)

  // Generate the embed URL - use hosted URL if slugs are available, otherwise fallback to embed
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const embedUrl = orgSlug && formSlug 
    ? `${baseUrl}/f/${orgSlug}/${formSlug}`
    : `${baseUrl}/embed/${formId}`
  
  // Generate iframe code with fixed dimensions
  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600px"
  frameborder="0"
  scrolling="no"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
  title="${formName} - Booking Form"
></iframe>`

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText('iframe')
      setTimeout(() => setCopiedText(null), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
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
          {/* Iframe Code */}
          <div className="space-y-4">
            <Label className="text-base font-medium">HTML Embed Code</Label>
            <div className="relative">
              <Textarea
                value={iframeCode}
                readOnly
                className="font-mono text-sm min-h-[120px] resize-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(iframeCode)}
                className="absolute top-2 right-2 gap-2"
                disabled={copiedText === 'iframe'}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}