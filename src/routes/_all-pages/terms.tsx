import { createFileRoute } from '@tanstack/react-router'
import { getTermsOfService } from '@/lib/content/terms.server'

export const Route = createFileRoute('/_all-pages/terms')({
  component: TermsOfServicePage,
  loader: async () => {
    // Server-side processing of markdown content
    const termsData = await getTermsOfService()
    return termsData
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: 'Terms of Service - JoeyJob',
      },
      {
        name: 'description',
        content: 'Terms of Service for JoeyJob booking platform. Last updated: ' + loaderData?.lastUpdated,
      },
      {
        name: 'robots',
        content: 'index, follow',
      },
    ],
  }),
})

function TermsOfServicePage() {
  const { html, lastUpdated } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">JoeyJob</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              Last updated: {lastUpdated}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <article
          className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-m-20 prose-headings:font-semibold prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-p:leading-7 prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:underline prose-blockquote:border-l-primary prose-blockquote:pl-6 prose-blockquote:italic prose-code:relative prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm prose-pre:overflow-x-auto prose-ol:my-6 prose-ul:my-6 prose-li:my-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} JoeyJob. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}