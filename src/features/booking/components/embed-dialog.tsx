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
import { Label } from '@/ui/label'
import { Textarea } from '@/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'

interface EmbedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  formName: string
  orgSlug?: string
  formSlug?: string
}

export function EmbedDialog({ open, onOpenChange, formId, formName, orgSlug, formSlug }: EmbedDialogProps) {
  const [copiedText, setCopiedText] = useState<'iframe' | 'complete' | 'script' | null>(null)

  // Generate the embed URL - always use the embed route for iframe embedding
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const embedUrl = `${baseUrl}/embed/${formId}`
  const scriptUrl = `${baseUrl}/iframe-resizer.js`
  
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

  // Generate complete embed code with auto-resizing
  const completeEmbedCode = `<!-- JoeyJob Auto-Resizing Booking Form -->
<script src="${scriptUrl}" async></script>
<iframe
  src="${embedUrl}"
  width="100%"
  height="600px"
  frameborder="0"
  scrolling="no"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
  title="${formName} - Booking Form"
></iframe>`

  // Generate inline script version for maximum compatibility
  const inlineScriptCode = `<!-- JoeyJob Booking Form with Inline Auto-Resize -->
<script>
(function() {
  function handleJoeyJobResize(event) {
    // Validate origin for security
    const allowedOrigins = ['${baseUrl}'];
    if (!allowedOrigins.includes(event.origin)) return;
    
    // Handle iframe resize messages
    if (event.data && event.data.type === 'iframeResize') {
      const iframe = document.querySelector('iframe[src*="${baseUrl}"]');
      if (iframe && event.data.payload && event.data.payload.height) {
        iframe.style.height = Math.max(300, Math.min(5000, event.data.payload.height)) + 'px';
      }
    }
  }
  
  // Add event listener
  if (window.addEventListener) {
    window.addEventListener('message', handleJoeyJobResize, false);
  } else {
    window.attachEvent('onmessage', handleJoeyJobResize);
  }
})();
</script>
<iframe
  src="${embedUrl}"
  width="100%"
  height="600px"
  frameborder="0"
  scrolling="no"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
  title="${formName} - Booking Form"
></iframe>`

  const handleCopy = async (text: string, type: 'iframe' | 'complete' | 'script') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(type)
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

        <Tabs defaultValue="recommended" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recommended">Recommended</TabsTrigger>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="inline">Inline Script</TabsTrigger>
          </TabsList>

          {/* Recommended: Complete with Auto-Resize */}
          <TabsContent value="recommended" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Complete Embed Code (Recommended)</Label>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                  Auto-Resize
                </span>
              </div>
              <div className="relative">
                <Textarea
                  value={completeEmbedCode}
                  readOnly
                  className="font-mono text-sm min-h-[180px] resize-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(completeEmbedCode, 'complete')}
                  className="absolute top-2 right-2 gap-2"
                  disabled={copiedText === 'complete'}
                >
                  {copiedText === 'complete' ? (
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm text-green-800">✨ This includes auto-resizing!</h4>
                <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                  <li>Automatically adjusts height based on form content</li>
                  <li>Smooth animations when content changes</li>
                  <li>Secure cross-domain messaging</li>
                  <li>Works on all modern browsers</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* Basic: Just the iframe */}
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-4">
              <Label className="text-base font-medium">Basic Iframe (Fixed Height)</Label>
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
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm text-orange-800">⚠️ Fixed height only</h4>
                <p className="text-sm text-orange-700">
                  This basic version has a fixed height of 600px. Content may be cut off or show extra space.
                  We recommend using the auto-resize version above for the best user experience.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Inline Script Version */}
          <TabsContent value="inline" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Inline Script Version</Label>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  No External Files
                </span>
              </div>
              <div className="relative">
                <Textarea
                  value={inlineScriptCode}
                  readOnly
                  className="font-mono text-sm min-h-[300px] resize-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(inlineScriptCode, 'script')}
                  className="absolute top-2 right-2 gap-2"
                  disabled={copiedText === 'script'}
                >
                  {copiedText === 'script' ? (
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm text-blue-800">🔒 Maximum compatibility</h4>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>No external script dependencies</li>
                  <li>Perfect for strict security environments</li>
                  <li>All code is visible and self-contained</li>
                  <li>Still includes auto-resizing functionality</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* General Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Code className="h-4 w-4" />
            Implementation Guide
          </h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h5 className="font-medium">Quick Setup:</h5>
              <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Choose your preferred embed method above</li>
                <li>Copy the code to your clipboard</li>
                <li>Paste into your website's HTML</li>
                <li>Publish and test the form</li>
              </ol>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium">Features:</h5>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>Responsive design (mobile-friendly)</li>
                <li>Real-time booking submissions</li>
                <li>Automatic height adjustment</li>
                <li>Secure cross-domain messaging</li>
              </ul>
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <ExternalLink className="h-3 w-3" />
              Need help? Check our 
              <a href="#" className="underline hover:text-foreground">
                embed documentation
              </a>
              or contact support.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}