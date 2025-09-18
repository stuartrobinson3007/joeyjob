import type { ReactNode } from 'react'
import { createRootRoute, Outlet, HeadContent, Scripts } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { NotFoundComponent } from '@/components/not-found'

export const Route = createRootRoute({
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  // Minimal root component that delegates to layout routes
  // _all-routes and _booking-form handle their own themes and providers
  return <Outlet />
}

interface RootDocumentProps {
  children: ReactNode
}

function RootDocument({ children }: RootDocumentProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
