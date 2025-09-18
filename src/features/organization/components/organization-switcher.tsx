/**
 * Organization Switcher Component
 *
 * Allows users to switch between workspaces (organizations in better-auth) they belong to.
 * Integrates with better-auth organization system and the existing organization context.
 */

import { useState, memo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronsUpDown, Plus, Loader2, Building2, Lock } from 'lucide-react'

import { useSuperAdminWrapper } from '../../admin/components/super-admin-wrapper'

import { useErrorHandler } from '@/lib/errors/hooks'
import { Button } from '@/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Skeleton } from '@/ui/skeleton'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useListOrganizations } from '@/lib/auth/auth-hooks'
import { useTranslation } from '@/i18n/hooks/useTranslation'

// Memoized OrganizationSwitcher to prevent re-renders on form state changes
const OrganizationSwitcher = memo(function OrganizationSwitcher() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { showError, showSuccess } = useErrorHandler()
  const navigate = useNavigate()


  // Use better-auth organization hooks (organizations = workspaces in our UI)
  const {
    data: organizations,
    isPending: isLoading,
    refetch: refetchOrganizations,
  } = useListOrganizations()
  const {
    activeOrganization,
    setActiveOrganization,
    isLoading: orgContextLoading,
  } = useActiveOrganization()

  // Track switching state
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchingToWorkspace, setSwitchingToWorkspace] = useState<string | null>(null)

  // Check superadmin context for disable logic
  const { shouldShowSuperAdminFrame, isImpersonating } = useSuperAdminWrapper()
  const shouldDisableOrganizationSwitcher = shouldShowSuperAdminFrame && !isImpersonating

  // Memoized event handlers to prevent breaking memoization

  const handleWorkspaceSelect = useCallback(
    async (organizationId: string) => {
      if (organizationId === activeOrganization?.id) {
        setOpen(false)
        return
      }

      try {
        setIsSwitching(true)
        setSwitchingToWorkspace(organizationId)

        await setActiveOrganization(organizationId)
        setOpen(false)

        // Show success toast
        const targetOrg = organizations?.find(org => org.id === organizationId)
        if (targetOrg) {
          showSuccess(tNotifications('success.organizationSwitched'))
        }
      } catch (error: unknown) {
        showError(error)
      } finally {
        setIsSwitching(false)
        setSwitchingToWorkspace(null)
      }
    },
    [activeOrganization?.id, organizations, setActiveOrganization, showError, showSuccess, tNotifications]
  )


  if (isLoading || orgContextLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton />
      </div>
    )
  }

  // Show disabled state when in superadmin mode (except when impersonating)
  if (shouldDisableOrganizationSwitcher) {
    return (
      <Button
        variant="outline"
        className="w-full justify-between opacity-50 cursor-not-allowed"
        disabled={true}
        title={t('organization.switchingDisabled')}
      >
        {activeOrganization ? (
          <span className="text-sm font-medium truncate flex-1 text-left">
            {activeOrganization.name}
          </span>
        ) : (
          <div className="flex items-center space-x-2">
            <Building2 />
            <span>{t('organization.selectWorkspace')}</span>
          </div>
        )}
        <Lock className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={t('organization.selectWorkspace')}
            className={`w-full justify-between ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSwitching}
          >
            {activeOrganization ? (
              <span className="text-sm font-medium truncate flex-1 text-left">
                {activeOrganization.name}
              </span>
            ) : (
              <div className="flex items-center space-x-2">
                <Building2 />
                <span>{t('organization.selectWorkspace')}</span>
              </div>
            )}
            {isSwitching ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('organization.searchWorkspaces')} />
            <CommandList>
              <CommandEmpty>{t('organization.noWorkspaces')}</CommandEmpty>
              {organizations && organizations.length > 0 && (
                <CommandGroup>
                  {organizations.map(organization => (
                    <CommandItem
                      key={organization.id}
                      value={`${organization.id}-${organization.name}`}
                      onSelect={() => handleWorkspaceSelect(organization.id)}
                      className="flex items-center space-x-2"
                    >
                      <span className="text-sm font-medium truncate flex-1">
                        {organization.name}
                      </span>
                      {switchingToWorkspace === organization.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : activeOrganization?.id === organization.id ? (
                        <Check />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="create-workspace"
                forceMount
                onSelect={() => {
                  setOpen(false)
                  navigate({ to: '/company-setup/select-company' })
                }}
                className="flex items-center space-x-2"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed">
                  <Plus />
                </div>
                <span>{t('organization.createWorkspace')}</span>
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

    </>
  )
})

export { OrganizationSwitcher }
export default OrganizationSwitcher
