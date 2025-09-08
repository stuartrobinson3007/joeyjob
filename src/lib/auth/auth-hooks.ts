import { createAuthHooks } from '@daveyplate/better-auth-tanstack'

import { authClient } from '@/lib/auth/auth-client'

export const authHooks = createAuthHooks(authClient)

export const {
  useSession,
  usePrefetchSession,
  useToken,
  useListAccounts,
  useListSessions,
  useListDeviceSessions,
  useListPasskeys,
  useUpdateUser,
  useUnlinkAccount,
  useRevokeOtherSessions,
  useRevokeSession,
  useRevokeSessions,
  useSetActiveSession,
  useRevokeDeviceSession,
  useDeletePasskey,
  useAuthQuery,
  useAuthMutation,
  useListOrganizations,
  useHasPermission,
  useInvitation
} = authHooks

// Alias for clearer naming convention
export const useServerPermissions = useHasPermission
