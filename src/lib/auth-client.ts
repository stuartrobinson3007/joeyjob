import { createAuthClient } from 'better-auth/react'
import { organizationClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:2847',
  plugins: [organizationClient()]
})