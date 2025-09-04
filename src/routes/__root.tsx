import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanstackDevtools } from '@tanstack/react-devtools'
import { authClient } from '@/lib/auth-client'
import { GoogleSignIn } from '@/components/GoogleSignIn'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {isPending ? (
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !session ? (
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="max-w-md w-full p-6 space-y-6">
              <h1 className="text-2xl font-bold text-center">Welcome</h1>
              <p className="text-center text-muted-foreground">
                Sign in to access your todos
              </p>
              <GoogleSignIn />
            </div>
          </div>
        ) : (
          children
        )}
        <TanstackDevtools
          config={{
            position: 'bottom-left',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
