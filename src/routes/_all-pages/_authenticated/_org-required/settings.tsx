import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useConfirm } from '@/ui/confirm-dialog'
import { organizationSettingsSchema, type OrganizationSettingsData } from '@/lib/validation/organization.schema'
import type { Organization } from '@/types/organization'
import {
  updateOrganizationSlug,
  deleteOrganizationWithValidation,
  checkSlugAvailability
} from '@/lib/auth/organization-wrapper'
import { useFormMutation } from '@/taali/hooks/use-form-mutation'
import { useAsyncFieldValidator } from '@/taali/hooks/use-async-field-validator'
import { useFormSync } from '@/taali/hooks/use-form-sync'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { getOrganizationWithProviderData, refreshOrganizationFromProvider } from '@/lib/providers/organization-data.server'
import { useQuery, useMutation } from '@tanstack/react-query'
import { clearActiveOrganizationId } from '@/features/organization/lib/organization-utils'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { parseError } from '@/taali/errors/client-handler'
import { useListOrganizations } from '@/lib/auth/auth-hooks'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import {
  FormErrorBoundary,
  Form,
  TextField,
  FormActions,
  FormRootError,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/taali/components/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/taali/components/ui/select'
import { Button } from '@/ui/button'
import { Skeleton } from '@/ui/skeleton'
import { EmployeeManagement } from '@/features/organization/components/employee-management'

export const Route = createFileRoute('/_all-pages/_authenticated/_org-required/settings')({
  component: OrganizationSettings,
})

function OrganizationSettingsForm() {
  const { activeOrganization, isLoading } = useActiveOrganization()
  const { refetch: refetchOrganizations } = useListOrganizations()
  
  // Get full organization data including provider info
  const { 
    data: orgData, 
    isLoading: orgDataLoading,
    refetch: refetchOrgData 
  } = useQuery({
    queryKey: ['organization-with-provider-data'],
    queryFn: () => getOrganizationWithProviderData(),
    enabled: !!activeOrganization,
  })
  
  const fullOrganization = orgData?.organization || activeOrganization
  const navigate = useNavigate()
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { showSuccess, showError } = useErrorHandler()
  const confirm = useConfirm()

  // Helper function to format address
  const formatAddress = (org: any) => {
    const parts = [
      org?.addressLine1,
      org?.addressLine2,
      org?.addressCity,
      org?.addressState,
      org?.addressPostalCode,
      org?.addressCountry
    ].filter(part => part && part.trim() !== '')
    
    return parts.length > 0 ? parts.join(', ') : 'No address set'
  }

  // Sync from provider mutation
  const syncMutation = useMutation({
    mutationFn: refreshOrganizationFromProvider,
    onSuccess: async () => {
      await refetchOrgData()
      await refetchOrganizations()
      showSuccess('Company information synced from Simpro')
    },
    onError: showError
  })

  // Handle Simpro settings link
  const handleOpenSimproSettings = () => {
    if (fullOrganization?.providerType === 'simpro') {
      // Use the same URL pattern as in other components
      const buildName = 'joeyjob' // Could get from provider data if needed
      const domain = 'simprosuite.com'
      const settingsUrl = `https://${buildName}.${domain}/staff/configCompany.php`
      window.open(settingsUrl, '_blank')
    }
  }

  // Initialize form with React Hook Form and Zod (only editable fields)
  const form = useForm<OrganizationSettingsData>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      slug: '',
    },
    mode: 'onChange' // Enable real-time validation
  })

  // Sync form with loaded organization data (only slug is editable now)
  const formSyncData = activeOrganization ? {
    slug: activeOrganization.slug || '',
  } : null
  
  console.log('🔍 [Settings] Form sync data:', formSyncData)
  useFormSync(form, formSyncData, [activeOrganization])


  // Setup async slug validation
  const validateSlug = useAsyncFieldValidator(
    async (slug: string) => {
      // Skip validation if slug hasn't changed
      if (!activeOrganization || slug === activeOrganization.slug) {
        return true
      }

      // Skip if slug is empty (Zod will handle required validation)
      if (!slug) {
        return true
      }

      try {
        const result = await checkSlugAvailability({
          data: {
            slug,
            organizationId: activeOrganization.id
          }
        })

        return result.available || 'validation:organization.slug.taken'
      } catch (error) {
        // Handle abort errors gracefully
        if ((error as Error)?.name === 'AbortError') {
          return true // Return valid if aborted
        }

        // If validation fails, allow it (better to let server validate)
        // Slug validation error - handled by error state
        return true
      }
    },
    [activeOrganization]
  )

  // Setup mutation with error handling
  const updateMutation = useFormMutation<Organization, OrganizationSettingsData, OrganizationSettingsData>({
    mutationFn: async (data: OrganizationSettingsData) => {
      console.log('🔍 [Settings] Mutation starting with data:', data)
      console.log('🔍 [Settings] Active organization:', activeOrganization?.id, activeOrganization?.name)
      
      if (!activeOrganization) {
        console.error('🔍 [Settings] No active organization found')
        throw new AppError(
          ERROR_CODES.VAL_REQUIRED_FIELD,
          400,
          { field: 'activeOrganization' },
          tCommon('organization.noActiveOrganization')
        )
      }
      
      console.log('🔍 [Settings] Calling updateOrganizationSlug with slug:', data.slug)
      
      const result = await updateOrganizationSlug({
        slug: data.slug,
        organizationId: activeOrganization.id
      })
      console.log('🔍 [Settings] Update result:', result)
      return result
    },
    setError: form.setError,
    onSuccess: async () => {
      console.log('🔍 [Settings] Update succeeded, refreshing data...')
      showSuccess('Organization settings saved')
      // Refresh organizations list to update the sidebar
      await refetchOrganizations()
      // Mark form as clean after successful save
      form.reset(form.getValues())
      console.log('🔍 [Settings] Form reset completed')
    },
    onError: (error) => {
      console.error('🔍 [Settings] Update failed:', error)
      
      // Custom error handling for specific error types per Taali patterns
      const parsedError = parseError(error)
      console.log('🔍 [Settings] Parsed error:', parsedError)
      
      if (parsedError.code === ERROR_CODES.BIZ_DUPLICATE_ENTRY) {
        // Handle slug already taken error specifically
        showError(error, { context: 'Organization slug update failed' })
        return
      }
      
      // Let useFormMutation handle other errors
      showError(error, { context: 'Organization settings update failed' })
    }
  })

  // Handle delete organization
  const handleDeleteOrganization = async () => {
    if (!activeOrganization) return

    const confirmed = await confirm({
      title: t('danger.deleteConfirmTitle'),
      description: t('danger.deleteConfirmWithName', { name: activeOrganization.name }),
      confirmText: t('danger.deleteWorkspace'),
      variant: 'destructive'
    })
    if (!confirmed) return

    try {
      await deleteOrganizationWithValidation(activeOrganization.id)
      toast.success(tNotifications('success.organizationDeleted'))

      // Clear the active organization from storage
      clearActiveOrganizationId()

      // Refresh organizations list to ensure deleted org doesn't appear
      await refetchOrganizations()

      // Navigate to organization selector
      navigate({ to: '/select-organization' })
    } catch (_error) {
      // Log and show error message for organization deletion failure
      // Failed to delete organization - handled by showError
      toast.error(tNotifications('error.organizationDeleteFailed'))
    }
  }

  const onSubmit = (data: OrganizationSettingsData) => {
    console.log('🔍 [Settings] Form submitted with data:', data)
    console.log('🔍 [Settings] Form state:', {
      isDirty: form.formState.isDirty,
      isValid: form.formState.isValid,
      errors: form.formState.errors
    })
    updateMutation.mutate(data)
  }

  // Loading state
  if (isLoading || orgDataLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={t('title')} />
        <div className="flex-1 p-6">
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-card rounded-lg shadow-sm border p-6 space-y-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No organization state
  if (!activeOrganization) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={t('title')} />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t('organization.notFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('title')} />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto w-full space-y-8">
          
          {/* Company Information (Read-only) */}
          <div className="bg-card rounded-lg shadow-sm border p-6 space-y-4">
            <h3 className="text-lg font-semibold">Company Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                <p className="text-sm">{fullOrganization?.name || 'Not set'}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Timezone</label>
                <p className="text-sm">{fullOrganization?.timezone || 'Not set'}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Currency</label>
                <p className="text-sm">{fullOrganization?.currency || 'Not set'}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="text-sm">{fullOrganization?.phone || 'Not set'}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm">{fullOrganization?.email || 'Not set'}</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Address</label>
                <p className="text-sm text-left">{formatAddress(fullOrganization)}</p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={() => syncMutation.mutate()} 
                loading={syncMutation.isPending}
              >
                Sync from Simpro
              </Button>
              <Button variant="outline" onClick={handleOpenSimproSettings}>
                Simpro Settings
              </Button>
            </div>
          </div>

          {/* JoeyJob Settings (Editable) */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card rounded-lg shadow-sm border p-6 space-y-6">
              <h3 className="text-lg font-semibold">JoeyJob Settings</h3>
              
              <TextField
                control={form.control}
                name="slug"
                label={t('organization.slug')}
                placeholder={t('organization.slugPlaceholder')}
                description={t('organization.slugHelp')}
                rules={{
                  validate: validateSlug
                }}
              />

              {/* Root-level errors */}
              <FormRootError errors={form.formState.errors} />

              {/* Form actions */}
              <FormActions
                isSubmitting={updateMutation.isPending}
                isDirty={form.formState.isDirty}
                submitLabel={tCommon('actions.save')}
                showCancel={false}
              />
            </form>
          </Form>

          {/* Employee Management */}
          <EmployeeManagement />

          {/* Danger Zone */}
          <div className="bg-card rounded-lg shadow-sm border border-destructive/30 p-6 mt-8">
            <h3 className="text-lg font-semibold text-destructive mb-4">{t('danger.title')}</h3>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <h4 className="font-medium text-destructive mb-2">{t('danger.delete')}</h4>
              <p className="text-sm text-destructive/90 mb-4">{t('danger.deleteWarning')}</p>
              <Button
                onClick={handleDeleteOrganization}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 />
                {t('danger.deleteWorkspace')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export with error boundary wrapper
function OrganizationSettings() {
  return (
    <FormErrorBoundary>
      <OrganizationSettingsForm />
    </FormErrorBoundary>
  )
}