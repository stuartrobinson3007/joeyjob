import { HeadContent, Scripts } from '@tanstack/react-router'
import { Toaster } from 'sonner'

interface HostedShellProps {
  children: React.ReactNode
  assets: React.ReactNode
  loaderData?: {
    form?: {
      theme?: string
      name?: string
      description?: string
    }
    organization?: {
      name?: string
    }
  }
}

export function HostedShell({ children, assets, loaderData }: HostedShellProps) {

  const theme = loaderData?.form?.theme || 'light'
  const title = `${loaderData?.form?.name || 'Book Now'} - ${loaderData?.organization?.name || 'JoeyJob'}`
  const description = loaderData?.form?.description || `Book your appointment with ${loaderData?.organization?.name || 'us'}`


  return (
    <html lang="en" className={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        {assets}
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-right" theme={theme as 'light' | 'dark'} />
        <Scripts />
      </body>
    </html>
  )
}