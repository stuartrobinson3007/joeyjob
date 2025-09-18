import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanstackDevtools } from '@tanstack/react-devtools'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from 'next-themes'

import { Providers } from '@/lib/hooks/providers'
import { NotFoundComponent } from '@/components/not-found'
import { ConfirmDialogProvider } from '@/ui/confirm-dialog'

export const Route = createFileRoute('/_all-pages')({
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
        title: 'JoeyJob',
      },
    ],
  }),
  component: AllRoutesComponent,
  notFoundComponent: NotFoundComponent,
})

function AllRoutesComponent() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      value={{ light: "light", dark: "dark" }}
    >
      <AllRoutesContent />
    </ThemeProvider>
  )
}

function AllRoutesContent() {
  const { theme } = useTheme()

  return (
    <Providers>
      <ConfirmDialogProvider>
        <Outlet />
        <Toaster
          position="bottom-right"
          theme={theme as 'light' | 'dark' | 'system'}
        />
        <TanstackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      </ConfirmDialogProvider>
    </Providers>
  )
}
