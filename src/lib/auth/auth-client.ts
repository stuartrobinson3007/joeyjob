import { createAuthClient } from 'better-auth/react'
import {
  organizationClient,
  magicLinkClient,
  adminClient,
  inferAdditionalFields,
  emailOTPClient,
} from 'better-auth/client/plugins'
import { stripeClient } from '@better-auth/stripe/client'

import type { auth } from './auth'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
  plugins: [
    magicLinkClient(),
    emailOTPClient(),
    adminClient(),
    organizationClient(),
    stripeClient({ subscription: true }),
    inferAdditionalFields<typeof auth>(),
  ],
})
