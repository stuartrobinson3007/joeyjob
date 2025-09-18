import { createFileRoute, Outlet } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { Toaster } from 'sonner'
import { useTheme } from 'next-themes'

import i18n from '@/i18n/config'
import { createQueryClient } from '@/taali/errors/query-client'
import { ConfirmDialogProvider } from '@/ui/confirm-dialog'
import { FormThemeProvider } from '@/lib/form-theme-provider'

// Create a dedicated query client for booking forms
const queryClient = createQueryClient()

export const Route = createFileRoute('/_booking-form')({
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
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
  component: BookingFormComponent,
})

function BookingFormComponent() {
  return (
    <FormThemeProvider>
      <BookingFormContent />
    </FormThemeProvider>
  )
}

function BookingFormContent() {
  const { theme } = useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ConfirmDialogProvider>
          <Outlet />
          <Toaster
            position="bottom-right"
            theme={theme as 'light' | 'dark'}
          />
        </ConfirmDialogProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}
