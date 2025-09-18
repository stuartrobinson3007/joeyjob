import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { UpdateConnectionPage } from '@/features/auth/components/update-connection'

export const Route = createFileRoute('/_all-pages/auth/update-connection')({
  validateSearch: z.object({
    redirectTo: z.string().optional(),
  }),
  component: UpdateConnectionPage,
})