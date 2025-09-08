import { AuthQueryProvider } from '@daveyplate/better-auth-tanstack'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'

import { PageContextProvider } from './page-context'

import { OrganizationProvider } from '@/features/organization/lib/organization-context'
import i18n from '@/i18n/config'
import { createQueryClient } from '@/taali/errors/query-client'

// Create a client with error handling
export const queryClient = createQueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AuthQueryProvider>
          <OrganizationProvider>
            <PageContextProvider>{children}</PageContextProvider>
          </OrganizationProvider>
        </AuthQueryProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}
